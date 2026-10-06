/* @help Navigation
 * @sig $screenshot(screenshotName?, options?)
 * @aliases capture screen, take screenshot, screen capture
 * @desc Take a viewport or full-page screenshot. If no name given, auto-increments (screenshot_00, screenshot_01...).
 * @nodal-desc Capture the current viewport or full page as a screenshot artifact.
 * @opt output: true, fullPage: false
 * @nodal-param screenshotName [string]: Screenshot filename or label. Leave empty to auto-generate a name.
 * @nodal-param options [object]: Screenshot options.
 * @nodal-param options.output [boolean]: Include this screenshot in the flow output artifacts.
 * @nodal-param options.fullPage [boolean]: Capture the entire page instead of only the current viewport. Defaults to false.
 * @nodal-param options.viewportWidth [integer]: Temporary viewport width in pixels for this screenshot.
 * @nodal-param options.viewportHeight [integer]: Temporary viewport height in pixels for this screenshot. Ignored for full-page captures.
 */
const $screenshot = async function(screenshotName, options = {}) {
  __emitAction('screenshot', typeof screenshotName === 'string' ? screenshotName : '');
  let shotname = screenshotName;
  if (typeof screenshotName === 'object' && screenshotName !== null) {
    options = screenshotName;
    shotname = null;
  }
  const defaultOptions = {
    output: true,
    fullPage: false,
  };
  const opts = { ...defaultOptions, ...(options || {}) };
  if (!shotname) {
    shotname = 'screenshot_' + SCREENSHOT_CPT.toString().padStart(2, '0');
    SCREENSHOT_CPT++;
  }
  if (typeof shotname !== 'string') {
    throw new Error('$screenshot: screenshot name must be a string');
  }
  console.debug('Taking screenshot:', shotname);
  const _shotRelativePath = shotname + '.png';
  const _shotPath = __resolveArtifactPath(paths.screenshots, _shotRelativePath, '$screenshot path');
  const _shotDir = path.dirname(_shotPath);
  if (_shotDir !== paths.screenshots) {
    fs.mkdirSync(_shotDir, { recursive: true });
  }
  const originalViewport = $page.viewport();
  const parseViewportDimension = (name, value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const dimension = Number(value);
    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new Error('$screenshot: ' + name + ' must be a positive integer');
    }
    return dimension;
  };
  const viewportWidth = parseViewportDimension('viewportWidth', opts.viewportWidth);
  const viewportHeight = opts.fullPage
    ? undefined
    : parseViewportDimension('viewportHeight', opts.viewportHeight);
  const shouldResizeViewport = originalViewport
    && (viewportWidth !== undefined || viewportHeight !== undefined);

  try {
    if (shouldResizeViewport) {
      await $page.setViewport({
        ...originalViewport,
        width: viewportWidth ?? originalViewport.width,
        height: viewportHeight ?? originalViewport.height,
      });
    }
    await __retryOnContextDestroyed(() => $page.screenshot({
      path: _shotPath,
      fullPage: Boolean(opts.fullPage),
    }));
  } finally {
    if (shouldResizeViewport && !$page.isClosed()) {
      await $page.setViewport(originalViewport).catch(() => {});
    }
  }
  if (!opts.output) {
    _artifactExcluded.screenshots.add(_shotRelativePath);
  }
};

/* @help Utility
 * @sig $sleep(milliseconds)
 * @aliases wait, pause flow, wait delay
 * @desc Async sleep for the given milliseconds.
 * @nodal-desc Pause the flow for a fixed duration.
 * @nodal-param milliseconds [integer]: Time to wait before continuing, in milliseconds.
 */
const __internalSleep = async function(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
};
const $sleep = async function(milliseconds) {
  __emitAction('sleep', ((milliseconds/1000).toFixed(1)+'s'));
  console.debug('Waiting', ((milliseconds/1000).toFixed(2)+'s') + '...');
  await __internalSleep(milliseconds);
};

/* @help Utility
 * @sig $matchSequence(sourceItems, sequencePatterns)
 * @aliases match ordered sequence, find sequence
 * @desc Find the first consecutive sequence in items where each element matches the corresponding regex. With 1 pattern returns the matching string, with N patterns returns an array of N consecutive matches. Returns null if no match.
 * @nodal-desc Find a consecutive sequence of values that matches one or more patterns.
 * @nodal-output unknown
 * @nodal-param sourceItems [array]: Array of strings to search through.
 * @nodal-param sequencePatterns [array]: One or more regex patterns to match in sequence.
 */
const $matchSequence = function(sourceItems, sequencePatterns) {
  if (!sourceItems || !sequencePatterns || sequencePatterns.length === 0) return null;
  const regexes = sequencePatterns.map(p => (p instanceof RegExp) ? p : new RegExp(p));
  const len = regexes.length;
  for (let i = 0; i <= sourceItems.length - len; i++) {
    let ok = true;
    for (let j = 0; j < len; j++) {
      if (!regexes[j].test(sourceItems[i + j])) { ok = false; break; }
    }
    if (ok) {
      return len === 1 ? sourceItems[i] : sourceItems.slice(i, i + len);
    }
  }
  return null;
};

/* @help Utility
 * @sig $log(...messages)
 * @aliases write log, console message, debug message
 * @desc Log messages to the run console for output tracing.
 * @nodal-desc Add messages to the run logs.
 * @nodal-param messages: One or more values to write to the run logs.
 */
const $log = function(...messages) {
  __emitAction('log', __formatActionLabel(...messages).slice(0, 500));
  console.log(...messages);
};

/* @help Utility
 * @sig $legend(legendText)
 * @aliases set run legend, label run, name run
 * @desc Set a legend/caption for this run. Displayed wherever the run appears.
 * @nodal-param legendText [string]: Human-readable caption shown on this run.
 */
const $legend = function(legendText) {
  __emitAction('legend', String(legendText));
  $json.$context.legend = String(legendText);
  console.debug('Legend set: ' + String(legendText));
};

/* @help Utility
 * @sig $meta(metadata)
 * @aliases run metadata, tag run
 * @desc Put meta data to filter runs by. Markdown is supported.
 * @nodal-param metadata [custom-object, required]: Metadata keys to store on the run. Use Form for named metadata, or JSON for an object.
 */
const $meta = function(metadataKey, metadataValue) {
  if (metadataKey && typeof metadataKey === 'object' && !Array.isArray(metadataKey)) {
    __emitAction('meta', Object.entries(metadataKey).map(([k, v]) => k + ': ' + v).join(', '));
    console.debug('Setting meta:', Object.entries(metadataKey).map(([k, v]) => k + ': ' + v).join(', '));
  } else {
    __emitAction('meta', metadataValue !== undefined ? metadataKey + ': ' + metadataValue : String(metadataKey));
    console.debug('Setting meta:', metadataKey, 'with value:', metadataValue);
  }
  if (metadataKey && typeof metadataKey === 'object' && !Array.isArray(metadataKey)) {
    for (const k in metadataKey) {
      if (Object.prototype.hasOwnProperty.call(metadataKey, k)) {
        $json.$context.meta = { ...$json.$context.meta, [k]: metadataKey[k] };
      }
    }
    return;
  }
  $json.$context.meta = { ...$json.$context.meta, [metadataKey]: metadataValue };
};

/* @help Response
 * @sig $setOutput(outputKeyOrObject, outputValue?)
 * @aliases output variable, add output field, set result
 * @desc Add data to the response output. Pass an object to merge multiple keys, or a key + value pair.
 * @nodal-desc Add one or more values to the final run output.
 * @nodal-param outputKeyOrObject: Output key to set, or an object containing several output keys.
 * @nodal-param outputValue: Value to store when the first input is a single key.
 */
const __setOutputProperty = function(key, value) {
  Object.defineProperty(_outputData, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
};

const $setOutput = function(outputKeyOrObject, outputValue) {
  __emitAction('set', outputKeyOrObject && typeof outputKeyOrObject === 'object' && !Array.isArray(outputKeyOrObject) ? Object.keys(outputKeyOrObject).join(', ') : String(outputKeyOrObject));
  if (outputKeyOrObject && typeof outputKeyOrObject === 'object' && !Array.isArray(outputKeyOrObject)) {
    for (const key of Reflect.ownKeys(outputKeyOrObject)) {
      const descriptor = Object.getOwnPropertyDescriptor(outputKeyOrObject, key);
      if (!descriptor?.enumerable) continue;
      __setOutputProperty(key, 'value' in descriptor ? descriptor.value : Reflect.get(outputKeyOrObject, key));
    }
    return;
  }
  __setOutputProperty(outputKeyOrObject, outputValue);
};

