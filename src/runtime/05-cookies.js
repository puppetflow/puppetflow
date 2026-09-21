/* @help Cookies
 * @sig $saveCookies(profile?, options?)
 * @aliases save browser session, persist login, store cookies
 * @desc Save browser cookies and localStorage by origin. Default jar name: "Default".
 * @nodal-desc Save cookies and localStorage for reuse in later runs.
 * @nodal-output void
 * @opt persistLocalStorage: true
 * @nodal-param profile [cookie-profile]: Browser storage profile to save. Use a simple label like "main" or leave empty for "Default".
 * @nodal-param options: Browser storage options.
 * @nodal-param options.persistLocalStorage [boolean]: Save localStorage with cookies. Enabled by default.
 */
const __resolveCookieProfileName = function(profile) {
  return typeof profile === 'string' && profile.trim() ? profile.trim() : 'Default';
};
const __defaultCookieProfileName = 'Default';
const __resolveCookieHelperArguments = function(profile, options) {
  if (profile && typeof profile === 'object' && !Array.isArray(profile)) {
    options = profile;
    profile = undefined;
  }
  const resolvedOptions = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
  return {
    profile: __resolveCookieProfileName(profile),
    persistLocalStorage: resolvedOptions.persistLocalStorage !== false,
  };
};
let __activeBrowserStorageProfile = null;
let __activeBrowserStoragePersistLocalStorage = true;
let __localStorageByOrigin = {};
const __localStorageRestoreScriptByPage = new WeakMap();

// localStorage lives per web origin, so only http(s) pages carry anything to
// capture or restore. Evaluating on the internal tabs Pinokio leaves open
// (chrome://new-tab-page, about:blank) is not just pointless: under the CDP
// shim the new-tab page can churn its execution context, and an evaluate on
// it then blocks for the full default timeout (30s) instead of resolving.
// That is the intermittent long blank screen at the start of a run. url() is
// synchronous and needs no context, so it is safe to gate on.
const __isWebStoragePage = function(page) {
  try {
    return /^https?:\/\//.test(page.url());
  } catch (_) {
    return false;
  }
};

const __cookieProfilePath = function(profile, helperName) {
  return __resolveArtifactPath(paths.cookies, __resolveCookieProfileName(profile) + '.json', helperName + ' path');
};

const __normalizeLocalStorageByOrigin = function(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([origin, entries]) => {
    if (typeof origin !== 'string' || !entries || typeof entries !== 'object' || Array.isArray(entries)) return [];
    return [[origin, Object.fromEntries(Object.entries(entries)
      .filter(([key, item]) => typeof key === 'string' && typeof item === 'string'))]];
  }));
};

const __readCookieProfile = async function(profile, helperName) {
  let content;
  try {
    content = await fs.promises.readFile(__cookieProfilePath(profile, helperName), 'utf8');
  } catch (error) {
    if (profile !== 'Default' || !error || error.code !== 'ENOENT') throw error;
    content = await fs.promises.readFile(__cookieProfilePath('default', helperName), 'utf8');
  }
  const raw = JSON.parse(content);
  if (Array.isArray(raw)) {
    return { version: 1, cookies: raw, localStorage: {} };
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.cookies)) {
    throw new Error(helperName + ': invalid browser storage jar.');
  }
  return {
    version: 1,
    cookies: raw.cookies,
    localStorage: __normalizeLocalStorageByOrigin(raw.localStorage),
  };
};

const __restoreCookies = async function(cookies) {
  if (!Array.isArray(cookies) || cookies.length === 0) return;
  await $client.send('Network.setCookies', { cookies });
};

const __capturePageLocalStorage = async function(page) {
  return page.evaluate(() => {
    try {
      if (!/^https?:$/.test(window.location.protocol)) return null;
      const entries = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key !== null) entries.push([key, window.localStorage.getItem(key)]);
      }
      return { origin: window.location.origin, entries: Object.fromEntries(entries) };
    } catch (_) {
      return null;
    }
  }).catch(() => null);
};

// The restore script runs at the start of every document the tab loads until
// it is replaced, and it replaces the origin's localStorage with a snapshot
// taken before the navigation. Applied more than once it destroys what the
// site itself wrote in between: fdj.fr, for instance, writes its session
// state after login, redirects to /?MMEG=true, finds the state gone, signs in
// again, redirects again... a reload loop that never reaches network idle.
// A per-origin marker in sessionStorage (tab-scoped, survives same-origin
// navigations, empty in a new tab) makes each installation apply exactly once
// per origin. The key is random per run so it is not a stable fingerprint;
// the value is the installation number so a newer snapshot applies again.
const __localStorageRestoreMarker = '_' + crypto.randomBytes(8).toString('hex');
let __localStorageRestoreGeneration = 0;

const __installLocalStorageRestore = async function(page) {
  if (!page || !__activeBrowserStorageProfile) return;
  const previous = __localStorageRestoreScriptByPage.get(page);
  if (previous) {
    await page.removeScriptToEvaluateOnNewDocument(previous).catch(() => {});
    __localStorageRestoreScriptByPage.delete(page);
  }
  if (!__activeBrowserStoragePersistLocalStorage) return;
  const snapshot = __normalizeLocalStorageByOrigin(__localStorageByOrigin);
  const generation = String(++__localStorageRestoreGeneration);
  const applySnapshot = (originStorage, marker, applyGeneration) => {
    try {
      const entries = originStorage[window.location.origin];
      if (!entries) return;
      if (window.sessionStorage.getItem(marker) === applyGeneration) return;
      window.localStorage.clear();
      Object.entries(entries).forEach(([key, value]) => window.localStorage.setItem(key, value));
      window.sessionStorage.setItem(marker, applyGeneration);
    } catch (_) {}
  };
  const script = await page.evaluateOnNewDocument(applySnapshot, snapshot, __localStorageRestoreMarker, generation);
  __localStorageRestoreScriptByPage.set(page, script.identifier);
  // The current document only has storage to replace on a web origin; on
  // about:blank or an internal page the evaluate is useless and, under the
  // CDP shim, can hang for the whole default timeout.
  if (!__isWebStoragePage(page)) return;
  await page.evaluate(applySnapshot, snapshot, __localStorageRestoreMarker, generation).catch(() => {});
};

const __captureBrowserStorage = async function(
  profile = __activeBrowserStorageProfile,
  persistLocalStorage = __activeBrowserStoragePersistLocalStorage,
) {
  if (!profile) return false;
  const resolvedProfile = __resolveCookieProfileName(profile);
  const captureDefaultShadow = resolvedProfile !== __defaultCookieProfileName;
  if (persistLocalStorage || captureDefaultShadow) {
    for (const page of await $browser.pages()) {
      if (!__isWebStoragePage(page)) continue;
      const captured = await __capturePageLocalStorage(page);
      if (captured && typeof captured.origin === 'string') {
        __localStorageByOrigin[captured.origin] = captured.entries;
      }
    }
  }
  const cookies = (await $client.send('Network.getAllCookies')).cookies;
  const browserStorage = JSON.stringify({
    version: 1,
    cookies,
    localStorage: persistLocalStorage ? __localStorageByOrigin : {},
  }, null, 2);
  fs.writeFileSync(__cookieProfilePath(resolvedProfile, '$saveCookies'), browserStorage, { mode: 0o600 });
  if (captureDefaultShadow) {
    fs.writeFileSync(__cookieProfilePath(__defaultCookieProfileName, '$saveCookies'), JSON.stringify({
      version: 1,
      cookies,
      localStorage: __localStorageByOrigin,
    }, null, 2), { mode: 0o600 });
  }
  return true;
};

const __captureDefaultBrowserStorage = async function() {
  return __captureBrowserStorage(__defaultCookieProfileName, true);
};
const __shadowSaveDefaultBrowserStorage = async function() {
  try {
    return await __captureDefaultBrowserStorage();
  } catch (error) {
    console.error(
      'Cannot shadow-save the Default browser storage profile:',
      error && error.message ? error.message : error,
    );
    return false;
  }
};

const $saveCookies = async function(profile, options) {
  const resolved = __resolveCookieHelperArguments(profile, options);
  __activeBrowserStorageProfile = resolved.profile;
  __activeBrowserStoragePersistLocalStorage = resolved.persistLocalStorage;
  if (!resolved.persistLocalStorage) __localStorageByOrigin = {};
  __emitAction('cookies', resolved.profile);
  console.debug('Saving browser storage to:', resolved.profile);
  await __captureBrowserStorage(resolved.profile, resolved.persistLocalStorage);
};

/* @help Cookies
 * @sig $loadCookies(profile?, options?)
 * @aliases restore browser session, restore login, reuse cookies
 * @desc Load cookies and restore localStorage before page scripts run. Returns false on error, true on success.
 * @nodal-desc Restore previously saved cookies and localStorage.
 * @nodal-output boolean
 * @opt persistLocalStorage: true
 * @nodal-param profile [cookie-profile]: Browser storage profile to load. Leave empty for "Default".
 * @nodal-param options: Browser storage options.
 * @nodal-param options.persistLocalStorage [boolean]: Restore and continue persisting localStorage. Enabled by default.
 */
const __internalLoadCookies = async function(profile) {
  const resolvedProfile = __resolveCookieProfileName(profile);
  try {
    const storedProfile = await __readCookieProfile(resolvedProfile, '$loadCookies');
    await __restoreCookies(storedProfile.cookies);
    return storedProfile;
  } catch {
    return false;
  }
};
const $loadCookies = async function(profile, options) {
  const resolved = __resolveCookieHelperArguments(profile, options);
  __activeBrowserStorageProfile = resolved.profile;
  __activeBrowserStoragePersistLocalStorage = resolved.persistLocalStorage;
  __emitAction('cookies', resolved.profile);
  console.debug('Loading browser storage from store:', resolved.profile);
  __localStorageByOrigin = {};
  const storedProfile = await __internalLoadCookies(resolved.profile);
  if (!storedProfile) {
    console.error('Cannot load browser storage from store:', resolved.profile);
  } else {
    __localStorageByOrigin = resolved.persistLocalStorage ? storedProfile.localStorage : {};
    console.debug('Successfully loaded browser storage from store:', resolved.profile);
  }
  for (const page of await $browser.pages()) {
    await __installLocalStorageRestore(page);
  }
  return Boolean(storedProfile);
};

const __initializeDefaultBrowserStorage = async function() {
  __activeBrowserStorageProfile = __defaultCookieProfileName;
  __activeBrowserStoragePersistLocalStorage = true;
  __localStorageByOrigin = {};
  const storedProfile = await __internalLoadCookies(__defaultCookieProfileName);
  if (storedProfile) __localStorageByOrigin = storedProfile.localStorage;
  for (const page of await $browser.pages()) {
    await __installLocalStorageRestore(page);
  }
  return Boolean(storedProfile);
};

/* @help Cookies
 * @sig $clearCookies(profile?)
 * @aliases clear browser session, delete cookies, reset cookies
 * @desc Delete the selected stored profile. Also clear current browser cookies and storage when clearing Default or the active profile.
 * @nodal-desc Delete a saved cookie profile and clear it from the current browser when active.
 * @nodal-output void
 * @nodal-param profile [cookie-profile]: Saved browser storage profile to delete. Leave empty for "Default".
 */
const $clearCookies = async function(profile) {
  const resolvedProfile = __resolveCookieProfileName(profile);
  const clearsCurrentBrowserStorage = resolvedProfile === __defaultCookieProfileName
    || resolvedProfile === __activeBrowserStorageProfile;
  __emitAction('cookies', resolvedProfile);
  console.debug('Clearing browser storage profile:', resolvedProfile);

  await fs.promises.unlink(__cookieProfilePath(resolvedProfile, '$clearCookies')).catch(error => {
    if (!error || error.code !== 'ENOENT') throw error;
  });
  if (!clearsCurrentBrowserStorage) return;

  await $client.send('Network.clearBrowserCookies');
  for (const page of await $browser.pages()) {
    if (!__isWebStoragePage(page)) continue;
    await page.evaluate(() => {
      try { window.localStorage.clear(); } catch (_) {}
      try { window.sessionStorage.clear(); } catch (_) {}
    }).catch(() => {});
  }
  __localStorageByOrigin = {};
  __activeBrowserStorageProfile = __defaultCookieProfileName;
  __activeBrowserStoragePersistLocalStorage = true;
  for (const page of await $browser.pages()) {
    await __installLocalStorageRestore(page);
  }
  await __captureDefaultBrowserStorage();
};

