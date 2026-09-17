<?php

namespace App\Services\Mcp;

use App\Models\McpCredential;
use App\Services\Security\PublicHttpTargetGuard;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

final class McpClientService
{
    private const PROTOCOL_VERSION = '2025-06-18';

    private const MAX_TOOL_PAGES = 100;

    private const MAX_TOOLS = 5000;

    private const SESSION_TTL_MINUTES = 30;

    public function __construct(
        private readonly PublicHttpTargetGuard $targetGuard,
        private readonly McpOAuthService $oauth,
        private readonly McpHeaderValidator $headerValidator,
    ) {}

    /** @return list<array{name: string, description: string, inputSchema: array<string, mixed>}> */
    public function listTools(
        string $endpoint,
        string $transport,
        ?McpCredential $credential,
        int $timeout = 60000,
        ?string $sessionKey = null,
    ): array {
        try {
            return $this->listToolsFromFirstPage($endpoint, $transport, $credential, $timeout, $sessionKey);
        } catch (ValidationException $exception) {
            if (! isset($exception->errors()['pagination'])) {
                throw $exception;
            }

            return $this->listToolsFromFirstPage($endpoint, $transport, $credential, $timeout, $sessionKey);
        }
    }

    /** @return list<array{name: string, description: string, inputSchema: array<string, mixed>}> */
    private function listToolsFromFirstPage(
        string $endpoint,
        string $transport,
        ?McpCredential $credential,
        int $timeout,
        ?string $sessionKey,
    ): array {
        $cursor = null;
        $tools = [];
        $seenCursors = [];
        $page = 0;
        do {
            if (++$page > self::MAX_TOOL_PAGES) {
                throw ValidationException::withMessages(['endpoint' => 'MCP tool pagination exceeded the page limit.']);
            }
            $params = $cursor === null ? [] : ['cursor' => $cursor];
            $result = $this->request($endpoint, $transport, $credential, 'tools/list', $params, $timeout, $sessionKey);
            foreach (is_array($result['tools'] ?? null) ? $result['tools'] : [] as $tool) {
                if (! is_array($tool) || ! is_string($tool['name'] ?? null)) {
                    continue;
                }
                $tools[] = [
                    'name' => $tool['name'],
                    'description' => is_string($tool['description'] ?? null) ? $tool['description'] : '',
                    'inputSchema' => is_array($tool['inputSchema'] ?? null)
                        ? $tool['inputSchema']
                        : ['type' => 'object', 'properties' => new \stdClass],
                ];
                if (count($tools) > self::MAX_TOOLS) {
                    throw ValidationException::withMessages(['endpoint' => 'MCP server returned too many tools.']);
                }
            }
            $cursor = array_key_exists('nextCursor', $result) && is_string($result['nextCursor'])
                ? $result['nextCursor']
                : null;
            if ($cursor !== null) {
                if (isset($seenCursors[$cursor])) {
                    throw ValidationException::withMessages(['endpoint' => 'MCP tool pagination repeated a cursor.']);
                }
                $seenCursors[$cursor] = true;
            }
        } while ($cursor !== null);

        return $tools;
    }

    /** @param array<string, mixed> $arguments
     * @return array<string, mixed>
     */
    public function callTool(
        string $endpoint,
        string $transport,
        ?McpCredential $credential,
        string $tool,
        array $arguments,
        int $timeout = 60000,
        ?string $sessionKey = null,
    ): array {
        $result = $this->request($endpoint, $transport, $credential, 'tools/call', [
            'name' => $tool,
            'arguments' => $arguments === [] ? new \stdClass : $arguments,
        ], $timeout, $sessionKey);
        if (($result['isError'] ?? false) === true) {
            $message = collect(is_array($result['content'] ?? null) ? $result['content'] : [])
                ->filter(fn (mixed $item): bool => is_array($item) && is_string($item['text'] ?? null))
                ->pluck('text')
                ->implode("\n");
            throw ValidationException::withMessages([
                'tool' => $message !== '' ? $message : "MCP tool {$tool} returned an error.",
            ]);
        }

        return $result;
    }

    /** @param array<string, mixed> $params
     * @return array<string, mixed>
     */
    private function request(
        string $endpoint,
        string $transport,
        ?McpCredential $credential,
        string $method,
        array $params,
        int $timeout,
        ?string $sessionKey,
    ): array {
        $timeout = max(1, min($timeout, 900000));
        if (! in_array($transport, ['httpStreamable', 'sse'], true)) {
            throw ValidationException::withMessages(['transport' => 'Unsupported MCP transport.']);
        }
        $headers = $this->authenticationHeaders($credential);
        $execute = fn (array $requestHeaders): array => $transport === 'sse'
            ? $this->requestSse($endpoint, $requestHeaders, $method, $params, $timeout)
            : $this->requestStreamableHttp($endpoint, $requestHeaders, $method, $params, $timeout, $sessionKey);
        $oauthRefreshed = false;
        $sessionReset = false;
        while (true) {
            try {
                return $execute($headers);
            } catch (ValidationException $exception) {
                if (
                    ! $oauthRefreshed
                    && $credential?->authentication === 'mcpOAuth2'
                    && isset($exception->errors()['credential'])
                ) {
                    $headers = $this->authenticationHeaders($credential, forceOAuthRefresh: true);
                    $oauthRefreshed = true;

                    continue;
                }
                if (
                    ! $sessionReset
                    && $transport === 'httpStreamable'
                    && $sessionKey !== null
                    && isset($exception->errors()['session'])
                ) {
                    Cache::forget('mcp-client-session:'.hash('sha256', $sessionKey));
                    $sessionReset = true;
                    if ($method === 'tools/list' && array_key_exists('cursor', $params)) {
                        throw ValidationException::withMessages([
                            'pagination' => 'The MCP session changed during tool pagination.',
                        ]);
                    }

                    continue;
                }
                throw $exception;
            }
        }
    }

    /** @param array<string, string> $headers
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function requestStreamableHttp(
        string $endpoint,
        array $headers,
        string $method,
        array $params,
        int $timeout,
        ?string $sessionKey,
    ): array {
        $cacheKey = $sessionKey !== null ? 'mcp-client-session:'.hash('sha256', $sessionKey) : null;
        $cachedSession = $cacheKey !== null ? Cache::get($cacheKey) : null;
        $sessionId = is_array($cachedSession) ? ($cachedSession['id'] ?? null) : $cachedSession;
        $protocolVersion = is_array($cachedSession) && is_string($cachedSession['protocol_version'] ?? null)
            ? $cachedSession['protocol_version']
            : self::PROTOCOL_VERSION;
        $newSession = false;
        $completed = false;
        try {
            if (! is_string($sessionId) || $sessionId === '') {
                $initialize = $this->postJsonRpc($endpoint, $headers, null, 1, 'initialize', [
                    'protocolVersion' => self::PROTOCOL_VERSION,
                    'capabilities' => new \stdClass,
                    'clientInfo' => ['name' => 'Puppetflow', 'version' => '1.0'],
                ], $timeout, self::PROTOCOL_VERSION);
                $sessionId = $initialize['session_id'];
                $newSession = $sessionId !== null;
                $negotiatedVersion = $initialize['result']['protocolVersion'] ?? null;
                $protocolVersion = is_string($negotiatedVersion) && $negotiatedVersion !== ''
                    ? $negotiatedVersion
                    : self::PROTOCOL_VERSION;
                $this->postNotification($endpoint, $headers, $sessionId, 'notifications/initialized', $timeout, $protocolVersion);
            }
            $response = $this->postJsonRpc($endpoint, $headers, $sessionId, 2, $method, $params, $timeout, $protocolVersion);
            if ($cacheKey !== null && $sessionId !== null) {
                Cache::put($cacheKey, [
                    'id' => $sessionId,
                    'protocol_version' => $protocolVersion,
                ], now()->addMinutes(self::SESSION_TTL_MINUTES));
            }
            $completed = true;

            return $response['result'];
        } finally {
            if (
                ($cacheKey === null || ($newSession && ! $completed))
                && is_string($sessionId)
                && $sessionId !== ''
            ) {
                try {
                    $this->terminateSession($endpoint, $headers, $sessionId, $timeout, $protocolVersion);
                } catch (ConnectionException) {
                    // Session cleanup is best effort and must not hide the original request result.
                }
            }
        }
    }

    /** @param array<string, string> $headers
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function requestSse(
        string $endpoint,
        array $headers,
        string $method,
        array $params,
        int $timeout,
    ): array {
        $deadline = microtime(true) + ($timeout / 1000);
        $response = $this->pendingRequest(
            $endpoint,
            array_merge($headers, ['Accept' => 'text/event-stream']),
            $this->remainingTimeout($deadline),
        )
            ->withOptions(['stream' => true] + $this->targetOptions($endpoint))
            ->get($endpoint);
        if ($response->failed()) {
            $this->throwSseFailure($response, 'connection');
        }
        $body = $response->toPsrResponse()->getBody()->detach();
        if (! is_resource($body)) {
            throw ValidationException::withMessages(['endpoint' => 'MCP SSE server returned an unreadable stream.']);
        }
        stream_set_blocking($body, false);
        $buffer = '';
        try {
            $messageEndpoint = $this->readSseEndpoint($body, $buffer, $endpoint, $deadline);

            $initializeId = 1;
            $this->postSseMessage($messageEndpoint, $headers, [
                'jsonrpc' => '2.0',
                'id' => $initializeId,
                'method' => 'initialize',
                'params' => [
                    'protocolVersion' => self::PROTOCOL_VERSION,
                    'capabilities' => new \stdClass,
                    'clientInfo' => ['name' => 'Puppetflow', 'version' => '1.0'],
                ],
            ], $this->remainingTimeout($deadline));
            $this->readSseResponse($body, $buffer, $initializeId, $deadline);
            $this->postSseMessage($messageEndpoint, $headers, [
                'jsonrpc' => '2.0',
                'method' => 'notifications/initialized',
            ], $this->remainingTimeout($deadline));
            $requestId = 2;
            $this->postSseMessage($messageEndpoint, $headers, [
                'jsonrpc' => '2.0',
                'id' => $requestId,
                'method' => $method,
                'params' => $params === [] ? new \stdClass : $params,
            ], $this->remainingTimeout($deadline));

            return $this->readSseResponse($body, $buffer, $requestId, $deadline);
        } finally {
            fclose($body);
        }
    }

    /** @param array<string, string> $headers
     * @param  array<string, mixed>  $params
     * @return array{result: array<string, mixed>, session_id: string|null}
     */
    private function postJsonRpc(
        string $endpoint,
        array $headers,
        ?string $sessionId,
        int $id,
        string $method,
        array $params,
        int $timeout,
        string $protocolVersion,
    ): array {
        $requestHeaders = array_merge($headers, [
            'Accept' => 'application/json, text/event-stream',
            'MCP-Protocol-Version' => $protocolVersion,
        ]);
        if ($sessionId !== null) {
            $requestHeaders['Mcp-Session-Id'] = $sessionId;
        }
        $response = $this->pendingRequest($endpoint, $requestHeaders, $timeout)->post($endpoint, [
            'jsonrpc' => '2.0',
            'id' => $id,
            'method' => $method,
            'params' => $params === [] ? new \stdClass : $params,
        ]);
        if ($sessionId !== null && $response->status() === 404) {
            throw ValidationException::withMessages(['session' => 'The MCP session expired.']);
        }
        $payload = $this->decodeResponse($response, $id);

        return [
            'result' => $payload,
            'session_id' => $response->header('Mcp-Session-Id') ?: $sessionId,
        ];
    }

    /** @param array<string, string> $headers */
    private function postNotification(
        string $endpoint,
        array $headers,
        ?string $sessionId,
        string $method,
        int $timeout,
        string $protocolVersion,
    ): void {
        $requestHeaders = array_merge($headers, [
            'Accept' => 'application/json, text/event-stream',
            'MCP-Protocol-Version' => $protocolVersion,
        ]);
        if ($sessionId !== null) {
            $requestHeaders['Mcp-Session-Id'] = $sessionId;
        }
        $response = $this->pendingRequest($endpoint, $requestHeaders, $timeout)->post($endpoint, [
            'jsonrpc' => '2.0',
            'method' => $method,
        ]);
        if ($response->failed()) {
            throw ValidationException::withMessages(['endpoint' => "MCP notification failed with HTTP {$response->status()}."]);
        }
    }

    /** @param array<string, string> $headers */
    private function terminateSession(
        string $endpoint,
        array $headers,
        ?string $sessionId,
        int $timeout,
        string $protocolVersion,
    ): void {
        if ($sessionId === null) {
            return;
        }
        $this->pendingRequest($endpoint, array_merge($headers, [
            'Mcp-Session-Id' => $sessionId,
            'MCP-Protocol-Version' => $protocolVersion,
        ]), min($timeout, 5000))
            ->delete($endpoint);
    }

    /** @return array<string, mixed> */
    private function decodeResponse(Response $response, int $id): array
    {
        if ($response->failed()) {
            if ($response->status() === 401) {
                throw ValidationException::withMessages(['credential' => 'MCP authentication failed.']);
            }
            throw ValidationException::withMessages(['endpoint' => "MCP request failed with HTTP {$response->status()}."]);
        }
        $contentType = strtolower($response->header('Content-Type'));
        $decoded = str_contains($contentType, 'text/event-stream')
            ? $this->decodeSseText($response->body(), $id)
            : $response->json();
        if (! is_array($decoded)) {
            throw ValidationException::withMessages(['endpoint' => 'MCP returned an invalid JSON-RPC response.']);
        }
        if (isset($decoded['error'])) {
            $error = is_array($decoded['error']) ? $decoded['error'] : [];
            $message = is_string($error['message'] ?? null) ? $error['message'] : 'Unknown MCP error.';
            throw ValidationException::withMessages(['endpoint' => $message]);
        }
        $result = $decoded['result'] ?? null;

        return is_array($result) ? $result : [];
    }

    /** @return array<string, mixed> */
    private function decodeSseText(string $body, int $id): array
    {
        foreach (preg_split('/\r\n\r\n|\n\n|\r\r/', trim($body)) ?: [] as $event) {
            $decoded = json_decode($this->parseSseEvent($event)['data'], true);
            if (is_array($decoded) && ($decoded['id'] ?? null) === $id) {
                return $decoded;
            }
        }

        return [];
    }

    /** @param resource $body */
    private function readSseEndpoint($body, string &$buffer, string $baseUrl, float $deadline): string
    {
        while (microtime(true) < $deadline && ! feof($body)) {
            $buffer .= $this->readSseChunk($body);
            while (($event = $this->shiftSseEvent($buffer)) !== null) {
                $parsed = $this->parseSseEvent($event);
                if ($parsed['event'] !== 'endpoint') {
                    continue;
                }
                $resolved = $this->resolveUrl($baseUrl, trim($parsed['data']));
                $this->targetOptions($resolved);

                return $resolved;
            }
        }
        throw ValidationException::withMessages(['endpoint' => 'MCP SSE server did not provide a message endpoint.']);
    }

    /**
     * @param  resource  $body
     * @return array<string, mixed>
     */
    private function readSseResponse($body, string &$buffer, int $id, float $deadline): array
    {
        while (microtime(true) < $deadline && ! feof($body)) {
            $buffer .= $this->readSseChunk($body);
            while (($event = $this->shiftSseEvent($buffer)) !== null) {
                $decoded = json_decode($this->parseSseEvent($event)['data'], true);
                if (! is_array($decoded) || ($decoded['id'] ?? null) !== $id) {
                    continue;
                }
                if (isset($decoded['error'])) {
                    $error = is_array($decoded['error']) ? $decoded['error'] : [];
                    throw ValidationException::withMessages([
                        'endpoint' => is_string($error['message'] ?? null)
                            ? $error['message']
                            : 'Unknown MCP error.',
                    ]);
                }

                return is_array($decoded['result'] ?? null) ? $decoded['result'] : [];
            }
        }
        throw ValidationException::withMessages(['endpoint' => 'MCP SSE response timed out.']);
    }

    /** @param resource $body */
    private function readSseChunk($body): string
    {
        $chunk = fread($body, 8192);
        if (is_string($chunk) && $chunk !== '') {
            return $chunk;
        }

        usleep(10000);

        return '';
    }

    private function shiftSseEvent(string &$buffer): ?string
    {
        if (preg_match('/\r\n\r\n|\n\n|\r\r/', $buffer, $matches, PREG_OFFSET_CAPTURE) !== 1) {
            return null;
        }

        $separator = $matches[0][0];
        $position = $matches[0][1];
        $event = substr($buffer, 0, $position);
        $buffer = substr($buffer, $position + strlen($separator));

        return $event;
    }

    /** @return array{event: string, data: string} */
    private function parseSseEvent(string $event): array
    {
        $eventName = '';
        $data = [];
        foreach (preg_split('/\r\n|\r|\n/', $event) ?: [] as $line) {
            if ($line === '' || str_starts_with($line, ':')) {
                continue;
            }
            [$field, $value] = array_pad(explode(':', $line, 2), 2, '');
            $value = str_starts_with($value, ' ') ? substr($value, 1) : $value;
            if ($field === 'event') {
                $eventName = $value;
            } elseif ($field === 'data') {
                $data[] = $value;
            }
        }

        return ['event' => $eventName, 'data' => implode("\n", $data)];
    }

    private function remainingTimeout(float $deadline): int
    {
        $remaining = (int) floor(($deadline - microtime(true)) * 1000);
        if ($remaining < 1) {
            throw ValidationException::withMessages(['endpoint' => 'MCP request timed out.']);
        }

        return $remaining;
    }

    private function resolveUrl(string $baseUrl, string $value): string
    {
        if (filter_var($value, FILTER_VALIDATE_URL) !== false) {
            return $value;
        }

        $parts = parse_url($baseUrl);
        if (! is_array($parts) || ! is_string($parts['scheme'] ?? null) || ! is_string($parts['host'] ?? null)) {
            throw ValidationException::withMessages(['endpoint' => 'The MCP SSE base URL is invalid.']);
        }
        if (str_starts_with($value, '//')) {
            return $parts['scheme'].':'.$value;
        }

        $origin = $parts['scheme'].'://'.$parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : '');
        if (str_starts_with($value, '/')) {
            return $origin.$value;
        }

        $basePath = is_string($parts['path'] ?? null) ? $parts['path'] : '/';
        $directory = trim(dirname($basePath), '/.');

        return $origin.($directory === '' ? '/' : '/'.$directory.'/').ltrim($value, '/');
    }

    /** @param array<string, string> $headers
     * @param  array<string, mixed>  $payload
     */
    private function postSseMessage(string $endpoint, array $headers, array $payload, int $timeout): void
    {
        $response = $this->pendingRequest($endpoint, $headers, $timeout)->post($endpoint, $payload);
        if ($response->failed()) {
            $this->throwSseFailure($response, 'message');
        }
    }

    private function throwSseFailure(Response $response, string $operation): never
    {
        if ($response->status() === 401) {
            throw ValidationException::withMessages(['credential' => 'MCP authentication failed.']);
        }

        throw ValidationException::withMessages([
            'endpoint' => "MCP SSE {$operation} failed with HTTP {$response->status()}.",
        ]);
    }

    /** @return array<string, string> */
    private function authenticationHeaders(?McpCredential $credential, bool $forceOAuthRefresh = false): array
    {
        if ($credential === null) {
            return [];
        }
        $config = $credential->config ?? [];

        return match ($credential->authentication) {
            'bearer' => ['Authorization' => 'Bearer '.$this->requiredString($config, 'token')],
            'header' => $this->singleAuthenticationHeader($config),
            'multipleHeaders' => $this->multipleAuthenticationHeaders($config),
            'mcpOAuth2' => ['Authorization' => 'Bearer '.$this->oauth->accessToken($credential, $forceOAuthRefresh)],
            default => throw ValidationException::withMessages(['credential' => 'Unsupported MCP authentication type.']),
        };
    }

    /** @param array<string, mixed> $config
     * @return array<string, string>
     */
    private function singleAuthenticationHeader(array $config): array
    {
        $name = $this->requiredString($config, 'name');
        if (! $this->headerValidator->validName($name)) {
            throw ValidationException::withMessages(['credential' => 'MCP credential contains an invalid or reserved header name.']);
        }

        return [$name => $this->requiredString($config, 'value')];
    }

    /** @param array<string, mixed> $config
     * @return array<string, string>
     */
    private function multipleAuthenticationHeaders(array $config): array
    {
        $headers = [];
        $names = [];
        foreach (is_array($config['headers'] ?? null) ? $config['headers'] : [] as $header) {
            $nameValue = is_array($header) ? ($header['name'] ?? null) : null;
            if (
                ! is_array($header)
                || ! is_string($nameValue)
                || ! $this->headerValidator->validName($nameValue)
            ) {
                throw ValidationException::withMessages(['credential' => 'MCP credential contains an invalid or reserved header name.']);
            }
            /** @var array<string, mixed> $header */
            $name = trim($nameValue);
            $normalizedName = $this->headerValidator->normalizedName($name);
            if (isset($names[$normalizedName])) {
                throw ValidationException::withMessages(['credential' => 'MCP credential contains duplicate authentication headers.']);
            }
            $names[$normalizedName] = true;
            $headers[$name] = $this->requiredString($header, 'value');
        }
        if ($headers === []) {
            throw ValidationException::withMessages(['credential' => 'MCP credential contains no authentication headers.']);
        }

        return $headers;
    }

    /** @param array<string, mixed> $config */
    private function requiredString(array $config, string $key): string
    {
        $value = $config[$key] ?? null;
        if (! is_string($value) || trim($value) === '') {
            throw ValidationException::withMessages(['credential' => "MCP credential is missing {$key}."]);
        }

        return trim($value);
    }

    /** @param array<string, string> $headers */
    private function pendingRequest(string $endpoint, array $headers, int $timeout): PendingRequest
    {
        return Http::asJson()
            ->withHeaders($headers)
            ->connectTimeout(min(10, max(1, (int) ceil($timeout / 1000))))
            ->timeout(max(1, (int) ceil($timeout / 1000)))
            ->withOptions($this->targetOptions($endpoint));
    }

    /** @return array<string, mixed> */
    private function targetOptions(string $endpoint): array
    {
        return $this->targetGuard->requestOptions(
            $endpoint,
            allowPrivateAddresses: (bool) config('puppetflow.mcp_client_allow_private', false),
            allowHttp: $this->allowHttp(),
        );
    }

    private function allowHttp(): bool
    {
        return (bool) config('puppetflow.mcp_client_allow_http', false);
    }
}
