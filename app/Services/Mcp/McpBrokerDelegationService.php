<?php

namespace App\Services\Mcp;

use App\Models\McpAccessToken;
use App\Models\McpBrokerAuthorizationCode;
use App\Models\User;
use App\Models\Workspace;
use App\Services\FeatureFlags\FeatureFlagService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class McpBrokerDelegationService
{
    private const AUTHORIZATION_CODE_TTL_SECONDS = 120;

    public function __construct(
        private readonly FeatureFlagService $features,
    ) {}

    /** @return Collection<int, Workspace> */
    public function eligibleWorkspaces(User $user): Collection
    {
        return $this->eligibleWorkspaceQuery($user)
            ->orderBy('workspaces.name')
            ->get(['workspaces.id', 'workspaces.name', 'workspaces.slug', 'workspaces.lookup_key']);
    }

    public function createAuthorizationCode(
        User $user,
        string $workspaceId,
        string $redirectUri,
        string $codeChallenge,
    ): string {
        $this->ensureAvailable();

        $workspace = $this->eligibleWorkspaceQuery($user)->whereKey($workspaceId)->firstOrFail();
        $plainCode = 'mcp_ac_'.Str::random(64);

        DB::transaction(function () use ($plainCode, $user, $workspace, $redirectUri, $codeChallenge): void {
            McpBrokerAuthorizationCode::query()->where('expires_at', '<=', now())->delete();
            McpBrokerAuthorizationCode::create([
                'code_hash' => hash('sha256', $plainCode),
                'user_id' => $user->id,
                'workspace_id' => $workspace->id,
                'redirect_uri' => $redirectUri,
                'code_challenge' => $codeChallenge,
                'expires_at' => now()->addSeconds(self::AUTHORIZATION_CODE_TTL_SECONDS),
            ]);
        });

        return $plainCode;
    }

    /** @return array<string, mixed>|null */
    public function exchange(string $plainCode, string $codeVerifier): ?array
    {
        $this->ensureAvailable();

        return DB::transaction(function () use ($plainCode, $codeVerifier): ?array {
            McpBrokerAuthorizationCode::query()->where('expires_at', '<=', now())->delete();

            $authorization = McpBrokerAuthorizationCode::query()
                ->where('code_hash', hash('sha256', $plainCode))
                ->lockForUpdate()
                ->first();

            if (
                ! $authorization
                || $authorization->expires_at->isPast()
                || ! hash_equals($authorization->redirect_uri, $this->configuredCallbackUrl() ?? '')
                || ! hash_equals($authorization->code_challenge, $this->s256Challenge($codeVerifier))
            ) {
                return null;
            }

            $user = User::find($authorization->user_id);
            if (! $user) {
                return null;
            }

            $workspace = $this->eligibleWorkspaceQuery($user)->whereKey($authorization->workspace_id)->first();
            if (! $workspace) {
                return null;
            }

            $authorization->delete();

            $plainToken = 'mcp_'.Str::random(56);
            McpAccessToken::create([
                'workspace_id' => $workspace->id,
                'user_id' => $user->id,
                'name' => 'Central MCP Broker',
                'token_hash' => hash('sha256', $plainToken),
                'token_preview' => substr($plainToken, 0, 6).'...'.substr($plainToken, -4),
                'broker_created' => true,
            ]);

            return [
                'access_token' => $plainToken,
                'token_type' => 'Bearer',
                'workspace' => [
                    'id' => $workspace->id,
                    'name' => $workspace->name,
                    'slug' => $workspace->slug,
                    'lookup_key' => $workspace->lookup_key,
                ],
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'email_verified' => $user->email_verified_at !== null,
                ],
                'instance_origin' => $this->instanceOrigin(),
            ];
        }, 3);
    }

    public function revokeAccessToken(string $plainToken): bool
    {
        return DB::transaction(function () use ($plainToken): bool {
            $token = McpAccessToken::query()
                ->where('token_hash', hash('sha256', $plainToken))
                ->where('broker_created', true)
                ->lockForUpdate()
                ->first();

            if (! $token) {
                return false;
            }

            if ($token->revoked_at === null) {
                $token->update(['revoked_at' => now()]);
            }

            return true;
        }, 3);
    }

    public function ensureAvailable(): void
    {
        $this->features->abortIfDisabled('mcp_enabled');
        abort_unless($this->configuredCallbackUrl() !== null, 404);
    }

    public function configuredCallbackUrl(): ?string
    {
        $url = config('puppetflow.mcp_broker.callback_url');

        return is_string($url) && $url !== '' ? $url : null;
    }

    /** @return Builder<Workspace> */
    private function eligibleWorkspaceQuery(User $user): Builder
    {
        $query = $user->isAdmin() ? Workspace::query() : $user->workspaces()->getQuery();

        $query->whereHas('mcpSetting', function (Builder $setting): void {
            $setting->where('enabled', true)->where('stale', false);
        });

        if (! $user->isAdmin()) {
            $query->where(function (Builder $workspace): void {
                $workspace->whereNull('workspaces.expires_at')
                    ->orWhere('workspaces.expires_at', '>', now());
            });
        }

        return $query;
    }

    private function s256Challenge(string $verifier): string
    {
        return rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
    }

    private function instanceOrigin(): string
    {
        $configuredUrl = config('app.url');
        $url = is_string($configuredUrl) ? $configuredUrl : 'http://localhost';
        $parts = parse_url($url);
        $scheme = is_array($parts) && is_string($parts['scheme'] ?? null) ? $parts['scheme'] : 'http';
        $host = is_array($parts) && is_string($parts['host'] ?? null) ? $parts['host'] : 'localhost';
        $host = str_contains($host, ':') ? '['.trim($host, '[]').']' : $host;
        $port = is_array($parts) && isset($parts['port']) ? ':'.(int) $parts['port'] : '';

        return strtolower($scheme).'://'.strtolower($host).$port;
    }
}
