/* @help Cookies
 * @sig $saveCookies(jarName?)
 * @desc Save current page cookies to a JSON file. Default jar name: "default".
 * @nodal-param jarName: Name of the cookie jar to save. Use a simple label like "main" or leave empty for "default".
 */
const __resolveCookieJarName = function(jarName) {
  return typeof jarName === 'string' && jarName.trim() ? jarName.trim() : 'default';
};
const __internalSaveCookies = async function(jarName) {
  const resolvedJarName = __resolveCookieJarName(jarName);
  const cookies = (await $client.send('Network.getAllCookies')).cookies;
  const cookiePath = __resolveArtifactPath(paths.cookies, resolvedJarName + '.json', '$saveCookies path');
  fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2), { mode: 0o600 });
};
const $saveCookies = async function(jarName) {
  const resolvedJarName = __resolveCookieJarName(jarName);
  __emitAction('cookies', resolvedJarName);
  console.debug('Saving cookies to:', resolvedJarName);
  await __internalSaveCookies(resolvedJarName);
};

/* @help Cookies
 * @sig $loadCookies(jarName?)
 * @desc Load cookies from a JSON file and set them on the page. Returns false on error, true on success.
 * @nodal-desc Restore previously saved cookies on the current page.
 * @nodal-output boolean
 * @nodal-param jarName: Name of the cookie jar to load. Leave empty for "default".
 */
const __internalLoadCookies = async function(jarName) {
  const resolvedJarName = __resolveCookieJarName(jarName);
  try {
    const cookiePath = __resolveArtifactPath(paths.cookies, resolvedJarName + '.json', '$loadCookies path');
    const cookiesString = await fs.promises.readFile(cookiePath, 'utf8');
    const cookies = JSON.parse(cookiesString);
    await $page.setCookie(...cookies);
  } catch {
    return false;
  }
  return true;
};
const $loadCookies = async function(jarName) {
  const resolvedJarName = __resolveCookieJarName(jarName);
  __emitAction('cookies', resolvedJarName);
  console.debug('Loading cookies from store:', resolvedJarName);
  const response = await __internalLoadCookies(resolvedJarName);
  if (!response) {
    console.error('Cannot load cookies from store:', resolvedJarName);
  } else {
    console.debug('Successfully loaded cookies from store:', resolvedJarName);
  }
  return response;
};

