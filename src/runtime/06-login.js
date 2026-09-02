/* @help Navigation
 * @sig $loginRemember(options)
 * @aliases remembered login, persistent login, reuse session
 * @desc Login remember function. Saves cookies to a JSON file and loads them back on the next run.
 * @nodal-desc Reuse saved login cookies, or run the login steps again when the session is expired.
 * @opt loginUrl: null, loginRecipe: null, loggedUrl: null, loggedMarkerCondition: null, loggedMarkerConditionRaw: null, loggedMarkerTimeout: 5000, password: $input.password
 * @nodal-param options: Login settings used when saved cookies are missing or expired.
 * @nodal-param options.loginUrl [string, required]: URL of the login page.
 * @nodal-param options.loginRecipe [flow, required]: Flow used to perform the login.
 * @nodal-param options.loggedUrl [string, required]: URL to visit when checking whether the session is already logged in.
 * @nodal-param options.loggedMarkerCondition [object, logged-marker-condition]: Selector condition evaluated in the page context to detect the logged-in page.
 * @nodal-param options.loggedMarkerCondition.selector [string, selector, required]: CSS selector used to find the logged-in marker.
 * @nodal-param options.loggedMarkerCondition.textMatch [string]: Text to match against each selected element.
 * @nodal-param options.loggedMarkerCondition.textFilter [string]: Text filter mode: contains, exact, startsWith, or endsWith.
 * @nodal-param options.loggedMarkerCondition.textCaseSensitive [boolean]: Preserve letter casing when matching text.
 * @nodal-param options.loggedMarkerCondition.operator [string]: Comparison applied to the number of matching elements. Defaults to exists.
 * @nodal-param options.loggedMarkerCondition.count [number]: Expected element count used by count comparison operators.
 * @nodal-param options.loggedMarkerConditionRaw [code]: Function evaluated directly in the flow context to detect the logged-in page. Use this raw variant when the check needs Puppetflow variables or helpers unavailable in the page context.
 * @nodal-placeholder options.loggedMarkerConditionRaw: async () => {
 *   return Boolean(await $page.$('a[href="/logout"]'));
 * }
 * @nodal-one-of options.loggedMarkerCondition, options.loggedMarkerConditionRaw
 * @nodal-param options.loggedMarkerTimeout [number]: Maximum time to wait for the logged-in marker, in milliseconds.
 * @nodal-param options.password [string]: Password or expression used by the login recipe.
 * @site-url options.loginRecipe: options.loginUrl, options.loggedUrl
 * @site-url output: options.loggedUrl, options.loginUrl
 */
const $loginRemember = async function(options = {}) {
  __emitAction('login', options?.loginUrl || '');
  const defaultOptions = {
    loginUrl: null,
    loginRecipe: null,
    loggedUrl: null,
    loggedMarkerCondition: null,
    loggedMarkerConditionRaw: null,
    loggedMarkerTimeout: 5000,
    gotoOptions: { waitUntil: 'domcontentloaded' }
  };
  const opts = { ...defaultOptions, ...(options || {}) };
  const gotoOpts = { ...defaultOptions.gotoOptions, ...(opts.gotoOptions || {}) };
  const markerConditionOperators = [
    'exists',
    'doesNotExist',
    'equals',
    'notEquals',
    'greaterThan',
    'greaterThanOrEqual',
    'lessThan',
    'lessThanOrEqual'
  ];
  const markerNumberOperators = markerConditionOperators.slice(2);
  if (!opts.loginUrl) {
    throw new Error('Login remember requires a loginUrl');
  }
  if (!opts.loginRecipe) {
    throw new Error('Login remember requires a loginRecipe function');
  }
  if (opts.loggedMarkerCondition && opts.loggedMarkerConditionRaw) {
    throw new Error('Login remember accepts only one logged marker condition');
  }
  if (!opts.loggedMarkerCondition && !opts.loggedMarkerConditionRaw) {
    throw new Error('Login remember requires a loggedMarkerCondition or loggedMarkerConditionRaw');
  }
  if (opts.loggedMarkerCondition) {
    const textFilter = opts.loggedMarkerCondition.textFilter || 'contains';
    if (!['contains', 'exact', 'startsWith', 'endsWith'].includes(textFilter)) {
      throw new Error('Login remember loggedMarkerCondition has an invalid textFilter');
    }
    opts.loggedMarkerCondition = {
      ...opts.loggedMarkerCondition,
      operator: opts.loggedMarkerCondition.operator || 'exists',
      textMatch: opts.loggedMarkerCondition.textMatch == null
        ? null
        : String(opts.loggedMarkerCondition.textMatch).trim(),
      textFilter,
      textCaseSensitive: opts.loggedMarkerCondition.textCaseSensitive === true
    };
    const { selector, operator, count } = opts.loggedMarkerCondition;
    if (typeof selector !== 'string' || !selector.trim()) {
      throw new Error('Login remember loggedMarkerCondition requires a selector');
    }
    if (!markerConditionOperators.includes(operator)) {
      throw new Error('Login remember loggedMarkerCondition has an invalid operator');
    }
    if (markerNumberOperators.includes(operator) && (!Number.isInteger(count) || count < 0)) {
      throw new Error('Login remember loggedMarkerCondition requires a non-negative integer count');
    }
  }
  if (opts.loggedMarkerConditionRaw && typeof opts.loggedMarkerConditionRaw !== 'function') {
    throw new Error('Login remember loggedMarkerConditionRaw must be a function');
  }
  if (!opts.loggedUrl) {
    opts.loggedUrl = opts.url;
    console.debug('Login remember does not know the loggedUrl, using url as loggedUrl');
  }
  await __internalLoadCookies('_loginRemember');
  await $gotoUrl(opts.loggedUrl, __getActiveTabName(), gotoOpts);
  const $waitForLoggedMarker = async function() {
    try {
      if (opts.loggedMarkerConditionRaw) {
        console.debug('Waiting for logged marker using loggedMarkerConditionRaw');
        const loggedMarkerValidated = await __retryOnContextDestroyed(
          () => opts.loggedMarkerConditionRaw()
        );
        if (typeof loggedMarkerValidated !== 'boolean') {
          throw new Error('loggedMarkerConditionRaw must return a boolean');
        }
        if (!loggedMarkerValidated) { throw new Error(); }
      } else {
        console.debug('Waiting for logged marker during', ((opts.loggedMarkerTimeout / 1000).toFixed(0) + 's...'));
        await __retryOnContextDestroyed(() => $page.waitForFunction(
          ({ selector, textMatch, textFilter, textCaseSensitive, operator, count }) => {
            const expectedText = textMatch
              ? (textCaseSensitive ? textMatch : textMatch.toLocaleLowerCase())
              : '';
            const matches = Array.from(document.querySelectorAll(selector))
              .filter(element => {
                if (!expectedText) return true;
                const elementText = String(element.innerText || element.textContent || '').trim();
                const candidate = textCaseSensitive ? elementText : elementText.toLocaleLowerCase();
                if (textFilter === 'exact') return candidate === expectedText;
                if (textFilter === 'startsWith') return candidate.startsWith(expectedText);
                if (textFilter === 'endsWith') return candidate.endsWith(expectedText);
                return candidate.includes(expectedText);
              })
              .length;
            switch (operator) {
              case 'exists': return matches > 0;
              case 'doesNotExist': return matches === 0;
              case 'equals': return matches === count;
              case 'notEquals': return matches !== count;
              case 'greaterThan': return matches > count;
              case 'greaterThanOrEqual': return matches >= count;
              case 'lessThan': return matches < count;
              case 'lessThanOrEqual': return matches <= count;
              default: return false;
            }
          },
          { timeout: opts.loggedMarkerTimeout },
          opts.loggedMarkerCondition
        ));
      }
    } catch (error) {
      __emitAction('timeout', 'loggedMarker');
      throw new Error('Logged marker not found');
    }
  };
  const runLoginRecipe = async () => {
    await $gotoUrl(opts.loginUrl, __getActiveTabName(), gotoOpts);
    await opts.loginRecipe();
    await $waitForLoggedMarker();
    await __internalSaveCookies('_loginRemember');
  };
  try {
    await $waitForLoggedMarker();
  } catch (error) {
    await runLoginRecipe();
  }
};

