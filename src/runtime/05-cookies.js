/* @help Cookies
 * @sig $saveCookies(jarName?, options?)
 * @aliases save browser session, persist login, store cookies
 * @desc Save browser cookies and localStorage by origin. Default jar name: "Default".
 * @nodal-desc Save cookies and localStorage for reuse in later runs.
 * @opt persistLocalStorage: true
 * @nodal-param jarName [cookie-jar]: Name of the browser storage jar to save. Use a simple label like "main" or leave empty for "Default".
 * @nodal-param options: Browser storage options.
 * @nodal-param options.persistLocalStorage [boolean]: Save localStorage with cookies. Enabled by default.
 */
const __resolveCookieJarName = function(jarName) {
  return typeof jarName === 'string' && jarName.trim() ? jarName.trim() : 'Default';
};
const __resolveCookieHelperArguments = function(jarName, options) {
  if (jarName && typeof jarName === 'object' && !Array.isArray(jarName)) {
    options = jarName;
    jarName = undefined;
  }
  const resolvedOptions = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
  return {
    jarName: __resolveCookieJarName(jarName),
    persistLocalStorage: resolvedOptions.persistLocalStorage !== false,
  };
};
let __activeBrowserStorageJarName = null;
let __activeBrowserStoragePersistLocalStorage = true;
let __localStorageByOrigin = {};
const __localStorageRestoreScriptByPage = new WeakMap();

const __cookieJarPath = function(jarName, helperName) {
  return __resolveArtifactPath(paths.cookies, __resolveCookieJarName(jarName) + '.json', helperName + ' path');
};

const __normalizeLocalStorageByOrigin = function(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([origin, entries]) => {
    if (typeof origin !== 'string' || !entries || typeof entries !== 'object' || Array.isArray(entries)) return [];
    return [[origin, Object.fromEntries(Object.entries(entries)
      .filter(([key, item]) => typeof key === 'string' && typeof item === 'string'))]];
  }));
};

const __readCookieJar = async function(jarName, helperName) {
  let content;
  try {
    content = await fs.promises.readFile(__cookieJarPath(jarName, helperName), 'utf8');
  } catch (error) {
    if (jarName !== 'Default' || !error || error.code !== 'ENOENT') throw error;
    content = await fs.promises.readFile(__cookieJarPath('default', helperName), 'utf8');
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

const __installLocalStorageRestore = async function(page) {
  if (!page || !__activeBrowserStorageJarName) return;
  const previous = __localStorageRestoreScriptByPage.get(page);
  if (previous) {
    await page.removeScriptToEvaluateOnNewDocument(previous).catch(() => {});
    __localStorageRestoreScriptByPage.delete(page);
  }
  if (!__activeBrowserStoragePersistLocalStorage) return;
  const snapshot = __normalizeLocalStorageByOrigin(__localStorageByOrigin);
  const applySnapshot = originStorage => {
    try {
      const entries = originStorage[window.location.origin];
      if (!entries) return;
      window.localStorage.clear();
      Object.entries(entries).forEach(([key, value]) => window.localStorage.setItem(key, value));
    } catch (_) {}
  };
  const script = await page.evaluateOnNewDocument(applySnapshot, snapshot);
  __localStorageRestoreScriptByPage.set(page, script.identifier);
  await page.evaluate(applySnapshot, snapshot).catch(() => {});
};

const __captureBrowserStorage = async function(
  jarName = __activeBrowserStorageJarName,
  persistLocalStorage = __activeBrowserStoragePersistLocalStorage,
) {
  if (!jarName) return false;
  const resolvedJarName = __resolveCookieJarName(jarName);
  if (persistLocalStorage) {
    for (const page of await $browser.pages()) {
      const captured = await __capturePageLocalStorage(page);
      if (captured && typeof captured.origin === 'string') {
        __localStorageByOrigin[captured.origin] = captured.entries;
      }
    }
  }
  const cookies = (await $client.send('Network.getAllCookies')).cookies;
  fs.writeFileSync(__cookieJarPath(resolvedJarName, '$saveCookies'), JSON.stringify({
    version: 1,
    cookies,
    localStorage: persistLocalStorage ? __localStorageByOrigin : {},
  }, null, 2), { mode: 0o600 });
  return true;
};

const __internalSaveCookies = async function(jarName) {
  const resolvedJarName = __resolveCookieJarName(jarName);
  const cookies = (await $client.send('Network.getAllCookies')).cookies;
  fs.writeFileSync(__cookieJarPath(resolvedJarName, '$saveCookies'), JSON.stringify(cookies, null, 2), { mode: 0o600 });
};
const $saveCookies = async function(jarName, options) {
  const resolved = __resolveCookieHelperArguments(jarName, options);
  __activeBrowserStorageJarName = resolved.jarName;
  __activeBrowserStoragePersistLocalStorage = resolved.persistLocalStorage;
  if (!resolved.persistLocalStorage) __localStorageByOrigin = {};
  __emitAction('cookies', resolved.jarName);
  console.debug('Saving browser storage to:', resolved.jarName);
  await __captureBrowserStorage(resolved.jarName, resolved.persistLocalStorage);
};

/* @help Cookies
 * @sig $loadCookies(jarName?, options?)
 * @aliases restore browser session, restore login, reuse cookies
 * @desc Load cookies and restore localStorage before page scripts run. Returns false on error, true on success.
 * @nodal-desc Restore previously saved cookies and localStorage.
 * @nodal-output boolean
 * @opt persistLocalStorage: true
 * @nodal-param jarName [cookie-jar]: Name of the browser storage jar to load. Leave empty for "Default".
 * @nodal-param options: Browser storage options.
 * @nodal-param options.persistLocalStorage [boolean]: Restore and continue persisting localStorage. Enabled by default.
 */
const __internalLoadCookies = async function(jarName) {
  const resolvedJarName = __resolveCookieJarName(jarName);
  try {
    const jar = await __readCookieJar(resolvedJarName, '$loadCookies');
    await __restoreCookies(jar.cookies);
    return jar;
  } catch {
    return false;
  }
};
const $loadCookies = async function(jarName, options) {
  const resolved = __resolveCookieHelperArguments(jarName, options);
  __activeBrowserStorageJarName = resolved.jarName;
  __activeBrowserStoragePersistLocalStorage = resolved.persistLocalStorage;
  __emitAction('cookies', resolved.jarName);
  console.debug('Loading browser storage from store:', resolved.jarName);
  __localStorageByOrigin = {};
  const jar = await __internalLoadCookies(resolved.jarName);
  if (!jar) {
    console.error('Cannot load browser storage from store:', resolved.jarName);
  } else {
    __localStorageByOrigin = resolved.persistLocalStorage ? jar.localStorage : {};
    console.debug('Successfully loaded browser storage from store:', resolved.jarName);
  }
  for (const page of await $browser.pages()) {
    await __installLocalStorageRestore(page);
  }
  return Boolean(jar);
};

