/* global __queryPuppetflowLocator, __keyboardSpeedValue:writable, $selectElement, __humanPageOf, __humanJitterMs */

/* @help Interaction
 * @sig $keyboardSpeed(keyboardSpeedValue)
 * @aliases typing speed, keyboard delay
 * @desc Set the default typing speed for subsequent input actions.
 * @nodal-desc Set the typing speed used by subsequent input nodes.
 * @nodal-output number
 * @nodal-param keyboardSpeedValue [number, required]: Delay in milliseconds between keystrokes and low-level input actions.
 */
// The platform's primary accelerator: Cmd on Apple platforms, Ctrl elsewhere
// (Cmd+A / Ctrl+A selects all, Cmd+C / Ctrl+C copies). Read once from the
// page so a spoofed platform stays consistent.
let __primaryModifierCache = null;
const __primaryModifier = async function(handle) {
  if (__primaryModifierCache) return __primaryModifierCache;
  let platform = '';
  try {
    platform = await __humanPageOf(handle).evaluate(() =>
      navigator.platform || (navigator.userAgentData && navigator.userAgentData.platform) || '');
  } catch (_) {}
  __primaryModifierCache = /mac|iphone|ipad|ipod/i.test(platform) ? 'Meta' : 'Control';
  return __primaryModifierCache;
};

const $keyboardSpeed = function(keyboardSpeedValue) {
  const value = Number(keyboardSpeedValue);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Keyboard speed must be a non-negative number');
  }
  __keyboardSpeedValue = value;
  $json.$keyboardSpeed = value;
  console.debug('Keyboard speed set to:', value);
  return value;
};

/* @help Interaction
 * @sig $fillInput(inputSelectorOrHandle, inputValue, options?)
 * @aliases form, field, type, enter text, fill field
 * @desc Replace, append, or prepend text in an input. Handles detached nodes. Selector can be a CSS string or an ElementHandle.
 * @nodal-desc Find an input on the page, then replace, append, or prepend its value.
 * @opt mode: replace, tabCount: 1, sleep: 500, speed: 100, timeout: 30000, continueOnError: false, visibleOnly: false, index: 0
 * @nodal-param inputSelectorOrHandle [string, selector]: CSS selector or ElementHandle for the input to fill.
 * @nodal-param inputValue: Text value to type into the input.
 * @nodal-param options: Input selection and typing options.
 * @nodal-param options.mode [string]: How to apply the value: replace, append, or prepend.
 * @nodal-param options.tabCount [number]: Number of Tab key presses to send after filling the input.
 * @nodal-param options.sleep [number]: Pause duration between low-level browser actions, in milliseconds.
 * @nodal-param options.speed [number]: Typing speed, in milliseconds between keystrokes.
 * @nodal-param options.timeout [number]: Maximum time to wait for the input, in milliseconds.
 * @nodal-param options.continueOnError [boolean]: Continue the flow if the input cannot be found.
 * @nodal-param options.visibleOnly [boolean]: Only use elements visible on the page.
 * @nodal-param options.index [number]: Zero-based position to use when several inputs match.
 */
const $fillInput = async function(inputSelectorOrHandle, inputValue, options) {
  __emitAction('fill', typeof inputSelectorOrHandle === 'string' ? inputSelectorOrHandle : '(element)');
  const defaultOptions = {
    mode: 'replace',
    tabCount: 1,
    sleep: 500,
    speed: __keyboardSpeedValue,
  };
  const {
    mode,
    tabCount,
    sleep,
    speed,
    timeout = 30000,
    continueOnError = false,
    visibleOnly = false,
    index = 0,
  } = { ...defaultOptions, ...(options || {}) };
  if (!['replace', 'append', 'prepend'].includes(mode)) {
    throw new Error('Input mode must be replace, append, or prepend.');
  }
  const selectOptions = { timeout, continueOnError, visibleOnly, index };
  console.debug('Filling input:', inputSelectorOrHandle);

  const result = await __internalSelect(inputSelectorOrHandle, selectOptions);
  if (!result) return;

  let input = result.handle;

  // A field that cannot take focus (LinkedIn renders a 0x0 duplicate of its
  // login form before the real one, some sites keep a display:none copy)
  // would leave the select-all and the keystrokes to the page itself: the
  // whole document gets selected and nothing is typed. Fall back to the
  // first visible match, or stop with a clear reason. Returns the handle to
  // type into, or null when continueOnError swallows the failure.
  const focusInput = async function(handle) {
    if (await __humanTakesFocus(handle)) return handle;

    let replacement = null;
    if (typeof inputSelectorOrHandle === 'string' && !visibleOnly) {
      replacement = await __internalSelect(inputSelectorOrHandle, { ...selectOptions, visibleOnly: true, continueOnError: true });
      if (replacement && !(await __humanTakesFocus(replacement.handle))) replacement = null;
    }
    if (!replacement) {
      if (continueOnError) return null;
      throw new StopRun(
        'Input ' + (typeof inputSelectorOrHandle === 'string' ? inputSelectorOrHandle : '(element)')
        + ' cannot take focus (hidden or disabled). Enable visibleOnly or use a more specific selector.',
      );
    }
    console.debug('Input', inputSelectorOrHandle, 'at index', index, 'cannot take focus (hidden duplicate?); using the first visible match instead');
    return replacement.handle;
  };

  const prepareInput = async function(candidate) {
    const handle = await focusInput(candidate);
    if (!handle) return null;
    // Bring the pointer over the field first, as a person reaching for it
    // would; focus semantics stay those of puppeteer's type() (no click, so
    // no caret move or picker popup).
    await __retryOnContextDestroyed(() => __humanHoverElement(handle)).catch(() => {});
    await __retryOnContextDestroyed(() => handle.focus());
    if (mode === 'replace') {
      // Select all through the real accelerator so the page sees a modified
      // "a" keydown (ctrlKey/metaKey set) instead of a bare "a" that no human
      // would use to clear a field. The selectAll command still guarantees the
      // selection regardless of the browser's own OS shortcut.
      const modifier = await __primaryModifier(handle);
      const keyboard = __humanPageOf(handle).keyboard;
      await keyboard.down(modifier);
      try {
        await handle.press('a', { commands: ['selectAll'], delay: __humanJitterMs(55, 0.5) });
      } finally {
        await keyboard.up(modifier);
      }
      await handle.press('Backspace', { delay: __humanJitterMs(55, 0.5) });
      return handle;
    }
    await __retryOnContextDestroyed(() => handle.evaluate((element, valueMode) => {
      const atStart = valueMode === 'prepend';
      if (typeof element.setSelectionRange === 'function') {
        const position = atStart ? 0 : String(element.value || '').length;
        element.setSelectionRange(position, position);
        return;
      }
      const selection = window.getSelection();
      if (!selection) return;
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(atStart);
      selection.removeAllRanges();
      selection.addRange(range);
    }, mode));
    return handle;
  };
  try {
    input = await prepareInput(input);
  } catch (err) {
    if (err.message.includes('Node is detached') && typeof inputSelectorOrHandle === 'string') {
      const retry = await __internalSelect(inputSelectorOrHandle, selectOptions);
      if (!retry) return;
      input = await prepareInput(retry.handle);
    } else {
      throw err;
    }
  }
  if (!input) return;
  await __internalSleep(sleep);
  await __humanType(input, inputValue, speed);
  if (tabCount) {
    for (let i = 0; i < tabCount; i++) {
      await input.press('Tab', { delay: __humanJitterMs(55, 0.5) });
      await __internalSleep(sleep);
    }
  }
  await __internalSleep(sleep);
};

/* @help Interaction
 * @sig $keyboardPress(text, options?)
 * @aliases type text, keystrokes, type characters, keyboard type, press keys
 * @desc Type text one keystroke at a time into the focused element, or into an element focused first through options.selector. Newlines press Enter. Uses the flow keyboard speed unless options.speed is set.
 * @nodal-desc Type text key by key into the focused element, or into an input selected first.
 * @opt selector: null, speed: 100, timeout: 30000, continueOnError: false, visibleOnly: false, index: 0
 * @nodal-param text [string, required]: Text to type, one keystroke per character. A newline presses Enter.
 * @nodal-param options: Target and typing options.
 * @nodal-param options.selector [string, selector]: Optional CSS selector to focus before typing. Leave empty to type into whatever currently has focus.
 * @nodal-param options.speed [number]: Typing speed, in milliseconds between keystrokes. 0 types instantly.
 * @nodal-param options.timeout [number]: Maximum time to wait for the selector, in milliseconds.
 * @nodal-param options.continueOnError [boolean]: Continue the flow if the selector cannot be found.
 * @nodal-param options.visibleOnly [boolean]: Only use elements visible on the page.
 * @nodal-param options.index [number]: Zero-based position to use when several elements match the selector.
 */
const $keyboardPress = async function(text, options) {
  const {
    selector = null,
    speed = __keyboardSpeedValue,
    timeout = 30000,
    continueOnError = false,
    visibleOnly = false,
    index = 0,
  } = options || {};
  const value = text === null || text === undefined ? '' : String(text);
  __emitAction('type', value);
  console.debug('Typing keys:', value, selector ? 'into ' + selector : 'into the focused element');

  if (typeof selector === 'string' && selector.trim() !== '') {
    const result = await __internalSelect(selector, { timeout, continueOnError, visibleOnly, index });
    if (!result) return;
    await __retryOnContextDestroyed(() => __humanHoverElement(result.handle)).catch(() => {});
    await __humanType(result.handle, value, speed);
    return;
  }
  await __humanKeystrokes($page, value, speed);
};

// Puppeteer key names for the characters a shortcut is usually written with,
// so "cmd+enter" style inputs work without knowing the KeyInput spelling.
const __shortcutKeyAliases = {
  enter: 'Enter', return: 'Enter', tab: 'Tab', esc: 'Escape', escape: 'Escape', space: 'Space', spacebar: 'Space',
  backspace: 'Backspace', delete: 'Delete', del: 'Delete', insert: 'Insert', home: 'Home', end: 'End',
  pageup: 'PageUp', pagedown: 'PageDown', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
  arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight',
};
const __normalizeShortcutKey = function(key) {
  const raw = key === null || key === undefined ? '' : String(key).trim();
  if (raw === '') throw new Error('Keyboard shortcut requires a key (a single character or a key name such as Enter).');
  if ([...raw].length === 1) return raw;
  const alias = __shortcutKeyAliases[raw.toLowerCase()];
  if (alias) return alias;
  if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(raw)) return raw.toUpperCase();
  return raw;
};

/* @help Interaction
 * @sig $keyboardShortcut(key, options?)
 * @aliases hotkey, key combination, press key, ctrl, cmd, shortcut
 * @desc Press one key with optional modifiers held (Cmd/Ctrl, Ctrl, Meta, Shift, Alt). key is a single character or a key name such as Enter, Tab, Escape, ArrowDown or F5. options.cmdOrCtrl holds Cmd on macOS and Ctrl elsewhere.
 * @nodal-desc Press a key while holding the selected modifiers.
 * @opt cmdOrCtrl: false, control: false, meta: false, shift: false, alt: false, repeat: 1
 * @nodal-param key [string, required]: Single character or key name to press (a, Enter, Tab, Escape, ArrowDown, F5).
 * @nodal-param options: Modifiers held while the key is pressed.
 * @nodal-param options.cmdOrCtrl [boolean]: Hold the platform shortcut key: Cmd on macOS, Ctrl elsewhere.
 * @nodal-param options.control [boolean]: Hold Ctrl.
 * @nodal-param options.meta [boolean]: Hold Meta (Cmd on macOS, Windows key elsewhere).
 * @nodal-param options.shift [boolean]: Hold Shift.
 * @nodal-param options.alt [boolean]: Hold Alt (Option on macOS).
 * @nodal-param options.repeat [number]: Number of times to press the shortcut.
 */
const $keyboardShortcut = async function(key, options) {
  const {
    cmdOrCtrl = false,
    control = false,
    meta = false,
    shift = false,
    alt = false,
    repeat = 1,
  } = options || {};
  const pressKey = __normalizeShortcutKey(key);
  const modifiers = [];
  if (cmdOrCtrl) modifiers.push(await __primaryModifier($page));
  if (control && !modifiers.includes('Control')) modifiers.push('Control');
  if (meta && !modifiers.includes('Meta')) modifiers.push('Meta');
  if (shift) modifiers.push('Shift');
  if (alt) modifiers.push('Alt');
  const count = Math.max(1, Math.floor(Number(repeat) || 1));
  const label = [...modifiers, pressKey].join('+');
  __emitAction('shortcut', label);
  console.debug('Pressing shortcut:', label, count > 1 ? 'x' + count : '');

  const keyboard = $page.keyboard;
  for (let iteration = 0; iteration < count; iteration++) {
    for (const modifier of modifiers) await keyboard.down(modifier);
    try {
      await keyboard.press(pressKey, { delay: __humanJitterMs(55, 0.5) });
    } finally {
      for (const modifier of [...modifiers].reverse()) await keyboard.up(modifier);
    }
    if (iteration < count - 1) await __internalSleep(__humanJitterMs(120, 0.4));
  }
};

/* @help Utility
 * @sig $waitForSelectorCondition(cssSelector, readinessCondition, options?)
 * @aliases wait for element state, wait for element
 * @desc Wait for a selector to match a condition.
 * @opt timeout: 10000
 * @nodal-param cssSelector [string, selector]: CSS selector to watch on the page.
 * @nodal-param readinessCondition [function]: JavaScript function or expression that receives each matched element and returns true when ready.
 * @nodal-param options: Wait options.
 * @nodal-param options.timeout [number]: Maximum time to wait before failing, in milliseconds.
 */
const $waitForSelectorCondition = async function(cssSelector, readinessCondition, options = {}) {
  __emitAction('waitSelector', cssSelector);
  const isDeepSelector = cssSelector.includes('>>>') || cssSelector.includes('>>iframe>>');
  const defaultOptions = {
    timeout: isDeepSelector ? 5000 : 10000,
  };
  const opts = { ...defaultOptions, ...(options || {}) };
  const { timeout } = opts;
  console.debug('Waiting for selector:', cssSelector, 'with condition:', readinessCondition);
  try {
    if (isDeepSelector) {
      const conditionSource = readinessCondition.toString();
      const startedAt = Date.now();
      while (Date.now() - startedAt <= timeout) {
        const candidates = await __retryOnContextDestroyed(() => __queryPuppetflowLocator(cssSelector));
        for (const candidate of candidates) {
          const ready = await candidate.evaluate((element, source) => {
            const condition = (0, eval)('(' + source + ')');
            return Boolean(condition(element));
          }, conditionSource);
          if (ready) return;
        }
        await __internalSleep(100);
      }
      throw new Error('Waiting for selector condition `' + cssSelector + '` failed: timeout ' + timeout + 'ms exceeded');
    }
    await __retryOnContextDestroyed(() => $page.waitForFunction(
      () => [...document.querySelectorAll(cssSelector)].some(selection => readinessCondition(selection)),
      { timeout }
    ));
  } catch (error) {
    __emitAction('timeout', cssSelector);
    console.error('Error waiting for selector:', cssSelector, 'with condition:', readinessCondition);
    throw error;
  }
};

/* @help Selectors
 * @sig $selectShadow(cssSelector, shadowRootSelector?, options?)
 * @aliases find shadow element, select shadow dom
 * @desc Traverse open shadow DOM roots to find an element matching selector. Returns ElementHandle or null.
 * @nodal-desc Find an element inside open shadow DOM areas.
 * @nodal-output element
 * @opt timeout: 5000, continueOnError: true, textMatch: null, textFilter: contains, textCaseSensitive: false, visibleOnly: false, index: 0
 * @nodal-param cssSelector [string, selector]: CSS selector to find inside open shadow DOM roots.
 * @nodal-param shadowRootSelector [string]: Optional CSS selector that limits the search to a specific root.
 * @nodal-param options: Element selection options.
 * @nodal-param options.timeout [number]: Maximum time to wait for the element, in milliseconds.
 * @nodal-param options.continueOnError [boolean]: Return null instead of stopping the flow when no element matches.
 * @nodal-param options.textMatch [string]: Text to match against the element's visible text.
 * @nodal-param options.textFilter [string]: Text filter mode: contains, exact, startsWith, or endsWith.
 * @nodal-param options.textCaseSensitive [boolean]: Preserve letter casing when matching text.
 * @nodal-param options.visibleOnly [boolean]: Only use elements visible on the page.
 * @nodal-param options.index [number]: Zero-based position to use when several elements match.
 */
const $selectShadow = async function(cssSelector, shadowRootSelector, options = {}) {
  console.debug('Shadow selecting:', cssSelector, 'with shadowRootSelector:', shadowRootSelector);
  if (cssSelector.includes('>>>') || cssSelector.includes('>>iframe>>')) {
    return $selectElement(cssSelector, options);
  }

  const { timeout = 5000, continueOnError = true, ...selectionOptions } = options || {};
  const startedAt = Date.now();
  let firstAttempt = true;
  while (firstAttempt || Date.now() - startedAt <= timeout) {
    firstAttempt = false;
    const collectionHandle = await __retryOnContextDestroyed(() => $page.evaluateHandle((sel, rootSel) => {
      const matches = [];
      const visitedRoots = new Set();
      const collect = root => {
        if (!root || visitedRoots.has(root)) return;
        visitedRoots.add(root);
        matches.push(...(root.querySelectorAll?.(sel) || []));

        if (root.shadowRoot) collect(root.shadowRoot);
        for (const element of root.querySelectorAll?.('*') || []) {
          if (element.shadowRoot) collect(element.shadowRoot);
        }
      };

      collect(rootSel ? (document.querySelector(rootSel) || document) : document);
      return matches;
    }, cssSelector, shadowRootSelector));
    const properties = await collectionHandle.getProperties();
    const candidates = [];
    for (const property of properties.values()) {
      const element = property.asElement?.();
      if (element) candidates.push(element);
      else await property.dispose();
    }
    await collectionHandle.dispose();

    const result = await __internalSelect(candidates, {
      ...selectionOptions,
      continueOnError: true,
    });
    if (result) return result.handle;
    if (Date.now() - startedAt >= timeout) break;
    await __internalSleep(Math.min(100, Math.max(10, timeout)));
  }

  if (!continueOnError) {
    await __internalSelect([], {
      ...selectionOptions,
      continueOnError: false,
    });
  }
  return null;
};

/* @help Interaction
 * @sig $shadowInputFill(inputSelector, inputValue, options?)
 * @aliases form, field, type, fill shadow input, enter shadow text
 * @desc Fill an input located inside shadow DOM. Options extend $fillInput options + rootSelector.
 * @nodal-desc Fill an input located inside a shadow DOM area.
 * @opt rootSelector: null, mode: replace, tabCount: 1, sleep: 500, speed: 100, timeout: 5000, continueOnError: false, visibleOnly: false, index: 0
 * @nodal-param inputSelector [string, selector]: CSS selector for the input inside a shadow DOM.
 * @nodal-param inputValue: Text value to type into the input.
 * @nodal-param options: Shadow DOM and typing options.
 * @nodal-param options.rootSelector [string]: Optional CSS selector for the shadow root container.
 * @nodal-param options.mode [string]: How to apply the value: replace, append, or prepend.
 * @nodal-param options.tabCount [number]: Number of Tab key presses to send after filling the input.
 * @nodal-param options.sleep [number]: Pause duration between low-level browser actions, in milliseconds.
 * @nodal-param options.speed [number]: Typing speed, in milliseconds between keystrokes.
 * @nodal-param options.timeout [number]: Maximum time to wait for the input, in milliseconds.
 * @nodal-param options.continueOnError [boolean]: Continue the flow if the input cannot be found.
 * @nodal-param options.visibleOnly [boolean]: Only use elements visible on the page.
 * @nodal-param options.index [number]: Zero-based position to use when several inputs match.
 */
const $shadowInputFill = async function(inputSelector, inputValue, options = {}) {
  __emitAction('fill', inputSelector);
  console.debug('Shadow filling input:', inputSelector);
  const {
    rootSelector,
    mode = 'replace',
    tabCount = 1,
    sleep = 500,
    speed = __keyboardSpeedValue,
    timeout = 5000,
    continueOnError = false,
    visibleOnly = false,
    index = 0,
  } = options || {};
  const input = await $selectShadow(inputSelector, rootSelector, {
    timeout,
    continueOnError,
    visibleOnly,
    index,
  });
  if (!input) {
    return null;
  }
  await $fillInput(input, inputValue, { mode, tabCount, sleep, speed });
  return true;
};

