import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { URLSearchParams } from 'node:url';

const host = process.env.DUMMY_MCP_HOST || '127.0.0.1';
const port = Number(process.env.DUMMY_MCP_PORT || 3333);
const origin = process.env.DUMMY_MCP_ORIGIN || `http://${host}:${port}`;
const sessions = new Map();
const streamableSessions = new Map();
const authorizationCodes = new Map();
const refreshTokens = new Set(['dummy-oauth-refresh-token']);

const credentials = {
  bearer: 'dummy-bearer-token',
  headerName: 'X-Dummy-Key',
  headerValue: 'dummy-header-key',
  multipleHeaders: {
    'x-dummy-client': 'dummy-client',
    'x-dummy-secret': 'dummy-secret',
  },
  oauthAccessToken: 'dummy-oauth-access-token',
};

const tools = [
  {
    name: 'echo',
    description: 'Return the provided message and the active authentication mode.',
    inputSchema: {
      type: 'object',
      properties: { message: { type: 'string' } },
      required: ['message'],
    },
  },
  {
    name: 'add',
    description: 'Add two numbers.',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'get_auth_context',
    description: 'Return the authentication mode accepted by this endpoint.',
    inputSchema: { type: 'object', properties: {} },
  },
];

function json(res, status, payload, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

function text(res, status, payload, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readJson(req) {
  const raw = await readBody(req);
  return raw ? JSON.parse(raw) : {};
}

function authModeFromPath(pathname) {
  const match = pathname.match(/^\/(?:mcp|sse)(?:\/messages)?\/([^/]+)$/);
  return match?.[1] ?? null;
}

function isAuthorized(req, mode) {
  if (mode === 'none') return true;
  if (mode === 'bearer') return req.headers.authorization === `Bearer ${credentials.bearer}`;
  if (mode === 'header') return req.headers['x-dummy-key'] === credentials.headerValue;
  if (mode === 'multiple-headers') {
    return Object.entries(credentials.multipleHeaders)
      .every(([name, value]) => req.headers[name] === value);
  }
  if (mode === 'oauth') {
    return req.headers.authorization === `Bearer ${credentials.oauthAccessToken}`;
  }
  return false;
}

function requireAuthentication(req, res, mode) {
  if (isAuthorized(req, mode)) return true;
  const headers = mode === 'oauth'
    ? {
        'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp/oauth"`,
      }
    : {};
  json(res, 401, {
    error: 'unauthorized',
    message: `Authentication failed for dummy mode "${mode}".`,
  }, headers);
  return false;
}

function toolResult(name, args, mode) {
  if (name === 'echo') {
    return {
      content: [{ type: 'text', text: JSON.stringify({ message: String(args.message ?? ''), authentication: mode }) }],
    };
  }
  if (name === 'add') {
    const a = Number(args.a);
    const b = Number(args.b);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return {
        isError: true,
        content: [{ type: 'text', text: 'Both a and b must be finite numbers.' }],
      };
    }
    return { content: [{ type: 'text', text: String(a + b) }] };
  }
  if (name === 'get_auth_context') {
    return {
      content: [{ type: 'text', text: JSON.stringify({ authentication: mode, server: 'Puppetflow Dummy MCP' }) }],
    };
  }
  return {
    isError: true,
    content: [{ type: 'text', text: `Unknown dummy tool: ${name}` }],
  };
}

function handleRpc(message, mode) {
  const id = message?.id;
  if (message?.method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'Puppetflow Dummy MCP', version: '1.0.0' },
      },
    };
  }
  if (message?.method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools } };
  }
  if (message?.method === 'tools/call') {
    return {
      jsonrpc: '2.0',
      id,
      result: toolResult(message.params?.name, message.params?.arguments ?? {}, mode),
    };
  }
  if (message?.method?.startsWith('notifications/')) return null;
  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${message?.method ?? ''}` },
  };
}

async function handleStreamable(req, res, url, mode) {
  if (!requireAuthentication(req, res, mode)) return;
  const requestedSessionId = typeof req.headers['mcp-session-id'] === 'string'
    ? req.headers['mcp-session-id']
    : null;
  if (req.method === 'DELETE') {
    if (!requestedSessionId || streamableSessions.get(requestedSessionId) !== mode) {
      json(res, 404, { error: 'Unknown or expired Streamable HTTP session.' });
      return;
    }
    streamableSessions.delete(requestedSessionId);
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { Allow: 'POST, DELETE' });
    res.end();
    return;
  }
  const message = await readJson(req);
  const initializing = message?.method === 'initialize';
  if (!initializing && (!requestedSessionId || streamableSessions.get(requestedSessionId) !== mode)) {
    json(res, 404, { error: 'Unknown or expired Streamable HTTP session.' });
    return;
  }
  const sessionId = initializing ? randomUUID() : requestedSessionId;
  if (initializing) streamableSessions.set(sessionId, mode);
  const response = handleRpc(message, mode);
  if (!response) {
    res.writeHead(202);
    res.end();
    return;
  }
  json(res, 200, response, {
    'Mcp-Session-Id': sessionId,
    'MCP-Protocol-Version': '2025-06-18',
  });
}

function openSse(req, res, mode) {
  if (!requireAuthentication(req, res, mode)) return;
  const sessionId = randomUUID();
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.write(`event: endpoint\ndata: /sse/messages/${mode}?session=${sessionId}\n\n`);
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 15000);
  sessions.set(sessionId, { res, mode, heartbeat });
  req.on('close', () => {
    clearInterval(heartbeat);
    sessions.delete(sessionId);
  });
}

async function handleSseMessage(req, res, url, mode) {
  if (req.method !== 'POST') {
    res.writeHead(405, { Allow: 'POST' });
    res.end();
    return;
  }
  if (!requireAuthentication(req, res, mode)) return;
  const session = sessions.get(url.searchParams.get('session'));
  if (!session || session.mode !== mode) {
    json(res, 404, { error: 'Unknown or expired SSE session.' });
    return;
  }
  const message = await readJson(req);
  const response = handleRpc(message, mode);
  if (response) session.res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
  res.writeHead(202);
  res.end();
}

function oauthMetadata(res) {
  json(res, 200, {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    scopes_supported: ['dummy.read', 'dummy.write'],
  });
}

function oauthProtectedResource(res) {
  json(res, 200, {
    resource: `${origin}/mcp/oauth`,
    authorization_servers: [origin],
    scopes_supported: ['dummy.read', 'dummy.write'],
  });
}

function authorizationPage(res, url) {
  const fields = ['client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method', 'resource', 'scope']
    .map(name => `<input type="hidden" name="${name}" value="${escapeHtml(url.searchParams.get(name) ?? '')}">`)
    .join('');
  text(res, 200, `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Dummy MCP OAuth</title></head>
<body style="font-family:system-ui;max-width:520px;margin:64px auto;padding:24px">
  <h1>Dummy MCP OAuth</h1>
  <p>This fake authorization grants access to the local MCP test server.</p>
  <form method="post" action="/oauth/approve">
    ${fields}
    <button type="submit" style="padding:10px 16px">Authorize Puppetflow</button>
  </form>
</body>
</html>`, 'text/html; charset=utf-8');
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character]);
}

async function approveAuthorization(req, res) {
  const params = new URLSearchParams(await readBody(req));
  const redirectUri = params.get('redirect_uri');
  const state = params.get('state');
  if (!redirectUri || !state) {
    json(res, 422, { error: 'redirect_uri and state are required.' });
    return;
  }
  const code = randomUUID();
  authorizationCodes.set(code, {
    clientId: params.get('client_id'),
    challenge: params.get('code_challenge'),
  });
  const redirect = new URL(redirectUri);
  redirect.searchParams.set('code', code);
  redirect.searchParams.set('state', state);
  res.writeHead(302, { Location: redirect.toString() });
  res.end();
}

async function issueToken(req, res) {
  const params = new URLSearchParams(await readBody(req));
  const grantType = params.get('grant_type');
  if (grantType === 'authorization_code') {
    const code = params.get('code');
    const authorization = code ? authorizationCodes.get(code) : null;
    const verifier = params.get('code_verifier');
    const challenge = verifier
      ? createHash('sha256').update(verifier).digest('base64url')
      : null;
    if (
      !code
      || !authorization
      || authorization.clientId !== params.get('client_id')
      || !authorization.challenge
      || authorization.challenge !== challenge
    ) {
      json(res, 400, { error: 'invalid_grant' });
      return;
    }
    authorizationCodes.delete(code);
  } else if (grantType === 'refresh_token') {
    if (!refreshTokens.has(params.get('refresh_token'))) {
      json(res, 400, { error: 'invalid_grant' });
      return;
    }
  } else {
    json(res, 400, { error: 'unsupported_grant_type' });
    return;
  }
  json(res, 200, {
    access_token: credentials.oauthAccessToken,
    refresh_token: 'dummy-oauth-refresh-token',
    token_type: 'Bearer',
    expires_in: 3600,
    scope: params.get('scope') || 'dummy.read dummy.write',
  });
}

async function route(req, res) {
  const url = new URL(req.url, origin);
  const mode = authModeFromPath(url.pathname);

  if (url.pathname === '/health') {
    json(res, 200, { status: 'ok', server: 'Puppetflow Dummy MCP' });
    return;
  }
  if (url.pathname === '/.well-known/oauth-protected-resource/mcp/oauth') {
    oauthProtectedResource(res);
    return;
  }
  if (url.pathname === '/.well-known/oauth-authorization-server') {
    oauthMetadata(res);
    return;
  }
  if (url.pathname === '/oauth/register' && req.method === 'POST') {
    json(res, 201, {
      client_id: `dummy-client-${randomUUID()}`,
      token_endpoint_auth_method: 'none',
    });
    return;
  }
  if (url.pathname === '/oauth/authorize' && req.method === 'GET') {
    authorizationPage(res, url);
    return;
  }
  if (url.pathname === '/oauth/approve' && req.method === 'POST') {
    await approveAuthorization(req, res);
    return;
  }
  if (url.pathname === '/oauth/token' && req.method === 'POST') {
    await issueToken(req, res);
    return;
  }
  if (mode && url.pathname.startsWith('/mcp/')) {
    await handleStreamable(req, res, url, mode);
    return;
  }
  if (mode && url.pathname.startsWith('/sse/messages/')) {
    await handleSseMessage(req, res, url, mode);
    return;
  }
  if (mode && url.pathname.startsWith('/sse/') && req.method === 'GET') {
    openSse(req, res, mode);
    return;
  }
  json(res, 404, { error: 'Not found.' });
}

const server = http.createServer((req, res) => {
  route(req, res).catch(error => {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: error instanceof Error ? error.message : String(error) });
    else res.end();
  });
});

server.listen(port, host, () => {
  console.log(`Dummy MCP server: ${origin}`);
  console.log(`Streamable HTTP: ${origin}/mcp/{none|bearer|header|multiple-headers|oauth}`);
  console.log(`SSE: ${origin}/sse/{none|bearer|header|multiple-headers|oauth}`);
  console.log(`Bearer token: ${credentials.bearer}`);
  console.log(`${credentials.headerName}: ${credentials.headerValue}`);
  console.log('Multiple headers: X-Dummy-Client: dummy-client, X-Dummy-Secret: dummy-secret');
  console.log('OAuth uses dynamic registration. Approve access in the browser.');
});

function shutdown() {
  for (const session of sessions.values()) {
    clearInterval(session.heartbeat);
    session.res.end();
  }
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
