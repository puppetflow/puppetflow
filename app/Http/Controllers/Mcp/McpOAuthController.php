<?php

namespace App\Http\Controllers\Mcp;

use App\Contracts\BrandingProvider;
use App\Http\Controllers\Controller;
use App\Models\Workspace;
use App\Services\FeatureFlags\FeatureFlagService;
use App\Services\Mcp\McpOauthClientService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class McpOAuthController extends Controller
{
    public function __construct(
        private readonly McpOauthClientService $oauthClients,
        private readonly FeatureFlagService $features,
    ) {}

    public function protectedResource(Request $request, string $workspace): JsonResponse
    {
        $this->enabledWorkspace($workspace);
        $origin = $request->getSchemeAndHttpHost();

        return response()->json([
            'resource' => $this->resourceUrl($origin, $workspace),
            'authorization_servers' => [$this->issuerUrl($origin, $workspace)],
            'bearer_methods_supported' => ['header'],
            'scopes_supported' => ['mcp'],
            'resource_name' => app(BrandingProvider::class)->current()['name'].' MCP',
        ]);
    }

    public function authorizationServer(Request $request, string $workspace): JsonResponse
    {
        $this->enabledWorkspace($workspace);
        $origin = $request->getSchemeAndHttpHost();

        return response()->json([
            'issuer' => $this->issuerUrl($origin, $workspace),
            'authorization_endpoint' => $origin.'/oauth/authorize',
            'token_endpoint' => $origin.'/oauth/token',
            'registration_endpoint' => $origin.'/oauth/register/'.rawurlencode($workspace),
            'scopes_supported' => ['mcp'],
            'response_types_supported' => ['code'],
            'response_modes_supported' => ['query'],
            'grant_types_supported' => ['authorization_code', 'refresh_token'],
            'token_endpoint_auth_methods_supported' => ['none'],
            'code_challenge_methods_supported' => ['S256'],
        ]);
    }

    public function register(Request $request, string $workspace): JsonResponse
    {
        $resolvedWorkspace = $this->enabledWorkspace($workspace);
        $payload = $request->json()->all();
        $redirectUris = $this->redirectUris($payload['redirect_uris'] ?? null);

        if (
            isset($payload['token_endpoint_auth_method'])
            && $payload['token_endpoint_auth_method'] !== 'none'
        ) {
            return $this->invalidMetadata('Only public clients using token_endpoint_auth_method "none" are supported.');
        }

        if (! $this->containsOnly($payload['grant_types'] ?? ['authorization_code', 'refresh_token'], ['authorization_code', 'refresh_token'])) {
            return $this->invalidMetadata('Only authorization_code and refresh_token grants are supported.');
        }

        if (! $this->containsOnly($payload['response_types'] ?? ['code'], ['code'])) {
            return $this->invalidMetadata('Only the code response type is supported.');
        }

        $scope = trim(is_string($payload['scope'] ?? null) ? $payload['scope'] : 'mcp');
        if ($scope !== 'mcp') {
            return $this->invalidMetadata('Only the mcp scope is supported.');
        }

        if ($redirectUris === []) {
            return $this->invalidMetadata('At least one valid redirect_uri is required.');
        }

        $name = trim(is_string($payload['client_name'] ?? null) ? $payload['client_name'] : 'MCP client');
        $name = mb_substr($name !== '' ? $name : 'MCP client', 0, 255);

        $client = $this->oauthClients->create(
            $resolvedWorkspace,
            $name,
            $redirectUris,
            dynamicallyRegistered: true,
        )['client'];

        return response()->json([
            'client_id' => $client->id,
            'client_name' => $name,
            'redirect_uris' => $redirectUris,
            'token_endpoint_auth_method' => 'none',
            'grant_types' => ['authorization_code', 'refresh_token'],
            'response_types' => ['code'],
            'scope' => 'mcp',
            'client_id_issued_at' => $client->created_at?->getTimestamp() ?? now()->getTimestamp(),
        ], 201);
    }

    private function enabledWorkspace(string $reference): Workspace
    {
        abort_unless($this->features->enabled('mcp_enabled'), 404);

        $workspace = Workspace::query()
            ->where('id', $reference)
            ->orWhere('lookup_key', $reference)
            ->firstOrFail();
        $setting = $workspace->mcpSetting;
        abort_unless($setting && ! $setting->stale && $setting->enabled, 404);

        return $workspace;
    }

    /** @return list<string> */
    private function redirectUris(mixed $value): array
    {
        if (! is_array($value) || $value === [] || count($value) > 10) {
            return [];
        }

        $uris = [];
        foreach ($value as $uri) {
            if (! is_string($uri) || strlen($uri) > 2048 || ! $this->validRedirectUri($uri)) {
                return [];
            }
            $uris[] = $uri;
        }

        return array_values(array_unique($uris));
    }

    private function validRedirectUri(string $uri): bool
    {
        if (preg_match('/[\x00-\x20\x7f]/', $uri) === 1) {
            return false;
        }

        $parts = parse_url($uri);
        if (
            $parts === false
            || isset($parts['fragment'], $parts['user'], $parts['pass'])
            || ! isset($parts['scheme'], $parts['host'])
        ) {
            return false;
        }

        $scheme = strtolower($parts['scheme']);
        $host = strtolower(trim($parts['host'], '[]'));

        return $scheme === 'https'
            || ($scheme === 'http' && in_array($host, ['localhost', '127.0.0.1', '::1'], true));
    }

    /** @param list<string> $allowed */
    private function containsOnly(mixed $value, array $allowed): bool
    {
        if (! is_array($value) || $value === []) {
            return false;
        }

        foreach ($value as $item) {
            if (! is_string($item) || ! in_array($item, $allowed, true)) {
                return false;
            }
        }

        return true;
    }

    private function invalidMetadata(string $description): JsonResponse
    {
        return response()->json([
            'error' => 'invalid_client_metadata',
            'error_description' => $description,
        ], 400);
    }

    private function resourceUrl(string $origin, string $workspace): string
    {
        return $origin.'/api/workspaces/'.rawurlencode($workspace).'/mcp-server/http';
    }

    private function issuerUrl(string $origin, string $workspace): string
    {
        return $origin.'/workspaces/'.rawurlencode($workspace);
    }
}
