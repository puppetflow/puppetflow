<?php

namespace App\Http\Controllers\Mcp;

use App\Contracts\BrandingProvider;
use App\Http\Controllers\Controller;
use App\Models\McpOauthClient;
use App\Models\McpOauthWorkspaceGrant;
use App\Models\User;
use App\Models\Workspace;
use App\Services\FeatureFlags\FeatureFlagService;
use App\Services\Mcp\McpBrokerDelegationService;
use App\Services\Mcp\McpOauthClientService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Laravel\Passport\Client;
use Laravel\Passport\Http\Controllers\ConvertsPsrResponses;
use Laravel\Passport\Http\Controllers\HandlesOAuthErrors;
use Laravel\Passport\Http\Controllers\RetrievesAuthRequestFromSession;
use League\OAuth2\Server\AuthorizationServer;
use Psr\Http\Message\ResponseInterface;
use Symfony\Component\HttpFoundation\Response;

/**
 * OAuth discovery, dynamic client registration and consent for the Passport-backed MCP endpoints.
 *
 * Two flavours share this controller: workspace-scoped (the workspace is part of the URL) and
 * instance-level (`/mcp`, the user picks the workspace on the consent screen).
 */
class McpOAuthController extends Controller
{
    use ConvertsPsrResponses, HandlesOAuthErrors, RetrievesAuthRequestFromSession;

    public function __construct(
        private readonly McpOauthClientService $oauthClients,
        private readonly McpBrokerDelegationService $delegation,
        private readonly FeatureFlagService $features,
    ) {}

    public function protectedResource(Request $request, ?string $workspace = null): JsonResponse
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

    public function authorizationServer(Request $request, ?string $workspace = null): JsonResponse
    {
        $this->enabledWorkspace($workspace);
        $origin = $request->getSchemeAndHttpHost();

        return response()->json([
            'issuer' => $this->issuerUrl($origin, $workspace),
            'authorization_endpoint' => $origin.'/oauth/authorize',
            'token_endpoint' => $origin.'/oauth/token',
            'registration_endpoint' => $origin.'/oauth/register'.($workspace === null ? '' : '/'.rawurlencode($workspace)),
            'scopes_supported' => ['mcp'],
            'response_types_supported' => ['code'],
            'response_modes_supported' => ['query'],
            'grant_types_supported' => ['authorization_code', 'refresh_token'],
            'token_endpoint_auth_methods_supported' => ['none'],
            'code_challenge_methods_supported' => ['S256'],
        ]);
    }

    public function register(Request $request, ?string $workspace = null): JsonResponse
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

    /**
     * Passport authorization view: workspace consent for workspace-bound clients,
     * the shared workspace picker for instance-level clients.
     *
     * @param  array<string, mixed>  $parameters
     */
    public function consent(array $parameters): Response
    {
        /** @var Client $client */
        $client = $parameters['client'];
        /** @var User $user */
        $user = $parameters['user'];
        $mcpClient = McpOauthClient::with('workspace')->where('oauth_client_id', $client->id)->first();

        if ($mcpClient === null || $mcpClient->workspace_id !== null) {
            return response()->view('oauth.authorize', [...$parameters, 'mcpClient' => $mcpClient]);
        }

        return Inertia::render('Auth/McpBrokerAuthorize/McpBrokerAuthorize', [
            'workspaces' => $this->delegation->eligibleWorkspaces($user),
            'parameters' => ['auth_token' => $parameters['authToken']],
            'clientName' => $client->name,
            'userEmail' => $user->email,
            'submitUrl' => route('mcp.oauth.approve'),
        ])->toResponse(request());
    }

    /** Approve an instance-level authorization with the workspace picked by the user. */
    public function approve(Request $request, AuthorizationServer $server, ResponseInterface $psrResponse): Response
    {
        $this->features->abortIfDisabled('mcp_enabled');
        /** @var array{workspace_id: string, auth_token: string} $validated */
        $validated = $request->validate([
            'workspace_id' => ['required', 'string', 'max:32'],
            'auth_token' => ['required', 'string'],
        ]);
        /** @var User $user */
        $user = $request->user();

        // Validate before pulling the request from the session so a bad pick can be corrected.
        $workspace = $this->delegation->eligibleWorkspace($user, $validated['workspace_id']);
        if ($workspace === null) {
            throw ValidationException::withMessages(['workspace_id' => 'This workspace is not available for MCP access.']);
        }

        $authRequest = $this->getAuthRequestFromSession($request);
        $clientId = $authRequest->getClient()->getIdentifier();
        abort_unless(
            McpOauthClient::where('oauth_client_id', $clientId)->whereNull('workspace_id')->whereNull('revoked_at')->exists(),
            403,
        );

        McpOauthWorkspaceGrant::updateOrCreate(
            ['user_id' => $user->id, 'oauth_client_id' => $clientId],
            ['workspace_id' => $workspace->id],
        );

        $authRequest->setAuthorizationApproved(true);
        $response = $this->withErrorHandling(fn (): Response => $this->convertResponse(
            $server->completeAuthorizationRequest($authRequest, $psrResponse)
        ));

        // The picker submits through Inertia (XHR): the redirect to the client is
        // cross-origin, so it must be a full-page navigation via Inertia::location.
        $location = $response->headers->get('Location');

        return is_string($location) ? Inertia::location($location) : $response;
    }

    private function enabledWorkspace(?string $reference): ?Workspace
    {
        abort_unless($this->features->enabled('mcp_enabled'), 404);

        if ($reference === null) {
            return null;
        }

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

    private function resourceUrl(string $origin, ?string $workspace): string
    {
        return $workspace === null
            ? $origin.'/mcp'
            : $origin.'/api/workspaces/'.rawurlencode($workspace).'/mcp-server/http';
    }

    private function issuerUrl(string $origin, ?string $workspace): string
    {
        return $workspace === null ? $origin : $origin.'/workspaces/'.rawurlencode($workspace);
    }
}
