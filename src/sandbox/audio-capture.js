/*
 * Browser audio capture for the live view and the run recording.
 *
 * Headless Chromium has no audio device, so the sound a page plays cannot be
 * grabbed from the OS. Instead, a script injected in every document taps the
 * Web Audio graph and the media elements of the page, mixes them into a single
 * mono PCM stream and hands 16-bit chunks back to the runner through a CDP
 * binding. The runner then forwards the chunks to the stream relay (live view)
 * and to the recording encoder (mp4 audio track).
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
  const sentinel = '__pf_audio_tap_installed__';
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

  let captureContext = null;
  let mixer = null;
  let processor = null;
  let silentChunks = 0;
  let sequence = 0;

  function deliver(payload) {
    const binding = window[config.binding];
    if (typeof binding !== 'function') return;
    try {
      const result = binding(payload);
      if (result && typeof result.catch === 'function') result.catch(function () {});
    } catch (_) {}
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

  function handleAudioProcess(event) {
    const input = event.inputBuffer.getChannelData(0);
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

    const pcm = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      let sample = input[i];
      if (sample > 1) sample = 1;
      else if (sample < -1) sample = -1;
      pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    const durationMs = (input.length / captureContext.sampleRate) * 1000;
    sequence += 1;
    deliver({
      d: bytesToBase64(new Uint8Array(pcm.buffer)),
      r: captureContext.sampleRate,
      t: Date.now() - durationMs,
      s: sourceId,
      n: sequence,
    });
  }

  function ensureCapture() {
    if (captureContext) return captureContext;
    const context = new NativeAudioContext({ sampleRate: config.sampleRate, latencyHint: 'playback' });
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
    } catch (_) {
      tap = null;
    }
    contextTaps.set(context, tap);
    return tap;
  }

  function tapMediaElement(element) {
    if (!(element instanceof NativeMediaElement)) return;
    if (tappedMedia.has(element) || pageTappedMedia.has(element)) return;
    tappedMedia.add(element);
    try {
      const capture = ensureCapture();
      const source = nativeCreateMediaElementSource
        ? nativeCreateMediaElementSource.call(capture, element)
        : capture.createMediaElementSource(element);
      nativeConnect.call(source, mixer);
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

  document.addEventListener('play', function (event) {
    try { tapMediaElement(event.target); } catch (_) {}
  }, true);
  for (const gesture of ['pointerdown', 'keydown', 'touchstart']) {
    window.addEventListener(gesture, resumeCapture, true);
  }
}

/**
 * Creates the runner-side capture. install(page) wires the page tap; every
 * decoded chunk is handed to onChunk({ pcm, sampleRate, ts, sourceId, page }).
 */
function createAudioCapture({ sampleRate, onChunk }) {
  const effectiveSampleRate = normalizeSampleRate(sampleRate);
  const binding = '__pf_audio_sink_' + crypto.randomBytes(6).toString('hex');
  const installed = new WeakSet();
  let stopped = false;

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

  return {
    sampleRate: effectiveSampleRate,

    async install(page) {
      if (stopped || !page || installed.has(page) || page.isClosed()) return;
      installed.add(page);
      try {
        await page.exposeFunction(binding, handlePayload(page));
        await page.evaluateOnNewDocument(pageAudioTap, {
          binding,
          sampleRate: effectiveSampleRate,
          chunkSize: CHUNK_SIZE,
          sourceId: crypto.randomBytes(4).toString('hex'),
        });
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
      for (let i = 0; i < length; i++) {
        const absolute = position + i;
        if (absolute >= limit) break;
        const sample = samples[Math.floor(i * ratio)] / 0x8000;
        ring[absolute % ring.length] += sample;
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
