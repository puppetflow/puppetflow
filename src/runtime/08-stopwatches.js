/* global performance */

const __stopwatches = new Map();

const __normalizeStopwatchName = function(stopwatchName, helperName) {
  if (typeof stopwatchName !== 'string' || !stopwatchName.trim()) {
    throw new TypeError(helperName + ': stopwatchName must be a non-empty string.');
  }

  const normalized = stopwatchName.trim();
  const hasControlCharacter = Array.from(normalized)
    .some(character => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127);
  if (normalized.length > 128 || hasControlCharacter) {
    throw new TypeError(helperName + ': stopwatchName must be at most 128 characters and cannot contain control characters.');
  }

  return normalized;
};

const __getStopwatch = function(stopwatchName, helperName) {
  const normalizedName = __normalizeStopwatchName(stopwatchName, helperName);
  const stopwatch = __stopwatches.get(normalizedName);
  if (!stopwatch) {
    throw new Error(helperName + ': stopwatch "' + normalizedName + '" does not exist.');
  }

  return stopwatch;
};

const __getStopwatchElapsedMilliseconds = function(stopwatch) {
  return Math.floor(stopwatch.running
    ? stopwatch.elapsedMilliseconds + performance.now() - stopwatch.startedAt
    : stopwatch.elapsedMilliseconds);
};

/* @help Utility
 * @sig $stopwatchStart(stopwatchName?)
 * @aliases start timer, begin stopwatch
 * @desc Start or resume a named stopwatch and return its current elapsed time in milliseconds.
 * @nodal-desc Start or resume a named stopwatch without resetting its elapsed time.
 * @nodal-output number
 * @nodal-param stopwatchName [stopwatch-name]: Name of the stopwatch profile to start. Defaults to default.
 */
const $stopwatchStart = function(stopwatchName = 'default') {
  const normalizedName = __normalizeStopwatchName(stopwatchName, '$stopwatchStart');
  const existingStopwatch = __stopwatches.get(normalizedName);
  if (existingStopwatch) {
    if (!existingStopwatch.running) {
      existingStopwatch.startedAt = performance.now();
      existingStopwatch.running = true;
    }
  } else {
    __stopwatches.set(normalizedName, {
      name: normalizedName,
      startedAt: performance.now(),
      elapsedMilliseconds: 0,
      running: true,
    });
  }
  console.debug('Stopwatch Start "' + normalizedName + '"');
  return __getStopwatchElapsedMilliseconds(__stopwatches.get(normalizedName));
};

/* @help Utility
 * @sig $stopwatchStop(stopwatchName?, options?)
 * @aliases stop timer, end stopwatch
 * @desc Stop a named stopwatch and return its elapsed time in milliseconds. The elapsed time remains available unless reset is enabled.
 * @nodal-desc Stop a named stopwatch and optionally reset its elapsed time.
 * @nodal-output number
 * @opt reset: false
 * @nodal-param stopwatchName [stopwatch-name]: Existing stopwatch profile to stop. Defaults to default.
 * @nodal-param options: Stopwatch stop options.
 */
const $stopwatchStop = function(stopwatchName = 'default', options = {}) {
  if (stopwatchName && typeof stopwatchName === 'object' && !Array.isArray(stopwatchName)) {
    options = stopwatchName;
    stopwatchName = 'default';
  }
  if (options === undefined || options === null) options = {};
  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('$stopwatchStop: options must be an object.');
  }
  if (options.reset !== undefined && typeof options.reset !== 'boolean') {
    throw new TypeError('$stopwatchStop: options.reset must be a boolean.');
  }

  const stopwatch = __getStopwatch(stopwatchName, '$stopwatchStop');
  if (stopwatch.running) {
    stopwatch.elapsedMilliseconds = __getStopwatchElapsedMilliseconds(stopwatch);
    stopwatch.running = false;
  }
  const elapsedMilliseconds = stopwatch.elapsedMilliseconds;
  console.debug('Stopwatch Stop "' + stopwatch.name + '": ' + elapsedMilliseconds + ' ms');
  if (options.reset === true) {
    stopwatch.elapsedMilliseconds = 0;
  }
  return elapsedMilliseconds;
};

/* @help Utility
 * @sig $stopwatchCheck(stopwatchName?)
 * @aliases check timer, elapsed time, read stopwatch
 * @desc Return the elapsed time of a named stopwatch in milliseconds without stopping it.
 * @nodal-desc Check a named stopwatch without stopping it and return its elapsed time in milliseconds.
 * @nodal-output number
 * @nodal-param stopwatchName [stopwatch-name]: Existing stopwatch profile to check. Defaults to default.
 */
const $stopwatchCheck = function(stopwatchName = 'default') {
  const stopwatch = __getStopwatch(stopwatchName, '$stopwatchCheck');
  const elapsedMilliseconds = __getStopwatchElapsedMilliseconds(stopwatch);
  console.debug('Stopwatch Check "' + stopwatch.name + '": ' + elapsedMilliseconds + ' ms');
  return elapsedMilliseconds;
};
