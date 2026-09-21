/*
 * Browser audio capture for the live view and the run recording.
 *
 * Headless Chromium has no audio device, so the sound a page plays cannot be
 * grabbed from the OS. Instead, a script injected in every document taps the
 * Web Audio graph and the media elements of the page, mixes them into a single
 * mono PCM stream and queues 16-bit chunks that the runner pulls with
 * Runtime.evaluate long-polls. Pulling is deliberate: anti-detection Chromium
 * builds (CloakBrowser and friends) strip CDP bindings and page console events,
 * while evaluate always works. The runner then forwards the chunks to the
 * stream relay (live view) and to the recording encoder (mp4 audio track).
 *
 * Limitations: audio from cross-origin <audio>/<video> sources served without
 * CORS headers is muted by the browser when routed through Web Audio, so such
 * media is captured as silence.
 */

const crypto = require('crypto');

const DEFAULT_SAMPLE_RATE = 24000;
const MIN_SAMPLE_RATE = 8000;
const MAX_SAMPLE_RATE = 48000;
const CHUNK_SIZE = 4096;
// How long a pull waits in the page for a chunk before returning empty.
const PULL_WAIT_MS = 1000;
// Pause before retrying a frame whose document is navigating or has no tap.
const PULL_RETRY_MS = 300;
const MAX_POLLED_FRAMES_PER_PAGE = 24;

function normalizeSampleRate(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed)) return DEFAULT_SAMPLE_RATE;
  return Math.min(MAX_SAMPLE_RATE, Math.max(MIN_SAMPLE_RATE, parsed));
}

/**
 * Runs inside every document (main frame and iframes). Kept as a plain
 * function so it can be serialized by puppeteer's evaluateOnNewDocument.
 */
function pageAudioTap(config) {
  // The sentinel name is randomised per run (config.sentinel) so it carries no
  // stable, product-identifying marker a page could look up by name.
  const sentinel = config.sentinel;
  if (window[sentinel]) return;
  try {
    Object.defineProperty(window, sentinel, { value: true, configurable: false, enumerable: false, writable: false });
  } catch (_) {
    return;
  }

  const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  const NativeMediaElement = window.HTMLMediaElement;
  const NativeAudioNode = window.AudioNode;
  const NativeDestination = window.AudioDestinationNode;
  const NativeBaseContext = window.BaseAudioContext;
  if (!NativeAudioContext || !NativeMediaElement || !NativeAudioNode || !NativeDestination) return;

  // One stream per document so frames playing at the same time never share a clock.
  const sourceId = config.sourceId + '-' + Math.random().toString(36).slice(2, 8);
  const ownContexts = new WeakSet();
  const contextTaps = new WeakMap();
  const tappedMedia = new WeakSet();
  const pageTappedMedia = new WeakSet();
  const nativeConnect = NativeAudioNode.prototype.connect;
  const nativeDisconnect = NativeAudioNode.prototype.disconnect;
  const nativePlay = NativeMediaElement.prototype.play;
  const nativeCreateMediaElementSource = NativeBaseContext
    ? NativeBaseContext.prototype.createMediaElementSource
    : null;

  // Bot detection reads Function.prototype.toString on the patched prototype
  // methods to spot non-native replacements. Report the tap's own methods (and
  // this toString itself) as native so the patches keep the "[native code]"
  // signature the originals had. Registered functions are marked below.
  const __spoofedNatives = new WeakSet();
  const __spoofNative = fn => {
    if (typeof fn === 'function') {
      try { __spoofedNatives.add(fn); } catch (_) {}
    }
    return fn;
  };
  try {
    const nativeFunctionToString = Function.prototype.toString;
    let nativeToStringSource;
    try {
      nativeToStringSource = nativeFunctionToString.call(nativeFunctionToString);
    } catch (_) {
      nativeToStringSource = 'function toString() { [native code] }';
    }
    let patchedToString;
    patchedToString = new Proxy(nativeFunctionToString, {
      apply(target, thisArg, args) {
        if (thisArg === patchedToString) return nativeToStringSource;
        if (__spoofedNatives.has(thisArg)) {
          const name = thisArg && thisArg.name ? String(thisArg.name) : '';
          return 'function ' + name + '() { [native code] }';
        }
        return Reflect.apply(target, thisArg, args);
      },
    });
    Object.defineProperty(Function.prototype, 'toString', {
      value: patchedToString,
      configurable: true,
      writable: true,
    });
  } catch (_) {}

  let captureContext = null;
  let mixer = null;
  let processor = null;
  let silentChunks = 0;
  let sequence = 0;

  // Outgoing queue drained by the runner's long-poll. Bounded so a stalled
  // runner never makes the page grow without limit.
  const queue = [];
  const maxQueued = 48;
  let waiter = null;

  function deliver(payload) {
    queue.push(payload);
    if (queue.length > maxQueued) queue.splice(0, queue.length - maxQueued);
    if (waiter) {
      const resolve = waiter;
      waiter = null;
      resolve(pullResult(queue.splice(0)));
    }
  }

  // The runner passes the context rate it measured in earlier documents so a
  // fresh document labels its first second right, before its own window.
  function acceptRateHint(hint) {
    if (evaluations === 0 && typeof hint === 'number' && hint >= 8000 && hint <= 96000) {
      workingRate = hint;
    }
  }

  function pullResult(chunks) {
    return { c: chunks, k: workingRate, m: evaluations > 0 };
  }

  function pull(waitMs, rateHint) {
    acceptRateHint(rateHint);
    if (queue.length > 0) return Promise.resolve(pullResult(queue.splice(0)));
    return new Promise(function (resolve) {
      if (waiter) {
        const previous = waiter;
        waiter = null;
        previous(pullResult([]));
      }
      waiter = resolve;
      setTimeout(function () {
        if (waiter === resolve) {
          waiter = null;
          resolve(pullResult(queue.splice(0)));
        }
      }, waitMs);
    });
  }

  try {
    Object.defineProperty(window, config.handle, {
      value: Object.freeze({ pull: pull }),
      configurable: false,
      enumerable: false,
      writable: false,
    });
  } catch (_) {
    return;
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const step = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += step) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + step));
    }
    return btoa(binary);
  }

  function resumeCapture() {
    if (captureContext && captureContext.state === 'suspended') {
      captureContext.resume().catch(function () {});
    }
  }

  // Fingerprint-hardened builds may lie about AudioContext.sampleRate and
  // about everything derived from it (currentTime, playbackTime, decoded
  // buffer lengths). The only trustworthy figure is frames rendered per
  // wallclock second, so the reported rate is used until the first 1 s window
  // has been measured, then the measured rate takes over. Later windows must
  // agree twice in a row before the label moves again, which filters out
  // main-thread stalls that drop ScriptProcessor buffers.
  const knownRates = [8000, 11025, 16000, 22050, 24000, 32000, 44100, 48000, 88200, 96000];
  // A short first window bounds how long a wrong reported rate is used; the
  // later, longer windows refine it.
  const firstRateWindowMs = 500;
  const rateWindowMs = 1000;
  let workingRate = 0;
  let pendingCandidate = 0;
  let evaluations = 0;
  let windowStart = 0;
  let windowFrames = 0;

  function snapRate(value) {
    let best = knownRates[0];
    for (const rate of knownRates) {
      if (Math.abs(rate - value) < Math.abs(best - value)) best = rate;
    }
    return Math.abs(best - value) / best < 0.025 ? best : Math.round(value);
  }

  function ratesAgree(a, b) {
    return a > 0 && b > 0 && Math.abs(a - b) / b < 0.01;
  }

  function observeRate(bufferLength) {
    const now = Date.now();
    if (!windowStart) {
      windowStart = now;
      windowFrames = 0;
      return;
    }
    windowFrames += bufferLength;
    const spanMs = now - windowStart;
    if (spanMs < (evaluations === 0 ? firstRateWindowMs : rateWindowMs)) return;
    const candidate = snapRate((windowFrames * 1000) / spanMs);
    windowStart = now;
    windowFrames = 0;
    evaluations += 1;
    if (ratesAgree(candidate, workingRate)) {
      pendingCandidate = 0;
    } else if (evaluations === 1 || ratesAgree(candidate, pendingCandidate)) {
      workingRate = candidate;
      pendingCandidate = 0;
    } else {
      pendingCandidate = candidate;
    }
  }

  function handleAudioProcess(event) {
    const input = event.inputBuffer.getChannelData(0);
    if (!workingRate) workingRate = captureContext.sampleRate;
    observeRate(input.length);
    emitChunk(input, workingRate);
  }

  function emitChunk(input, contextRate) {
    let peak = 0;
    for (let i = 0; i < input.length; i++) {
      const magnitude = input[i] < 0 ? -input[i] : input[i];
      if (magnitude > peak) peak = magnitude;
    }
    if (peak < 0.0005) {
      silentChunks += 1;
      // Let a couple of silent chunks through so the tail of a sound is not
      // clipped, then stop sending until something audible comes back.
      if (silentChunks > 2) return;
    } else {
      silentChunks = 0;
    }

    // Decimate when the real rate is a whole multiple of the target so the
    // relay and the recorder receive the configured rate.
    const factor = contextRate > config.sampleRate && contextRate % config.sampleRate === 0
      ? contextRate / config.sampleRate
      : 1;
    const outputRate = contextRate / factor;
    const length = Math.floor(input.length / factor);
    const pcm = new Int16Array(length);
    for (let i = 0; i < length; i++) {
      let sample = 0;
      for (let k = 0; k < factor; k++) sample += input[i * factor + k];
      sample /= factor;
      if (sample > 1) sample = 1;
      else if (sample < -1) sample = -1;
      pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    const durationMs = (input.length / contextRate) * 1000;
    sequence += 1;
    deliver({
      d: bytesToBase64(new Uint8Array(pcm.buffer)),
      r: outputRate,
      t: Date.now() - durationMs,
      s: sourceId,
      n: sequence,
    });
  }

  function ensureCapture() {
    if (captureContext) return captureContext;
    // Never request a custom sampleRate: fingerprint-hardened builds pin the
    // reported rate, and media routed through a context whose real rate
    // differs from the reported one plays at the wrong speed. Use the default
    // rate and decimate to the configured one in handleAudioProcess.
    const context = new NativeAudioContext({ latencyHint: 'playback' });
    ownContexts.add(context);
    captureContext = context;
    mixer = context.createGain();
    processor = context.createScriptProcessor(config.chunkSize || 4096, 1, 1);
    processor.onaudioprocess = handleAudioProcess;
    nativeConnect.call(mixer, processor);
    nativeConnect.call(processor, context.destination);
    context.addEventListener('statechange', resumeCapture);
    resumeCapture();
    return context;
  }

  function getContextTap(context) {
    if (!context || ownContexts.has(context)) return null;
    if (contextTaps.has(context)) return contextTaps.get(context);
    let tap = null;
    try {
      if (typeof context.createMediaStreamDestination !== 'function') throw new Error('offline');
      tap = context.createMediaStreamDestination();
      const capture = ensureCapture();
      const source = capture.createMediaStreamSource(tap.stream);
      nativeConnect.call(source, mixer);
      // Runs in the same task as the page's own audio start, so it carries
      // the same user activation when autoplay policy is enforced.
      resumeCapture();
    } catch (_) {
      tap = null;
    }
    contextTaps.set(context, tap);
    return tap;
  }

  function tapMediaElement(element) {
    if (!(element instanceof NativeMediaElement)) return;
    if (tappedMedia.has(element) || pageTappedMedia.has(element)) return;
    // Muted media produces nothing to capture, and routing it through a
    // suspended context would stall it (muted autoplay videos are common).
    // It gets tapped on volumechange if the page unmutes it later.
    if (element.muted || element.volume === 0) return;
    tappedMedia.add(element);
    try {
      const capture = ensureCapture();
      const source = nativeCreateMediaElementSource
        ? nativeCreateMediaElementSource.call(capture, element)
        : capture.createMediaElementSource(element);
      nativeConnect.call(source, mixer);
      resumeCapture();
    } catch (_) {}
  }

  NativeAudioNode.prototype.connect = function connect(destination) {
    const result = nativeConnect.apply(this, arguments);
    try {
      if (destination instanceof NativeDestination) {
        const tap = getContextTap(destination.context);
        if (tap) nativeConnect.call(this, tap, arguments.length > 1 ? arguments[1] : 0);
      }
    } catch (_) {}
    return result;
  };

  NativeAudioNode.prototype.disconnect = function disconnect(destination) {
    const result = nativeDisconnect.apply(this, arguments);
    try {
      if (destination instanceof NativeDestination) {
        const tap = contextTaps.get(destination.context);
        if (tap) nativeDisconnect.call(this, tap);
      }
    } catch (_) {}
    return result;
  };

  if (nativeCreateMediaElementSource) {
    NativeBaseContext.prototype.createMediaElementSource = function createMediaElementSource(element) {
      // The page routes this element through its own graph, which reaches the
      // capture through the destination tap. Remember it so we do not fight
      // over the element (only one context may own a media element source).
      if (!ownContexts.has(this)) pageTappedMedia.add(element);
      return nativeCreateMediaElementSource.apply(this, arguments);
    };
  }

  NativeMediaElement.prototype.play = function play() {
    try { tapMediaElement(this); } catch (_) {}
    return nativePlay.apply(this, arguments);
  };

  // Mark the patched methods so Function.prototype.toString reports them as
  // native. Done after assignment so each reference is the replacement.
  __spoofNative(NativeAudioNode.prototype.connect);
  __spoofNative(NativeAudioNode.prototype.disconnect);
  if (nativeCreateMediaElementSource) __spoofNative(NativeBaseContext.prototype.createMediaElementSource);
  __spoofNative(NativeMediaElement.prototype.play);

  document.addEventListener('play', function (event) {
    try { tapMediaElement(event.target); } catch (_) {}
  }, true);
  document.addEventListener('volumechange', function (event) {
    const element = event.target;
    if (element instanceof NativeMediaElement && !element.paused) {
      try { tapMediaElement(element); } catch (_) {}
    }
  }, true);
  for (const gesture of ['pointerdown', 'keydown', 'touchstart']) {
    window.addEventListener(gesture, resumeCapture, true);
  }

  // Start the capture context right away in the top frame so the real sample
  // rate is already measured when the page first makes a sound. Iframes stay
  // lazy: ad-heavy pages would otherwise spawn one render thread each.
  if (window === window.top) {
    try { ensureCapture(); } catch (_) {}
  }
}

/**
 * Creates the runner-side capture. install(page) wires the page tap; every
 * decoded chunk is handed to onChunk({ pcm, sampleRate, ts, sourceId, page }).
 */
function createAudioCapture({ sampleRate, onChunk }) {
  const effectiveSampleRate = normalizeSampleRate(sampleRate);
  // Random, product-neutral identifiers: the page-side sink and its
  // installation sentinel change every run and carry no recognisable marker.
  const randomIdentifier = () => '_' + crypto.randomBytes(8).toString('hex');
  const handle = randomIdentifier();
  const sentinel = randomIdentifier();
  const installed = new WeakSet();
  const polledFrames = new WeakSet();
  let stopped = false;
  // Real context rate measured by any document so far; the browser build
  // determines it, so it carries over to new documents as a hint.
  let measuredContextRate = 0;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const handlePayload = (page) => (payload) => {
    if (stopped || !payload || typeof payload !== 'object') return;
    const { d, r, t, s } = payload;
    if (typeof d !== 'string' || d.length === 0 || d.length > 512 * 1024) return;
    if (!Number.isFinite(r) || r < MIN_SAMPLE_RATE || r > 96000) return;
    if (!Number.isFinite(t) || typeof s !== 'string' || s.length > 64) return;
    let pcm;
    try {
      pcm = Buffer.from(d, 'base64');
    } catch (_) {
      return;
    }
    if (pcm.length < 2 || pcm.length % 2 !== 0) return;
    try {
      onChunk({ pcm, sampleRate: Math.round(r), ts: t, sourceId: s, page });
    } catch (_) {}
  };

  // One long-poll loop per frame. Each iteration blocks in the page until a
  // chunk is queued (or PULL_WAIT_MS elapses), so idle frames cost one CDP
  // round-trip per second and active ones deliver with round-trip latency.
  const pollFrame = async (page, frame, deliver) => {
    if (polledFrames.has(frame)) return;
    polledFrames.add(frame);
    let active = 0;
    for (const candidate of page.frames()) {
      if (polledFrames.has(candidate)) active += 1;
    }
    if (active > MAX_POLLED_FRAMES_PER_PAGE) {
      polledFrames.delete(frame);
      return;
    }

    while (!stopped && !frame.detached && !page.isClosed()) {
      let result;
      try {
        result = await frame.evaluate(
          (handleName, waitMs, rateHint) => {
            const sink = window[handleName];
            return sink ? sink.pull(waitMs, rateHint) : null;
          },
          handle,
          PULL_WAIT_MS,
          measuredContextRate,
        );
      } catch (_) {
        // Navigation destroyed the execution context, or the frame is gone.
        // The next document gets a fresh tap; retry shortly.
        await sleep(PULL_RETRY_MS);
        continue;
      }
      if (result === null) {
        await sleep(PULL_RETRY_MS);
        continue;
      }
      if (!result || typeof result !== 'object') continue;
      if (result.m === true && Number.isFinite(result.k) && result.k >= 8000 && result.k <= 96000) {
        measuredContextRate = result.k;
      }
      if (Array.isArray(result.c)) {
        for (const payload of result.c) deliver(payload);
      }
    }
    polledFrames.delete(frame);
  };

  return {
    sampleRate: effectiveSampleRate,

    async install(page) {
      if (stopped || !page || installed.has(page) || page.isClosed()) return;
      installed.add(page);
      try {
        await page.evaluateOnNewDocument(pageAudioTap, {
          handle,
          sentinel,
          sampleRate: effectiveSampleRate,
          chunkSize: CHUNK_SIZE,
          sourceId: crypto.randomBytes(4).toString('hex'),
        });
        const deliver = handlePayload(page);
        page.on('frameattached', (frame) => {
          pollFrame(page, frame, deliver).catch(() => {});
        });
        for (const frame of page.frames()) {
          pollFrame(page, frame, deliver).catch(() => {});
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        console.debug('Audio capture install skipped: ' + detail);
      }
    },

    stop() {
      stopped = true;
    },
  };
}

/**
 * Places incoming PCM chunks on a wallclock timeline and emits a continuous,
 * gap-free mono stream (silence where nothing played). Used by the recorder
 * so ffmpeg always has audio to interleave with the video frames.
 */
function createAudioTimeline({ sampleRate, latencyMs = 600, bufferSeconds = 8 }) {
  const rate = normalizeSampleRate(sampleRate);
  const ring = new Float32Array(rate * bufferSeconds);
  const sources = new Map();
  let startWall = null;
  let emitted = 0;

  const wallToSample = (ts) => Math.round(((ts - startWall) / 1000) * rate);

  return {
    sampleRate: rate,

    start(wallclockMs) {
      if (startWall !== null) return;
      startWall = wallclockMs;
    },

    started() {
      return startWall !== null;
    },

    push({ pcm, sampleRate: chunkRate, ts, sourceId }) {
      if (startWall === null) return;
      const samples = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length / 2);
      const ratio = chunkRate / rate;
      const length = Math.floor(samples.length / ratio);
      if (length <= 0) return;

      const wallPosition = wallToSample(ts);
      let source = sources.get(sourceId);
      if (!source) {
        source = { next: wallPosition, lastSeen: Date.now() };
        sources.set(sourceId, source);
      }
      // Chunks from one document are contiguous; follow the source clock
      // unless the wallclock drifted (silence suppression gap, new stream).
      let position = source.next;
      if (Math.abs(wallPosition - position) > rate / 2) position = wallPosition;
      if (position < emitted) position = emitted;
      source.next = position + length;
      source.lastSeen = Date.now();

      const limit = emitted + ring.length;
      // Box-average over the source span of each output sample when reducing
      // the rate (non-integer ratios such as 44.1k -> 24k are common), which
      // avoids the aliasing of plain decimation; interpolate when increasing.
      const lastIndex = samples.length - 1;
      for (let i = 0; i < length; i++) {
        const absolute = position + i;
        if (absolute >= limit) break;
        const from = i * ratio;
        let sample;
        if (ratio > 1) {
          const to = Math.min(from + ratio, samples.length);
          let sum = 0;
          let count = 0;
          for (let k = Math.floor(from); k < to; k++) {
            sum += samples[k];
            count += 1;
          }
          sample = count > 0 ? sum / count : 0;
        } else {
          const index = Math.min(Math.floor(from), lastIndex);
          const next = Math.min(index + 1, lastIndex);
          const frac = from - index;
          sample = samples[index] * (1 - frac) + samples[next] * frac;
        }
        ring[absolute % ring.length] += sample / 0x8000;
      }

      if (sources.size > 64) {
        const now = Date.now();
        for (const [id, entry] of sources) {
          if (now - entry.lastSeen > 30000) sources.delete(id);
        }
      }
    },

    /** Returns the Int16 PCM due up to (now - latency), advancing the cursor. */
    drain(nowMs, flushAll = false) {
      if (startWall === null) return null;
      const horizon = flushAll ? nowMs : nowMs - latencyMs;
      const target = Math.floor(((horizon - startWall) / 1000) * rate);
      if (target <= emitted) return null;
      const count = Math.min(target - emitted, ring.length);
      const out = Buffer.allocUnsafe(count * 2);
      for (let i = 0; i < count; i++) {
        const index = (emitted + i) % ring.length;
        let sample = ring[index];
        ring[index] = 0;
        if (sample > 1) sample = 1;
        else if (sample < -1) sample = -1;
        out.writeInt16LE(Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7FFF), i * 2);
      }
      emitted += count;
      return out;
    },
  };
}

module.exports = { createAudioCapture, createAudioTimeline, normalizeSampleRate, DEFAULT_SAMPLE_RATE };
