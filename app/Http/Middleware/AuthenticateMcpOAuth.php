<?php

namespace App\Http\Middleware;

use App\Models\McpOauthClient;
use App\Models\McpOauthConnection;
use App\Models\McpOauthWorkspaceGrant;
use App\Models\Workspace;
use App\Services\FeatureFlags\FeatureFlagService;
use Closure;
use Illuminate\Http\Request;
use Laravel\Passport\Client;
use Laravel\Passport\Token;
use Symfony\Component\HttpFoundation\Response;

/**
 * Passport bearer authentication for MCP endpoints. The workspace comes from the route
 * (workspace-scoped endpoint) or from the grant recorded at authorization time (instance-level `/mcp`).
 */
class AuthenticateMcpOAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $features = app(FeatureFlagService::class);
        if (! $features->enabled('mcp_enabled')) {
            return response()->json(['error' => 'MCP is disabled for this instance.'], 403);
        }

        $routeReference = $request->route('workspace');
        $instanceLevel = $routeReference === null;
        $routeWorkspace = $instanceLevel ? null : $this->routeWorkspace($routeReference);

        if (! $instanceLevel && ! $routeWorkspace) {
            return response()->json(['error' => 'Workspace not found.'], 404);
        }

        $user = $request->user('api');

        if (! $user) {
            return $this->challenge($request, $routeWorkspace, 'OAuth access token required.');
        }

        /** @var Token|null $token */
        $token = $user->token();
        if (! $token || ($token->can('mcp') === false)) {
            return response()->json(['error' => 'OAuth token is missing the mcp scope.'], 403);
        }

        $workspace = $routeWorkspace ?? McpOauthWorkspaceGrant::query()
            ->where('user_id', $user->id)
            ->where('oauth_client_id', $token->client_id)
            ->first()
            ?->workspace;

        if (! $workspace) {
            return response()->json(['error' => 'No workspace was selected for this OAuth client.'], 403);
        }

        if (! $user->isAdmin() && $workspace->isExpired()) {
            return response()->json(['error' => 'This workspace has expired.'], 403);
        }

        if (! $user->isAdmin() && ! $user->belongsToWorkspace($workspace)) {
            return response()->json(['error' => 'Workspace access revoked.'], 403);
        }

        $setting = $workspace->mcpSetting;
        if (! $setting || $setting->stale || ! $setting->enabled) {
            return response()->json(['error' => 'MCP is disabled for this workspace.'], 403);
        }

        $client = Client::find($token->client_id);
        $mcpClient = McpOauthClient::where('workspace_id', $instanceLevel ? null : $workspace->id)
            ->where('oauth_client_id', $token->client_id)
            ->whereNull('revoked_at')
            ->where('stale', false)
            ->first();
        if (! $mcpClient) {
            return response()->json(['error' => 'OAuth client is unavailable.'], 403);
        }

        $connection = McpOauthConnection::updateOrCreate(
            ['oauth_access_token_id' => $token->id],
            [
                'workspace_id' => $workspace->id,
                'user_id' => $user->id,
                'oauth_client_id' => $token->client_id,
                'client_name' => $client->name ?? 'OAuth client',
                'last_used_at' => now(),
                'revoked_at' => null,
            ],
        );

        $request->setUserResolver(fn () => $user);
        $request->attributes->set('mcpOauthConnection', $connection);
        $request->attributes->set('mcpWorkspace', $workspace);
        $request->attributes->set('mcpSetting', $setting);
        $request->attributes->set('mcpArtifactRouteName', $instanceLevel ? 'mcp.instance.artifacts.download' : 'mcp.oauth.artifacts.download');

        return $next($request);
    }

    private function routeWorkspace(mixed $reference): ?Workspace
    {
        if ($reference instanceof Workspace) {
            return $reference;
        }

        return is_string($reference)
            ? Workspace::where('id', $reference)->first() ?? Workspace::where('lookup_key', $reference)->first()
            : null;
    }

    private function challenge(Request $request, ?Workspace $workspace, string $description): Response
    {
        if ($workspace === null) {
            $resourcePath = '/mcp';
        } else {
            $reference = $request->route('workspace');
            $reference = is_string($reference)
                ? $reference
                : ($workspace->lookup_key ?: $workspace->id);
            $resourcePath = '/api/workspaces/'.rawurlencode($reference).'/mcp-server/http';
        }

        $metadataUrl = $request->getSchemeAndHttpHost().'/.well-known/oauth-protected-resource'.$resourcePath;

        return response()->json([
            'error' => 'invalid_token',
            'error_description' => $description,
        ], 401)->header(
            'WWW-Authenticate',
            'Bearer resource_metadata="'.$metadataUrl.'", scope="mcp"',
        );
    }
}
