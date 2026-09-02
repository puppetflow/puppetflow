/* global __namedPages, __pageClients */

const __networkSniffingProfiles = new Map();
let __networkSniffingCallbackQueue = Promise.resolve();
let __networkSniffingFirstError = null;
let __networkSniffingCallbackActive = false;
const __configuredNetworkSniffingMaxBodyBytes = Number.parseInt(
  process.env.RUNNER_HTTP_SNIFFING_MAX_BODY_BYTES || '',
  10,
);
const __networkSniffingMaxBodyBytes = Number.isInteger(__configuredNetworkSniffingMaxBodyBytes)
  && __configuredNetworkSniffingMaxBodyBytes > 0
  ? __configuredNetworkSniffingMaxBodyBytes
  : 5 * 1024 * 1024;
delete process.env.RUNNER_HTTP_SNIFFING_MAX_BODY_BYTES;

const __normalizeNetworkSniffingProfileName = function(profileName, helperName) {
  if (typeof profileName !== 'string' || !profileName.trim()) {
    throw new TypeError(helperName + ': profileName must be a non-empty string.');
  }

  const normalized = profileName.trim();
  const hasControlCharacter = Array.from(normalized)
    .some(character => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127);
  if (normalized.length > 128 || hasControlCharacter) {
    throw new TypeError(helperName + ': profileName must be at most 128 characters and cannot contain control characters.');
  }

  return normalized;
};

const __compileNetworkSniffingMatcher = function(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof RegExp) {
    const flags = value.flags.replace(/[gy]/g, '');
    return new RegExp(value.source, flags);
  }
  if (typeof value !== 'string') {
    throw new TypeError('$sniffNetwork: filters.' + fieldName + ' must be a string or RegExp.');
  }
  const normalized = value.trim();
  if (normalized.startsWith('#') && normalized.endsWith('#')) {
    try {
      return new RegExp(normalized.slice(1, -1));
    } catch (error) {
      throw new TypeError('$sniffNetwork: filters.' + fieldName + ' contains an invalid regular expression: ' + error.message);
    }
  }
  const source = normalized
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp('^' + source + '$', 'i');
};

const __compileNetworkSniffingPatterns = function(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const values = Array.isArray(value) ? value : [value];
  if (!values.every(item => item instanceof RegExp || (typeof item === 'string' && item.trim()))) {
    throw new TypeError('$sniffNetwork: filters.' + fieldName + ' must contain strings or RegExp values.');
  }
  return values.map(item => __compileNetworkSniffingMatcher(item, fieldName));
};

const __normalizeNetworkSniffingFilters = function(filters) {
  if (filters === undefined || filters === null) filters = {};
  if (typeof filters !== 'object' || Array.isArray(filters)) {
    throw new TypeError('$sniffNetwork: filters must be an object.');
  }

  return {
    url: __compileNetworkSniffingMatcher(filters.url, 'url'),
    host: __compileNetworkSniffingMatcher(filters.host, 'host'),
    path: __compileNetworkSniffingMatcher(filters.path, 'path'),
    schemes: __compileNetworkSniffingPatterns(filters.scheme, 'scheme'),
    methods: __compileNetworkSniffingPatterns(filters.method, 'method'),
    resourceTypes: __compileNetworkSniffingPatterns(filters.resourceType, 'resourceType'),
  };
};

const __matchesNetworkSniffingFilters = function(filters, params) {
  let parsedUrl;
  try {
    parsedUrl = new URL(params.request.url);
  } catch (_) {
    return false;
  }

  if (filters.url && !filters.url.test(params.request.url)) return false;
  if (filters.host && !filters.host.test(parsedUrl.hostname)) return false;
  if (filters.path && !filters.path.test(parsedUrl.pathname + parsedUrl.search)) return false;
  if (filters.schemes && !filters.schemes.some(pattern => pattern.test(parsedUrl.protocol.replace(/:$/, '')))) return false;
  if (filters.methods && !filters.methods.some(pattern => pattern.test(String(params.request.method || '')))) return false;
  if (filters.resourceTypes && !filters.resourceTypes.some(pattern => pattern.test(String(params.type || '')))) return false;
  return true;
};

const __networkSniffingTabName = function(page) {
  return Array.from(__namedPages.entries())
    .find(([, candidate]) => candidate === page)?.[0] || null;
};

const __networkSniffingResponseBody = async function(client, requestId, response, encodedDataLength) {
  const declaredBytes = Math.max(
    Number(encodedDataLength) || 0,
    Number(response?.encodedDataLength) || 0,
  );
  if (declaredBytes > __networkSniffingMaxBodyBytes) {
    return {
      body: null,
      bodyEncoding: null,
      bodyBytes: declaredBytes,
      bodyTruncated: true,
      bodyUnavailable: false,
    };
  }

  try {
    const result = await client.send('Network.getResponseBody', { requestId });
    const body = result.base64Encoded
      ? Buffer.from(result.body || '', 'base64')
      : Buffer.from(result.body || '');
    if (body.length > __networkSniffingMaxBodyBytes) {
      return {
        body: null,
        bodyEncoding: null,
        bodyBytes: body.length,
        bodyTruncated: true,
        bodyUnavailable: false,
      };
    }
    return {
      body: result.body || '',
      bodyEncoding: result.base64Encoded ? 'base64' : 'utf8',
      bodyBytes: body.length,
      bodyTruncated: false,
      bodyUnavailable: false,
    };
  } catch (_) {
    return {
      body: null,
      bodyEncoding: null,
      bodyBytes: declaredBytes,
      bodyTruncated: false,
      bodyUnavailable: true,
    };
  }
};

const __networkSniffingRequestPayload = function(params) {
  return {
    url: params.request.url,
    method: params.request.method,
    headers: params.request.headers || {},
  };
};

const __networkSniffingResponsePayload = function(response, body) {
  let contentJson = null;
  if (
    body.bodyEncoding === 'utf8'
    && typeof body.body === 'string'
    && /(?:\/|\+)json(?:;|$)/i.test(response?.mimeType || '')
  ) {
    try {
      contentJson = JSON.parse(body.body);
    } catch (_) {}
  }

  return {
    status: {
      code: response?.status ?? null,
      text: response?.statusText ?? null,
    },
    headers: response?.headers || {},
    mimeType: response?.mimeType || null,
    body: {
      content: body.body,
      contentJson,
      encoding: body.bodyEncoding,
      bytes: body.bodyBytes,
      truncated: body.bodyTruncated,
      unavailable: body.bodyUnavailable,
    },
  };
};

const __queueNetworkSniffingRecord = function(profile, record) {
  profile.queue = profile.queue
    .catch(() => {})
    .then(async () => {
      const payload = await record.completion;
      if (!profile.callback) return;
      const callbackTask = __networkSniffingCallbackQueue
        .catch(() => {})
        .then(async () => {
          const previousCallbackActive = __networkSniffingCallbackActive;
          __networkSniffingCallbackActive = true;
          try {
            await profile.callback(payload);
          } catch (error) {
            if (!profile.firstError) profile.firstError = error;
            console.error(
              'Sniff Network ' + profile.name + ' callback failed:',
              error && error.message ? error.message : error,
            );
          } finally {
            __networkSniffingCallbackActive = previousCallbackActive;
          }
        });
      __networkSniffingCallbackQueue = callbackTask.catch(() => {});
      await callbackTask;
    });
};

const __completeNetworkSniffingRecord = async function(profile, pageState, record, details = {}) {
  if (record.completed) return;
  record.completed = true;
  pageState.pending.delete(record.requestId);

  let responseBody = {
    body: null,
    bodyEncoding: null,
    bodyBytes: Number(details.encodedDataLength) || 0,
    bodyTruncated: false,
    bodyUnavailable: true,
  };
  if (record.response && details.loadFinished === true) {
    responseBody = await __networkSniffingResponseBody(
      pageState.client,
      record.requestId,
      record.response,
      details.encodedDataLength,
    );
  }

  const finishedAt = Date.now();
  profile.captured += 1;
  record.resolve({
    profile: profile.name,
    index: record.index,
    tabName: record.tabName,
    resourceType: record.resourceType || null,
    request: record.request,
    response: __networkSniffingResponsePayload(record.response, responseBody),
    error: details.error || null,
    durationMs: Math.max(0, finishedAt - record.startedAt),
  });
};

const __attachNetworkSniffingProfileToPage = async function(profile, page) {
  if (profile.stopping || page.isClosed() || profile.pages.has(page)) return;
    const client = __pageClients.get(page);
    if (!client) {
      throw new Error('$sniffNetwork: CDP session is not ready for a browser tab.');
    }
    const pageState = { client, pending: new Map(), listeners: [], closeListener: null };
    profile.pages.set(page, pageState);

    const listen = (eventName, listener) => {
      client.on(eventName, listener);
      pageState.listeners.push([eventName, listener]);
    };

    listen('Network.requestWillBeSent', params => {
      if (profile.stopping) return;
      const previous = pageState.pending.get(params.requestId);
      if (previous) {
        previous.response = params.redirectResponse || previous.response;
        void __completeNetworkSniffingRecord(profile, pageState, previous, {
          error: params.redirectResponse ? null : 'Request identifier was reused before completion.',
        });
      }
      const matchesFilters = __matchesNetworkSniffingFilters(profile.filters, params);
      const hasFilters = Object.values(profile.filters).some(Boolean);
      if (matchesFilters || profile.showUnfilteredInLogs) {
        console.log(
          'Sniff Network ' + profile.name + ' ' + (hasFilters && matchesFilters ? ' (hit)' : '(miss)'),
          params.request.url,
        );
      }
      if (!matchesFilters) return;

      let resolve;
      const completion = new Promise(done => { resolve = done; });
      const record = {
        requestId: params.requestId,
        resourceType: params.type,
        request: __networkSniffingRequestPayload(params),
        response: null,
        tabName: __networkSniffingTabName(page),
        index: profile.nextIndex,
        startedAt: Date.now(),
        completed: false,
        completion,
        resolve,
      };
      profile.nextIndex += 1;
      pageState.pending.set(params.requestId, record);
      __queueNetworkSniffingRecord(profile, record);
    });

    listen('Network.responseReceived', params => {
      const record = pageState.pending.get(params.requestId);
      if (record) record.response = params.response;
    });

    listen('Network.loadingFinished', params => {
      const record = pageState.pending.get(params.requestId);
      if (record) {
        void __completeNetworkSniffingRecord(profile, pageState, record, {
          loadFinished: true,
          encodedDataLength: params.encodedDataLength,
        });
      }
    });

    listen('Network.loadingFailed', params => {
      const record = pageState.pending.get(params.requestId);
      if (record) {
        void __completeNetworkSniffingRecord(profile, pageState, record, {
          error: params.errorText || 'Request failed.',
        });
      }
    });

    pageState.closeListener = () => {
      for (const [eventName, listener] of pageState.listeners) {
        client.off(eventName, listener);
      }
      profile.pages.delete(page);
      for (const record of [...pageState.pending.values()]) {
        void __completeNetworkSniffingRecord(profile, pageState, record, {
          error: 'Browser tab closed before the request completed.',
        });
      }
    };
    page.once('close', pageState.closeListener);

  try {
    await client.send('Network.enable');
  } catch (error) {
    for (const [eventName, listener] of pageState.listeners) {
      client.off(eventName, listener);
    }
    page.off('close', pageState.closeListener);
    profile.pages.delete(page);
    throw error;
  }
};

await __registerNamedPageInitializer(async page => {
  await Promise.all(
    Array.from(__networkSniffingProfiles.values())
      .map(profile => __attachNetworkSniffingProfileToPage(profile, page)),
  );
});

const __stopNetworkSniffingProfile = async function(profileName, reason, suppressMissing = false) {
  const normalizedName = __normalizeNetworkSniffingProfileName(profileName, '$stopSniffing');
  const profile = __networkSniffingProfiles.get(normalizedName);
  if (!profile) {
    if (suppressMissing) return null;
    throw new Error('$stopSniffing: sniffing profile "' + normalizedName + '" is not active.');
  }
  if (profile.stopPromise) return profile.stopPromise;

  profile.stopping = true;
  clearTimeout(profile.timeoutHandle);
  profile.stopPromise = (async () => {
    for (const [page, pageState] of profile.pages) {
      for (const [eventName, listener] of pageState.listeners) {
        pageState.client.off(eventName, listener);
      }
      page.off('close', pageState.closeListener);
      for (const record of [...pageState.pending.values()]) {
        await __completeNetworkSniffingRecord(profile, pageState, record, {
          error: 'Sniffing stopped before the request completed.',
        });
      }
    }
    await profile.queue;
    const summary = {
      profile: profile.name,
      reason,
      captured: profile.captured,
      startedAt: profile.startedAt,
      stoppedAt: Date.now(),
      draining: false,
    };
    console.debug('Sniff Network ' + profile.name + ' stopped: ' + profile.captured + ' request(s)');
    if (profile.firstError) throw profile.firstError;
    return summary;
  })().finally(() => {
    if (__networkSniffingProfiles.get(profile.name) === profile) {
      __networkSniffingProfiles.delete(profile.name);
    }
  });
  return profile.stopPromise;
};

const __stopAllNetworkSniffing = async function(reason = 'flow-ended') {
  const profiles = [...__networkSniffingProfiles.keys()];
  let firstError = null;
  for (const profileName of profiles) {
    try {
      await __stopNetworkSniffingProfile(profileName, reason, true);
    } catch (error) {
      if (!firstError) firstError = error;
    }
  }
  if (firstError) throw firstError;
  if (__networkSniffingFirstError) throw __networkSniffingFirstError;
};

/* @help Advanced
 * @sig $sniffNetwork(profileName?, filters?, options?)
 * @aliases capture network, monitor requests, inspect traffic
 * @desc Start a named asynchronous network capture. Matching request and response pairs are passed to options.sniffing in request arrival order while the main flow continues immediately.
 * @nodal-desc Capture matching browser requests and responses in a named profile while the main flow continues.
 * @nodal-output object { profile:string, timeout:number, maxBodyBytes:number, startedAt:number }
 * @opt timeout: 60000, showUnfilteredInLogs: false
 * @nodal-param profileName [sniff-profile]: Name of the sniffing profile to create. Defaults to Default.
 * @nodal-param filters [object]: Optional filters combined with AND logic.
 * @nodal-param filters.url [string]: Complete URL pattern. Use wildcards by default, or wrap the value in # characters for a regular expression.
 * @nodal-param filters.host [string]: Host pattern such as *.example.*. Wrap the value in # characters for a regular expression.
 * @nodal-param filters.scheme [string]: URL scheme pattern such as https or http*. Wrap the value in # characters for a regular expression.
 * @nodal-param filters.path [string]: URL path pattern such as /api/*. Wrap the value in # characters for a regular expression.
 * @nodal-param filters.method [string]: HTTP method pattern such as GET or P*. Wrap the value in # characters for a regular expression.
 * @nodal-param filters.resourceType [string]: CDP resource type pattern such as XHR, Fetch or *script*. Wrap the value in # characters for a regular expression.
 * @nodal-param options [object]: Sniffing callback and lifetime options.
 * @nodal-param options.sniffing [flow]: Flow executed once for every captured pair. The payload contains request, response, error and durationMs. Response status and body details are grouped under response.status and response.body.
 * @nodal-param options.timeout [number]: Maximum capture lifetime in milliseconds. Defaults to 60000. Set to 0 to disable the timeout.
 * @nodal-param options.showUnfilteredInLogs [boolean]: Log requests that do not match the filters. Defaults to false.
 */
const $sniffNetwork = async function(profileName = 'Default', filters = {}, options = {}) {
  const normalizedName = __normalizeNetworkSniffingProfileName(profileName, '$sniffNetwork');
  if (__networkSniffingProfiles.has(normalizedName)) {
    throw new Error('$sniffNetwork: sniffing profile "' + normalizedName + '" is already active.');
  }
  if (options === undefined || options === null) options = {};
  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('$sniffNetwork: options must be an object.');
  }
  if (options.sniffing !== undefined && typeof options.sniffing !== 'function') {
    throw new TypeError('$sniffNetwork: options.sniffing must be a function.');
  }
  if (options.showUnfilteredInLogs !== undefined && typeof options.showUnfilteredInLogs !== 'boolean') {
    throw new TypeError('$sniffNetwork: options.showUnfilteredInLogs must be a boolean.');
  }
  const timeout = options.timeout === undefined ? 60000 : Number(options.timeout);
  if (!Number.isFinite(timeout) || timeout < 0) {
    throw new TypeError('$sniffNetwork: options.timeout must be a non-negative finite number.');
  }

  const profile = {
    name: normalizedName,
    filters: __normalizeNetworkSniffingFilters(filters),
    callback: options.sniffing || null,
    showUnfilteredInLogs: options.showUnfilteredInLogs === true,
    pages: new Map(),
    queue: Promise.resolve(),
    nextIndex: 0,
    captured: 0,
    firstError: null,
    startedAt: Date.now(),
    stopping: false,
    stopPromise: null,
    timeoutHandle: null,
  };
  __networkSniffingProfiles.set(profile.name, profile);
  try {
    await Promise.all(
      Array.from(__namedPages.values())
        .filter(page => !page.isClosed())
        .map(page => __attachNetworkSniffingProfileToPage(profile, page)),
    );
  } catch (error) {
    try {
      await __stopNetworkSniffingProfile(profile.name, 'startup-failed', true);
    } catch (_) {}
    throw error;
  }

  if (timeout > 0) {
    profile.timeoutHandle = setTimeout(() => {
      __stopNetworkSniffingProfile(profile.name, 'timeout', true).catch(error => {
        if (!__networkSniffingFirstError) __networkSniffingFirstError = error;
        console.error(
          'Sniff Network ' + profile.name + ' timeout cleanup failed:',
          error && error.message ? error.message : error,
        );
      });
    }, timeout);
  }
  console.debug('Sniff Network ' + profile.name + ' started');
  return {
    profile: profile.name,
    timeout,
    maxBodyBytes: __networkSniffingMaxBodyBytes,
    startedAt: profile.startedAt,
  };
};

/* @help Advanced
 * @sig $stopSniffing(profileName?)
 * @aliases stop network capture, stop monitoring requests
 * @desc Stop a named network capture, complete pending request records, drain its callback queue and return a summary.
 * @nodal-desc Stop and drain an active named network sniffing profile.
 * @nodal-output object { profile:string, reason:string, captured:number, startedAt:number, stoppedAt:number, draining:boolean }
 * @nodal-param profileName [sniff-profile]: Existing sniffing profile to stop. Defaults to Default.
 */
const $stopSniffing = async function(profileName = 'Default') {
  const normalizedName = __normalizeNetworkSniffingProfileName(profileName, '$stopSniffing');
  if (__networkSniffingCallbackActive) {
    const profile = __networkSniffingProfiles.get(normalizedName);
    if (!profile) {
      throw new Error('$stopSniffing: sniffing profile "' + normalizedName + '" is not active.');
    }
    void __stopNetworkSniffingProfile(normalizedName, 'manual').catch(error => {
      if (!__networkSniffingFirstError) __networkSniffingFirstError = error;
      console.error(
        'Sniff Network ' + normalizedName + ' deferred cleanup failed:',
        error && error.message ? error.message : error,
      );
    });
    return {
      profile: normalizedName,
      reason: 'manual',
      captured: profile.captured,
      startedAt: profile.startedAt,
      stoppedAt: Date.now(),
      draining: true,
    };
  }
  return await __stopNetworkSniffingProfile(profileName, 'manual');
};
