<?php

namespace App\Services\Mcp;

use App\Models\McpCredential;
use App\Services\Security\PublicHttpTargetGuard;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class McpOAuthService
{
    public function __construct(private readonly PublicHttpTargetGuard $targetGuard) {}

    /** @return array{authorization_url: string} */
    public function begin(McpCredential $credential, string $endpoint, bool $dynamicRegistration = true): array
    {
        $metadata = $this->discover($endpoint);
        $config = $credential->config ?? [];
        $redirectUri = route('mcp-credentials.oauth.callback');
        $clientId = $this->string($config['client_id'] ?? null);
        $clientSecret = $this->string($config['client_secret'] ?? null);
        $tokenAuthMethod = $this->string($config['token_endpoint_auth_method'] ?? null);

        if ($clientId === null && $dynamicRegistration) {
            $registrationEndpoint = $this->requiredUrl($metadata, 'registration_endpoint');
            $registration = $this->request($registrationEndpoint)->post($registrationEndpoint, [
                'client_name' => 'Puppetflow',
                'redirect_uris' => [$redirectUri],
                'grant_types' => ['authorization_code', 'refresh_token'],
                'response_types' => ['code'],
                'token_endpoint_auth_method' => 'none',
            ]);
            if ($registration->failed()) {
                throw ValidationException::withMessages([
                    'oauth' => 'The MCP authorization server rejected dynamic client registration.',
                ]);
            }
            $clientId = $this->string($registration->json('client_id'));
            $clientSecret = $this->string($registration->json('client_secret'));
            $tokenAuthMethod = $this->string($registration->json('token_endpoint_auth_method')) ?? 'none';
        }

        if ($clientId === null) {
            throw ValidationException::withMessages(['oauth' => 'An OAuth client ID is required.']);
        }
        if ($clientSecret === null) {
            $tokenAuthMethod = 'none';
        } elseif (! in_array($tokenAuthMethod, ['client_secret_basic', 'client_secret_post'], true)) {
            $tokenAuthMethod = null;
        }
        $tokenAuthMethod ??= $this->tokenEndpointAuthMethod($metadata, $clientSecret);

        $state = Str::random(64);
        $verifier = Str::random(96);
        $challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
        $scopes = $this->requestedScopes($config['scopes'] ?? null, $metadata['scopes_supported'] ?? []);

        $credential->update(['config' => array_merge($config, [
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'authorization_endpoint' => $this->requiredUrl($metadata, 'authorization_endpoint'),
            'token_endpoint' => $this->requiredUrl($metadata, 'token_endpoint'),
            'token_endpoint_auth_method' => $tokenAuthMethod,
            'resource' => $endpoint,
            'scopes' => $scopes,
        ])]);
        Cache::put("mcp-oauth-state:{$state}", [
            'credential_id' => $credential->id,
            'verifier' => $verifier,
        ], now()->addMinutes(10));

        $query = array_filter([
            'response_type' => 'code',
            'client_id' => $clientId,
            'redirect_uri' => $redirectUri,
            'scope' => $scopes,
            'state' => $state,
            'code_challenge' => $challenge,
            'code_challenge_method' => 'S256',
            'resource' => $endpoint,
        ], fn (string $value): bool => $value !== '');

        return ['authorization_url' => $this->requiredUrl($metadata, 'authorization_endpoint').'?'.http_build_query($query)];
    }

    public function pendingCredential(string $state): McpCredential
    {
        $pending = $this->pendingState(Cache::get("mcp-oauth-state:{$state}"));

        return McpCredential::query()->findOrFail($pending['credential_id']);
    }

    public function complete(string $state, string $code, string $expectedCredentialId): McpCredential
    {
        $cacheKey = "mcp-oauth-state:{$state}";
        $pending = $this->pendingState(Cache::get($cacheKey));
        if (! hash_equals($expectedCredentialId, $pending['credential_id'])) {
            throw ValidationException::withMessages(['oauth' => 'The MCP OAuth state does not match this credential.']);
        }

        $credential = McpCredential::query()->findOrFail($pending['credential_id']);
        $config = $credential->config ?? [];
        $tokenEndpoint = $this->requiredUrl($config, 'token_endpoint');
        $payload = array_filter([
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => route('mcp-credentials.oauth.callback'),
            'client_id' => $config['client_id'] ?? null,
            'client_secret' => $config['client_secret'] ?? null,
            'code_verifier' => $pending['verifier'],
            'resource' => $config['resource'] ?? null,
        ], fn (mixed $value): bool => $value !== null && $value !== '');
        $response = $this->tokenRequest($tokenEndpoint, $config, $payload);
        if ($response->failed()) {
            throw ValidationException::withMessages(['oauth' => 'The MCP OAuth token exchange failed.']);
        }

        $credential->update(['config' => $this->mergeTokens($config, $response->json(), preserveRefreshToken: false)]);
        Cache::forget($cacheKey);

        return $credential->refresh();
    }

    public function cancel(string $state, string $expectedCredentialId): void
    {
        $cacheKey = "mcp-oauth-state:{$state}";
        $pending = $this->pendingState(Cache::get($cacheKey));
        if (! hash_equals($expectedCredentialId, $pending['credential_id'])) {
            throw ValidationException::withMessages(['oauth' => 'The MCP OAuth state does not match this credential.']);
        }

        Cache::forget($cacheKey);
    }

    /** @return array{credential_id: string, verifier: string} */
    private function pendingState(mixed $pending): array
    {
        if (! is_array($pending) || ! is_string($pending['credential_id'] ?? null) || ! is_string($pending['verifier'] ?? null)) {
            throw ValidationException::withMessages(['oauth' => 'The MCP OAuth state is invalid or expired.']);
        }

        return [
            'credential_id' => $pending['credential_id'],
            'verifier' => $pending['verifier'],
        ];
    }

    public function accessToken(McpCredential $credential, bool $forceRefresh = false): string
    {
        $config = $credential->config ?? [];
        $accessToken = $this->string($config['access_token'] ?? null);
        $expiresAt = is_numeric($config['expires_at'] ?? null) ? (int) $config['expires_at'] : null;
        if (! $forceRefresh && $accessToken !== null && ($expiresAt === null || $expiresAt > time() + 120)) {
            return $accessToken;
        }

        try {
            $token = Cache::lock("mcp-oauth-refresh:{$credential->id}", 45)->block(
                35,
                function () use ($credential, $config, $forceRefresh): string {
                    $credential->refresh();
                    $currentConfig = $credential->config ?? [];
                    $currentToken = $this->string($currentConfig['access_token'] ?? null);
                    $currentExpiry = is_numeric($currentConfig['expires_at'] ?? null)
                        ? (int) $currentConfig['expires_at']
                        : null;
                    $previousExpiry = is_numeric($config['expires_at'] ?? null)
                        ? (int) $config['expires_at']
                        : null;
                    $tokenStateChanged = $currentToken !== $this->string($config['access_token'] ?? null)
                        || $this->string($currentConfig['refresh_token'] ?? null) !== $this->string($config['refresh_token'] ?? null)
                        || $currentExpiry !== $previousExpiry;
                    if (
                        $currentToken !== null
                        && (
                            $tokenStateChanged
                            || (! $forceRefresh && ($currentExpiry === null || $currentExpiry > time() + 120))
                        )
                    ) {
                        return $currentToken;
                    }

                    return $this->refreshAccessToken($credential, $currentConfig);
                },
            );

            return is_string($token)
                ? $token
                : throw ValidationException::withMessages(['credential' => 'The MCP OAuth token refresh failed.']);
        } catch (LockTimeoutException) {
            throw ValidationException::withMessages(['credential' => 'The MCP OAuth credential refresh is busy. Try again.']);
        }
    }

    /** @param array<string, mixed> $config */
    private function refreshAccessToken(McpCredential $credential, array $config): string
    {
        $refreshToken = $this->string($config['refresh_token'] ?? null);
        if ($refreshToken === null) {
            throw ValidationException::withMessages(['credential' => 'The MCP OAuth credential must be authorized again.']);
        }
        $tokenEndpoint = $this->requiredUrl($config, 'token_endpoint');
        $payload = array_filter([
            'grant_type' => 'refresh_token',
            'refresh_token' => $refreshToken,
            'client_id' => $config['client_id'] ?? null,
            'client_secret' => $config['client_secret'] ?? null,
            'scope' => $config['scopes'] ?? null,
            'resource' => $config['resource'] ?? null,
        ], fn (mixed $value): bool => $value !== null && $value !== '');
        $response = $this->tokenRequest($tokenEndpoint, $config, $payload);
        if ($response->failed()) {
            throw ValidationException::withMessages(['credential' => 'The MCP OAuth token refresh failed.']);
        }

        $credential->update(['config' => $this->mergeTokens($config, $response->json())]);
        $credential->refresh();
        $token = $this->string($credential->config['access_token'] ?? null);
        if ($token === null) {
            throw ValidationException::withMessages(['credential' => 'The MCP OAuth server returned no access token.']);
        }

        return $token;
    }

    /** @return array<string, mixed> */
    private function discover(string $endpoint): array
    {
        $endpointParts = parse_url($endpoint);
        if (! is_array($endpointParts) || ! is_string($endpointParts['scheme'] ?? null) || ! is_string($endpointParts['host'] ?? null)) {
            throw ValidationException::withMessages(['endpoint' => 'The MCP endpoint is invalid.']);
        }
        $origin = $endpointParts['scheme'].'://'.$endpointParts['host'].(isset($endpointParts['port']) ? ':'.$endpointParts['port'] : '');
        $path = is_string($endpointParts['path'] ?? null) ? $endpointParts['path'] : '';
        $resourceUrl = $origin.'/.well-known/oauth-protected-resource'.$path;
        $resourceResponse = $this->request($resourceUrl)->get($resourceUrl);
        $resource = $resourceResponse->successful() && is_array($resourceResponse->json()) ? $resourceResponse->json() : [];
        $authorizationServers = is_array($resource['authorization_servers'] ?? null) ? $resource['authorization_servers'] : [];
        $issuer = $this->string($authorizationServers[0] ?? null) ?? $origin;
        $metadataUrl = $this->authorizationServerMetadataUrl($issuer);
        $metadataResponse = $this->request($metadataUrl)->get($metadataUrl);
        if ($metadataResponse->failed() || ! is_array($metadataResponse->json())) {
            throw ValidationException::withMessages(['oauth' => 'Unable to discover the MCP OAuth authorization server.']);
        }

        return array_merge($metadataResponse->json(), $resource);
    }

    private function authorizationServerMetadataUrl(string $issuer): string
    {
        $parts = parse_url($issuer);
        if (! is_array($parts) || ! is_string($parts['scheme'] ?? null) || ! is_string($parts['host'] ?? null)) {
            throw ValidationException::withMessages(['oauth' => 'The MCP OAuth authorization server issuer is invalid.']);
        }

        $origin = $parts['scheme'].'://'.$parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : '');
        $path = trim(is_string($parts['path'] ?? null) ? $parts['path'] : '', '/');

        return $origin.'/.well-known/oauth-authorization-server'.($path === '' ? '' : '/'.$path);
    }

    private function request(string $url): PendingRequest
    {
        return Http::acceptJson()
            ->asJson()
            ->connectTimeout(10)
            ->timeout(30)
            ->withOptions($this->targetGuard->requestOptions(
                $url,
                allowPrivateAddresses: (bool) config('puppetflow.mcp_client_allow_private', false),
                allowHttp: (bool) config('puppetflow.mcp_client_allow_http', false),
            ));
    }

    /**
     * @param  array<string, mixed>  $config
     * @param  array<string, mixed>  $payload
     */
    private function tokenRequest(string $endpoint, array $config, array $payload): \Illuminate\Http\Client\Response
    {
        $request = $this->request($endpoint)->asForm();
        if (($config['token_endpoint_auth_method'] ?? null) !== 'client_secret_basic') {
            return $request->post($endpoint, $payload);
        }

        $clientId = $this->string($config['client_id'] ?? null);
        $clientSecret = $this->string($config['client_secret'] ?? null);
        if ($clientId === null || $clientSecret === null) {
            throw ValidationException::withMessages(['oauth' => 'MCP OAuth client credentials are incomplete.']);
        }
        unset($payload['client_id'], $payload['client_secret']);

        return $request->withBasicAuth($clientId, $clientSecret)->post($endpoint, $payload);
    }

    /** @param array<string, mixed> $metadata */
    private function tokenEndpointAuthMethod(array $metadata, ?string $clientSecret): string
    {
        if ($clientSecret === null) {
            return 'none';
        }

        $supported = is_array($metadata['token_endpoint_auth_methods_supported'] ?? null)
            ? $metadata['token_endpoint_auth_methods_supported']
            : [];
        if (in_array('client_secret_basic', $supported, true) || $supported === []) {
            return 'client_secret_basic';
        }
        if (in_array('client_secret_post', $supported, true)) {
            return 'client_secret_post';
        }

        throw ValidationException::withMessages(['oauth' => 'The MCP OAuth server does not support client secret authentication.']);
    }

    /** @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    private function mergeTokens(array $config, mixed $tokens, bool $preserveRefreshToken = true): array
    {
        if (! is_array($tokens) || ! is_string($tokens['access_token'] ?? null)) {
            throw ValidationException::withMessages(['oauth' => 'The MCP OAuth server returned an invalid token response.']);
        }

        return array_merge($config, [
            'access_token' => $tokens['access_token'],
            'refresh_token' => $tokens['refresh_token'] ?? ($preserveRefreshToken ? ($config['refresh_token'] ?? null) : null),
            'token_type' => $tokens['token_type'] ?? 'Bearer',
            'expires_at' => is_numeric($tokens['expires_in'] ?? null) ? time() + (int) $tokens['expires_in'] : null,
            'scopes' => $tokens['scope'] ?? ($config['scopes'] ?? ''),
        ]);
    }

    /** @param array<string, mixed> $values */
    private function requiredUrl(array $values, string $key): string
    {
        $value = $this->string($values[$key] ?? null);
        if ($value === null || filter_var($value, FILTER_VALIDATE_URL) === false) {
            throw ValidationException::withMessages(['oauth' => "MCP OAuth metadata is missing {$key}."]);
        }
        $this->targetGuard->requestOptions(
            $value,
            allowPrivateAddresses: (bool) config('puppetflow.mcp_client_allow_private', false),
            allowHttp: (bool) config('puppetflow.mcp_client_allow_http', false),
        );

        return $value;
    }

    private function scopeString(mixed $value): string
    {
        if (is_array($value)) {
            return implode(' ', array_values(array_filter($value, 'is_string')));
        }

        return is_string($value) ? trim($value) : '';
    }

    private function requestedScopes(mixed $configured, mixed $supported): string
    {
        $supportedScopes = preg_split('/\s+/', $this->scopeString($supported), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $configuredScopes = preg_split('/\s+/', $this->scopeString($configured), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        if ($supportedScopes === []) {
            return implode(' ', $configuredScopes);
        }
        if ($configuredScopes === []) {
            return implode(' ', $supportedScopes);
        }

        return implode(' ', array_values(array_intersect($configuredScopes, $supportedScopes)));
    }

    private function string(mixed $value): ?string
    {
        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
}
