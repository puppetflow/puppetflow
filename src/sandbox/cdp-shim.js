'use strict';

// CDP transport placed between Puppeteer and the browser so the connection
// leaves fewer traces in the page than a stock Puppeteer session.
//
// 1. Runtime domain. Puppeteer sends Runtime.enable on every page and worker
//    session and leaves it on for the whole run, only to receive the
//    executionContextCreated events that give it the context ids evaluate()
//    needs. While the domain is enabled Chrome serializes console.debug()
//    arguments for the client, which fires any getter a page has planted on
//    them: that is the CDP check bot detection runs (Pixelscan, DataDome...).
//    The shim lets Puppeteer's Runtime.enable through, disables the domain as
//    soon as the initial contexts have been reported, then, at each navigation
//    event, pulses enable/disable for a few milliseconds so Puppeteer learns
//    the new context ids. Runtime.callFunctionOn and Runtime.evaluate work
//    with a known context id while the domain is disabled; bindingCalled
//    (exposeFunction) is delivered regardless. What is lost: consoleAPICalled
//    and exceptionThrown, so page.on('console') and page.on('pageerror') stay
//    silent; run.js keeps the domain enabled when the flow uses them.
// 2. Source URLs. Puppeteer appends "//# sourceURL=pptr:evaluate;..." to every
//    evaluated function, which shows up in Error().stack whenever page code
//    inspects its caller. Stripped here.
//
// Own commands use ids from OWN_ID_BASE so they never collide with Puppeteer's,
// and their responses are swallowed.

const WebSocket = require('ws');

const OWN_ID_BASE = 2000000000;
const PPTR_SOURCE_URL = /\n\/\/# sourceURL=pptr:[^\n]*\n?$/;
// Navigation-related events after which new execution contexts may exist.
const PULSE_EVENTS = new Set([
  'Page.frameNavigated',
  'Page.frameAttached',
  'Page.frameStoppedLoading',
  'Page.lifecycleEvent',
]);
const WORKER_TARGET_TYPES = new Set(['worker', 'shared_worker', 'service_worker']);
const PULSE_DEBOUNCE_MS = 25;
const INITIAL_DISABLE_FALLBACK_MS = 500;

class StealthCdpTransport {
  onmessage = undefined;
  onclose = undefined;

  #socket;
  #closed = false;
  #disableRuntime;
  #stripSourceUrls;
  #log;
  #nextOwnId = OWN_ID_BASE;
  #ownPending = new Map();
  #puppeteerRuntimeEnables = new Map();
  #isolatedWorldRequests = new Map();
  #sessions = new Map();
  #sessionTypes = new Map();
  #deliveredContexts = new Set();

  constructor(socket, options = {}) {
    this.#socket = socket;
    this.#disableRuntime = options.disableRuntime !== false;
    this.#stripSourceUrls = options.stripSourceUrls !== false;
    this.#log = typeof options.log === 'function' ? options.log : () => {};
    socket.on('message', data => this.#fromBrowser(String(data)));
    socket.on('close', () => this.#onSocketClosed());
    socket.on('error', () => this.#onSocketClosed());
  }

  send(message) {
    if (this.#closed) return;
    let msg;
    try {
      msg = JSON.parse(message);
    } catch (_) {
      this.#socket.send(message);
      return;
    }
    let rewritten = false;
    if (this.#stripSourceUrls && msg.params) {
      if (msg.method === 'Runtime.callFunctionOn' && typeof msg.params.functionDeclaration === 'string'
        && PPTR_SOURCE_URL.test(msg.params.functionDeclaration)) {
        msg.params.functionDeclaration = msg.params.functionDeclaration.replace(PPTR_SOURCE_URL, '');
        rewritten = true;
      } else if (msg.method === 'Runtime.evaluate' && typeof msg.params.expression === 'string'
        && PPTR_SOURCE_URL.test(msg.params.expression)) {
        msg.params.expression = msg.params.expression.replace(PPTR_SOURCE_URL, '');
        rewritten = true;
      }
    }
    if (this.#disableRuntime && msg.id !== undefined) {
      const sessionId = msg.sessionId || '';
      if (msg.method === 'Runtime.enable') this.#puppeteerRuntimeEnables.set(msg.id, sessionId);
      else if (msg.method === 'Page.createIsolatedWorld') this.#isolatedWorldRequests.set(msg.id, sessionId);
    }
    this.#socket.send(rewritten ? JSON.stringify(msg) : message);
  }

  close() {
    this.#closed = true;
    try {
      this.#socket.close();
    } catch (_) {}
  }

  #onSocketClosed() {
    if (this.#closed) return;
    this.#closed = true;
    for (const { reject } of this.#ownPending.values()) reject(new Error('CDP transport closed'));
    this.#ownPending.clear();
    for (const session of this.#sessions.values()) {
      clearTimeout(session.pulseTimer);
      clearTimeout(session.disableTimer);
    }
    if (this.onclose) this.onclose();
  }

  #fromBrowser(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (_) {
      if (this.onmessage) this.onmessage(raw);
      return;
    }
    if (msg.id !== undefined && this.#ownPending.has(msg.id)) {
      const { resolve, reject } = this.#ownPending.get(msg.id);
      this.#ownPending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || 'CDP error'));
      else resolve(msg.result);
      return;
    }
    if (this.#disableRuntime && !this.#observe(msg)) return;
    if (this.onmessage) this.onmessage(raw);
  }

  // Tracks session state from the traffic; returns false when the message
  // must not reach Puppeteer (a context it already knows, re-reported by a
  // pulse: a duplicate would make it dispose and recreate its ExecutionContext).
  #observe(msg) {
    const sessionId = msg.sessionId || '';
    if (msg.id !== undefined) {
      const enableSession = this.#puppeteerRuntimeEnables.get(msg.id);
      if (enableSession !== undefined) {
        this.#puppeteerRuntimeEnables.delete(msg.id);
        if (!msg.error) this.#onPuppeteerEnabledRuntime(enableSession);
      }
      const worldSession = this.#isolatedWorldRequests.get(msg.id);
      if (worldSession !== undefined) {
        this.#isolatedWorldRequests.delete(msg.id);
        // Puppeteer sends createIsolatedWorld for every frame right after
        // Runtime.enable resolves; the session processes commands in order,
        // so a disable sent now runs after all of them have reported.
        this.#disableInitialRuntime(worldSession);
      }
      return true;
    }
    switch (msg.method) {
      case 'Target.attachedToTarget': {
        const { sessionId: attached, targetInfo } = msg.params || {};
        if (attached && targetInfo) this.#sessionTypes.set(attached, targetInfo.type);
        break;
      }
      case 'Target.detachedFromTarget': {
        const detached = msg.params && msg.params.sessionId;
        if (detached) this.#forgetSession(detached);
        break;
      }
      case 'Runtime.executionContextCreated': {
        const key = sessionId + ':' + msg.params.context.id;
        if (this.#deliveredContexts.has(key)) return false;
        this.#deliveredContexts.add(key);
        // Workers have no isolated world: the first context is all Puppeteer
        // waits for.
        if (WORKER_TARGET_TYPES.has(this.#sessionTypes.get(sessionId))) this.#disableInitialRuntime(sessionId);
        break;
      }
      case 'Runtime.executionContextDestroyed':
        this.#deliveredContexts.delete(sessionId + ':' + msg.params.executionContextId);
        break;
      case 'Runtime.executionContextsCleared':
        for (const key of this.#deliveredContexts) {
          if (key.startsWith(sessionId + ':')) this.#deliveredContexts.delete(key);
        }
        break;
      default:
        if (PULSE_EVENTS.has(msg.method)) this.#requestPulse(sessionId);
    }
    return true;
  }

  #session(sessionId) {
    let session = this.#sessions.get(sessionId);
    if (!session) {
      session = { runtimeEnabled: false, pulsing: false, pulseAgain: false, pulseTimer: null, disableTimer: null };
      this.#sessions.set(sessionId, session);
    }
    return session;
  }

  #forgetSession(sessionId) {
    const session = this.#sessions.get(sessionId);
    if (session) {
      clearTimeout(session.pulseTimer);
      clearTimeout(session.disableTimer);
      this.#sessions.delete(sessionId);
    }
    this.#sessionTypes.delete(sessionId);
    for (const key of this.#deliveredContexts) {
      if (key.startsWith(sessionId + ':')) this.#deliveredContexts.delete(key);
    }
  }

  #onPuppeteerEnabledRuntime(sessionId) {
    const session = this.#session(sessionId);
    session.runtimeEnabled = true;
    clearTimeout(session.disableTimer);
    // Safety net when neither createIsolatedWorld nor a worker context follows.
    session.disableTimer = setTimeout(() => this.#disableInitialRuntime(sessionId), INITIAL_DISABLE_FALLBACK_MS);
  }

  #disableInitialRuntime(sessionId) {
    const session = this.#sessions.get(sessionId);
    if (!session || !session.runtimeEnabled) return;
    session.runtimeEnabled = false;
    clearTimeout(session.disableTimer);
    session.disableTimer = null;
    this.#own('Runtime.disable', sessionId).catch(() => {});
  }

  #requestPulse(sessionId) {
    const session = this.#session(sessionId);
    if (session.runtimeEnabled) return;
    if (session.pulsing) {
      session.pulseAgain = true;
      return;
    }
    if (session.pulseTimer) return;
    session.pulseTimer = setTimeout(() => {
      session.pulseTimer = null;
      this.#pulse(sessionId).catch(() => {});
    }, PULSE_DEBOUNCE_MS);
  }

  // enable reports every existing context (filtered above to the new ones),
  // then disable closes the window before the page's scripts get to run much.
  async #pulse(sessionId) {
    const session = this.#session(sessionId);
    if (session.pulsing || session.runtimeEnabled) return;
    session.pulsing = true;
    try {
      do {
        session.pulseAgain = false;
        await this.#own('Runtime.enable', sessionId);
        await this.#own('Runtime.disable', sessionId);
      } while (session.pulseAgain && !this.#closed && this.#sessions.has(sessionId));
    } catch (error) {
      this.#log('CDP shim pulse failed: ' + (error && error.message ? error.message : error));
    } finally {
      session.pulsing = false;
    }
  }

  #own(method, sessionId, params = {}) {
    if (this.#closed) return Promise.reject(new Error('CDP transport closed'));
    const id = this.#nextOwnId++;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.#ownPending.set(id, { resolve, reject });
      try {
        this.#socket.send(JSON.stringify(message));
      } catch (error) {
        this.#ownPending.delete(id);
        reject(error);
      }
    });
  }
}

// Opens the browser's WebSocket endpoint through the shim and hands the
// transport to puppeteer.connect. Options: disableRuntime, stripSourceUrls,
// log, plus anything puppeteer.connect accepts (defaultViewport...).
async function connectThroughShim(puppeteer, browserWSEndpoint, options = {}) {
  const { disableRuntime, stripSourceUrls, log, headers, ...connectOptions } = options;
  const socket = new WebSocket(browserWSEndpoint, [], {
    followRedirects: true,
    perMessageDeflate: false,
    maxPayload: 256 * 1024 * 1024,
    headers,
  });
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
    socket.once('unexpected-response', (_request, response) => {
      reject(new Error('Unexpected server response: ' + response.statusCode));
    });
  });
  const transport = new StealthCdpTransport(socket, { disableRuntime, stripSourceUrls, log });
  return puppeteer.connect({ ...connectOptions, transport });
}

module.exports = { StealthCdpTransport, connectThroughShim };
