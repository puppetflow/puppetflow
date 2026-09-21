<?php

namespace App\Http\Controllers\Mcp;

use App\Authorization\AuthorizationContextFactory;
use App\Authorization\ResourceAssignmentValidator;
use App\Authorization\Visibility\SharedResourceVisibility;
use App\Enums\Authorization\Ability;
use App\Http\Controllers\Controller;
use App\Models\McpCredential;
use App\Models\User;
use App\Models\UserVariable;
use App\Services\FeatureFlags\FeatureFlagService;
use App\Services\Mcp\McpClientService;
use App\Services\Mcp\McpHeaderValidator;
use App\Services\Mcp\McpOAuthService;
use App\Services\Variable\VariableResolverService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class McpCredentialController extends Controller
{
    public function __construct(
        private readonly AuthorizationContextFactory $authorizationContexts,
        private readonly SharedResourceVisibility $visibility,
        private readonly ResourceAssignmentValidator $assignments,
        private readonly FeatureFlagService $features,
        private readonly McpOAuthService $oauth,
        private readonly McpClientService $client,
        private readonly McpHeaderValidator $headers,
        private readonly VariableResolverService $variables,
    ) {}

    public function showFromVariable(Request $request): JsonResponse
    {
        $this->features->abortIfDisabled('mcp_enabled');
        $validated = $request->validate([
            'credential_variable_id' => ['required', 'string'],
        ]);
        $variable = UserVariable::query()
            ->whereKey($validated['credential_variable_id'])
            ->where('workspace_id', $this->workspaceIdFromSession())
            ->where('type', UserVariable::TYPE_MCP_CREDENTIALS)
            ->where('stale', false)
            ->firstOrFail();
        Gate::authorize(Ability::UPDATE->value, $variable);
        $credential = $this->credentialFromVariable($request, $validated['credential_variable_id']);
        Gate::authorize(Ability::UPDATE->value, $credential);

        return response()->json([
            'credential' => [
                ...$this->publicCredential($credential),
                'config' => $this->editableConfig($credential),
            ],
            'variable' => $this->publicVariable($variable),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->features->abortIfDisabled('mcp_enabled');
        Gate::authorize(Ability::CREATE->value, McpCredential::class);
        $validated = $this->validateCredential($request);
        /** @var User $user */
        $user = $request->user();
        $workspaceId = $this->workspaceIdFromSession();
        $ownerData = array_key_exists('user_id', $validated) ? ['user_id' => $validated['user_id']] : [];
        $ownerId = $this->resolveOwnerId($ownerData, $workspaceId, $user->id);
        $teamId = $validated['scope'] === 'team'
            ? $this->resolveWorkspaceTeamId($validated['team_id'] ?? null, $workspaceId)
            : null;
        $this->assignments->validate($workspaceId, $ownerId, $validated['scope'], $teamId);
        if (isset($validated['variable_key'])) {
            $this->features->abortIfDisabled('variables_enabled');
        }
        [$credential, $variable] = DB::transaction(function () use ($validated, $workspaceId, $ownerId, $teamId): array {
            $credential = McpCredential::query()->create([
                'workspace_id' => $workspaceId,
                'user_id' => $ownerId,
                'team_id' => $teamId,
                'name' => $validated['name'],
                'authentication' => $validated['authentication'],
                'config' => $validated['config'],
                'scope' => $validated['scope'],
                'is_active' => $validated['is_active'],
            ]);
            $variable = isset($validated['variable_key'])
                ? UserVariable::query()->create([
                    'workspace_id' => $workspaceId,
                    'user_id' => $ownerId,
                    'team_id' => $teamId,
                    'key' => $validated['variable_key'],
                    'value' => $credential->id,
                    'type' => UserVariable::TYPE_MCP_CREDENTIALS,
                    'scope' => $validated['scope'],
                    'group' => $validated['variable_group'] ?? null,
                ])
                : null;

            return [$credential, $variable];
        });

        return response()->json([
            'credential' => $this->publicCredential($credential),
            ...($variable instanceof UserVariable ? ['variable' => $this->publicVariable($variable)] : []),
        ], 201);
    }

    public function updateFromVariable(Request $request, UserVariable $variable): JsonResponse
    {
        $this->features->abortIfDisabled('mcp_enabled');
        $this->features->abortIfDisabled('variables_enabled');
        $this->features->abortIfStale($variable);
        abort_unless(
            $variable->workspace_id === $this->workspaceIdFromSession()
            && $variable->type === UserVariable::TYPE_MCP_CREDENTIALS,
            404,
        );
        Gate::authorize(Ability::UPDATE->value, $variable);
        $credential = $this->credentialFromVariable($request, $variable->id);
        Gate::authorize(Ability::UPDATE->value, $credential);
        abort_unless($credential->user_id === $variable->user_id, 409, 'The credential owner does not match its variable.');

        $validated = $this->validateCredential($request, $credential, allowVariableFields: true);
        $workspaceId = $credential->workspace_id;
        $ownerData = array_key_exists('user_id', $validated) ? ['user_id' => $validated['user_id']] : [];
        $ownerId = $this->resolveOwnerId($ownerData, $workspaceId, $credential->user_id);
        $teamId = $validated['scope'] === 'team'
            ? $this->resolveWorkspaceTeamId($validated['team_id'] ?? null, $workspaceId)
            : null;
        if (
            $validated['scope'] !== $credential->scope
            || $validated['scope'] !== $variable->scope
            || $teamId !== $credential->team_id
            || $teamId !== $variable->team_id
        ) {
            Gate::authorize(Ability::MANAGE_SCOPE->value, $credential);
            Gate::authorize(Ability::MANAGE_SCOPE->value, $variable);
        }
        $this->assignments->validate(
            $workspaceId,
            $ownerId,
            $validated['scope'],
            $teamId,
        );
        $config = $this->mergedConfig($credential, $validated['authentication'], $validated['config']);

        DB::transaction(function () use ($credential, $variable, $validated, $ownerId, $teamId, $config): void {
            $credential->update([
                'user_id' => $ownerId,
                'name' => $validated['name'],
                'authentication' => $validated['authentication'],
                'config' => $config,
                'scope' => $validated['scope'],
                'team_id' => $teamId,
                'is_active' => $validated['is_active'],
            ]);
            $variable->update([
                'user_id' => $ownerId,
                'key' => $validated['variable_key'] ?? $variable->key,
                ...(array_key_exists('variable_group', $validated)
                    ? ['group' => $validated['variable_group']]
                    : []),
                'scope' => $validated['scope'],
                'team_id' => $teamId,
            ]);
        });

        return response()->json([
            'credential' => $this->publicCredential($credential->refresh()),
            'variable' => $this->publicVariable($variable->refresh()),
        ]);
    }

    public function discoverTools(Request $request): JsonResponse
    {
        $this->features->abortIfDisabled('mcp_enabled');
        $validated = $request->validate([
            'credential_variable_id' => ['required', 'string', 'exists:user_variables,id'],
            'timeout' => ['nullable', 'integer', 'min:1', 'max:900000'],
        ]);
        $credential = $this->credentialFromVariable($request, $validated['credential_variable_id']);
        $endpoint = $credential->requiredEndpoint();

        return response()->json([
            'tools' => $this->client->listTools(
                $endpoint,
                $credential->transport(),
                $credential,
                (int) ($validated['timeout'] ?? 60000),
            ),
        ]);
    }

    public function beginOAuth(Request $request, McpCredential $mcpCredential): JsonResponse
    {
        $this->features->abortIfDisabled('mcp_enabled');
        $this->features->abortIfStale($mcpCredential);
        $this->assertWorkspace($mcpCredential);
        Gate::authorize(Ability::UPDATE->value, $mcpCredential);
        abort_unless($mcpCredential->authentication === 'mcpOAuth2', 422, 'This credential does not use MCP OAuth2.');
        $validated = $request->validate([
            'dynamic_registration' => ['nullable', 'boolean'],
        ]);

        return response()->json($this->oauth->begin(
            $mcpCredential,
            $mcpCredential->requiredEndpoint(),
            $validated['dynamic_registration'] ?? true,
        ));
    }

    public function beginOAuthFromVariable(Request $request): JsonResponse
    {
        $this->features->abortIfDisabled('mcp_enabled');
        $validated = $request->validate([
            'credential_variable_id' => ['required', 'string'],
            'dynamic_registration' => ['nullable', 'boolean'],
        ]);
        $credential = $this->credentialFromVariable(
            $request,
            $validated['credential_variable_id'],
        );
        abort_unless($credential->authentication === 'mcpOAuth2', 422, 'This credential does not use MCP OAuth2.');
        Gate::authorize(Ability::UPDATE->value, $credential);

        return response()->json($this->oauth->begin(
            $credential,
            $credential->requiredEndpoint(),
            $validated['dynamic_registration'] ?? true,
        ));
    }

    public function completeOAuth(Request $request): View
    {
        $this->features->abortIfDisabled('mcp_enabled');
        $validated = $request->validate([
            'state' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'required_without:error', 'string', 'max:4096'],
            'error' => ['nullable', 'required_without:code', 'string', 'max:255'],
            'error_description' => ['nullable', 'string', 'max:2048'],
        ]);
        $credential = $this->oauth->pendingCredential($validated['state']);
        $this->features->abortIfStale($credential);
        $this->assertWorkspace($credential);
        Gate::authorize(Ability::UPDATE->value, $credential);
        if (is_string($validated['error'] ?? null)) {
            $this->oauth->cancel($validated['state'], $credential->id);
            $message = is_string($validated['error_description'] ?? null) && $validated['error_description'] !== ''
                ? $validated['error_description']
                : 'Authorization was declined or cancelled.';

            return view('mcp.oauth-complete', ['authorized' => false, 'message' => $message]);
        }
        $this->oauth->complete($validated['state'], $validated['code'], $credential->id);

        return view('mcp.oauth-complete', ['authorized' => true]);
    }

    /** @return array{name: string, authentication: string, config: array<string, mixed>, scope: string, team_id?: string|null, user_id?: string|null, is_active: bool, variable_key?: string, variable_group?: string|null} */
    private function validateCredential(
        Request $request,
        ?McpCredential $existing = null,
        bool $allowVariableFields = false,
    ): array {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'authentication' => ['required', Rule::in(['bearer', 'header', 'multipleHeaders', 'mcpOAuth2'])],
            'scope' => ['nullable', Rule::in($this->features->allowedScopes('user'))],
            'team_id' => ['nullable', 'string'],
            'user_id' => ['nullable', 'string', 'exists:users,id'],
            'is_active' => ['nullable', 'boolean'],
            'variable_key' => [$existing === null || $allowVariableFields ? 'nullable' : 'prohibited', 'string', 'max:255'],
            'variable_group' => [$existing === null || $allowVariableFields ? 'nullable' : 'prohibited', 'string', 'max:100'],
            'config' => ['nullable', 'array'],
            'config.endpoint' => ['required', 'url:http,https', 'max:2048'],
            'config.transport' => ['required', Rule::in(['httpStreamable', 'sse'])],
            'config.token' => ['nullable', 'string', 'max:16384'],
            'config.name' => ['nullable', 'string', 'max:255'],
            'config.value' => ['nullable', 'string', 'max:16384'],
            'config.headers' => ['nullable', 'array', 'max:50'],
            'config.headers.*.name' => ['required_with:config.headers', 'string', 'max:255'],
            'config.headers.*.value' => ['present', 'nullable', 'string', 'max:16384'],
            'config.client_id' => ['nullable', 'string', 'max:2048'],
            'config.client_secret' => ['nullable', 'string', 'max:16384'],
            'config.scopes' => ['nullable'],
        ]);
        $validated['scope'] ??= 'user';
        $validated['config'] ??= [];
        $validated['is_active'] ??= $existing === null ? true : $existing->is_active;
        if ($validated['scope'] === 'team' && empty($validated['team_id'])) {
            throw ValidationException::withMessages(['team_id' => 'A team is required for a team credential.']);
        }
        $effectiveConfig = $existing === null
            ? $validated['config']
            : $this->mergedConfig($existing, $validated['authentication'], $validated['config']);
        if (
            $validated['authentication'] === 'bearer'
            && (! is_string($effectiveConfig['token'] ?? null) || trim($effectiveConfig['token']) === '')
        ) {
            throw ValidationException::withMessages(['config.token' => 'A bearer token is required.']);
        }
        if ($validated['authentication'] === 'header' && ! $this->headers->validName($effectiveConfig['name'] ?? null)) {
            throw ValidationException::withMessages(['config.name' => 'Enter a valid, non-reserved header name.']);
        }
        if (
            $validated['authentication'] === 'header'
            && (! is_string($effectiveConfig['value'] ?? null) || trim($effectiveConfig['value']) === '')
        ) {
            throw ValidationException::withMessages(['config.value' => 'A header value is required.']);
        }
        if (
            $validated['authentication'] === 'multipleHeaders'
            && ! $this->validHeaders($effectiveConfig['headers'] ?? null)
        ) {
            throw ValidationException::withMessages(['config.headers' => 'At least one header with a name and value is required.']);
        }

        return $validated;
    }

    private function validHeaders(mixed $headers): bool
    {
        if (! is_array($headers) || $headers === []) {
            return false;
        }
        $names = [];
        foreach ($headers as $header) {
            if (
                ! is_array($header)
                || ! $this->headers->validName($header['name'] ?? null)
                || ! is_string($header['value'] ?? null)
                || trim($header['value']) === ''
            ) {
                return false;
            }
            $name = $this->headers->normalizedName((string) $header['name']);
            if (isset($names[$name])) {
                return false;
            }
            $names[$name] = true;
        }

        return true;
    }

    /** @return array<string, mixed> */
    private function publicCredential(McpCredential $credential): array
    {
        return [
            'id' => $credential->id,
            'name' => $credential->name,
            'authentication' => $credential->authentication,
            'scope' => $credential->scope,
            'team_id' => $credential->team_id,
            'is_active' => $credential->is_active,
        ];
    }

    /** @return array{id: string, key: string, type: string, scope: string} */
    private function publicVariable(UserVariable $variable): array
    {
        return [
            'id' => $variable->id,
            'key' => $variable->key,
            'type' => $variable->type,
            'scope' => $variable->scope,
        ];
    }

    /** @return array<string, mixed> */
    private function editableConfig(McpCredential $credential): array
    {
        $config = $credential->config ?? [];
        $connection = [
            'endpoint' => is_string($config['endpoint'] ?? null) ? $config['endpoint'] : '',
            'transport' => in_array($config['transport'] ?? null, ['httpStreamable', 'sse'], true)
                ? $config['transport']
                : '',
        ];

        return array_merge($connection, match ($credential->authentication) {
            'bearer' => ['token' => ''],
            'header' => [
                'name' => is_string($config['name'] ?? null) ? $config['name'] : '',
                'value' => '',
            ],
            'multipleHeaders' => [
                'headers' => collect(is_array($config['headers'] ?? null) ? $config['headers'] : [])
                    ->filter(fn (mixed $header): bool => is_array($header) && is_string($header['name'] ?? null))
                    ->map(fn (array $header): array => ['name' => $header['name'], 'value' => ''])
                    ->values()
                    ->all(),
            ],
            'mcpOAuth2' => [
                'client_id' => is_string($config['client_id'] ?? null) ? $config['client_id'] : '',
                'client_secret' => '',
                'scopes' => is_string($config['scopes'] ?? null) ? $config['scopes'] : '',
            ],
            default => [],
        });
    }

    private function credentialFromVariable(
        Request $request,
        string $variableId,
    ): McpCredential {
        $this->features->abortIfDisabled('variables_enabled');
        /** @var User $user */
        $user = $request->user();
        $workspaceId = $this->workspaceIdFromSession();
        $context = $this->authorizationContexts->for($user, $workspaceId);
        $query = UserVariable::query()
            ->whereKey($variableId)
            ->where('workspace_id', $workspaceId)
            ->where('type', UserVariable::TYPE_MCP_CREDENTIALS)
            ->where('stale', false);
        $this->visibility->applyUse($query, $context);
        $variable = $query->first();
        abort_unless($variable instanceof UserVariable, 404, 'Stored Credential variable not found or not available.');
        Gate::authorize(Ability::USE->value, $variable);
        $credentialId = $variable->vault_integration_id === null
            ? $variable->value
            : $this->variables->resolveVariable($variable, $workspaceId);
        abort_unless(is_string($credentialId) && $credentialId !== '', 422, 'The variable does not reference a Stored Credential.');
        $credential = McpCredential::query()
            ->whereKey($credentialId)
            ->where('workspace_id', $workspaceId)
            ->where('is_active', true)
            ->where('stale', false)
            ->first();
        abort_unless($credential instanceof McpCredential, 404, 'Stored Credential not found or not available.');
        Gate::authorize(Ability::USE->value, $credential);

        return $credential;
    }

    private function assertWorkspace(McpCredential $credential): void
    {
        abort_unless($credential->workspace_id === $this->workspaceIdFromSession(), 404);
    }

    /**
     * @param  array<string, mixed>  $incoming
     * @return array<string, mixed>
     */
    private function mergedConfig(
        McpCredential $credential,
        string $authentication,
        array $incoming,
    ): array {
        if ($credential->authentication !== $authentication) {
            return $incoming;
        }

        $existing = $credential->config ?? [];
        $merged = array_replace($existing, $incoming);
        foreach (['token', 'value', 'client_secret'] as $key) {
            if (
                array_key_exists($key, $incoming)
                && ($incoming[$key] === '' || $incoming[$key] === null)
                && array_key_exists($key, $existing)
            ) {
                $merged[$key] = $existing[$key];
            }
        }

        if (isset($incoming['headers']) && is_array($incoming['headers'])) {
            $existingHeaders = collect(is_array($existing['headers'] ?? null) ? $existing['headers'] : [])
                ->filter(fn (mixed $header): bool => is_array($header) && is_string($header['name'] ?? null))
                ->keyBy(fn (array $header): string => $this->headers->normalizedName($header['name']));
            $merged['headers'] = collect($incoming['headers'])
                ->map(function (mixed $header) use ($existingHeaders): mixed {
                    if (! is_array($header) || ! is_string($header['name'] ?? null)) {
                        return $header;
                    }
                    if (($header['value'] ?? null) === '' || ($header['value'] ?? null) === null) {
                        $previous = $existingHeaders->get($this->headers->normalizedName($header['name']));
                        if (is_array($previous) && array_key_exists('value', $previous)) {
                            $header['value'] = $previous['value'];
                        }
                    }

                    return $header;
                })
                ->all();
        }
        if ($authentication === 'mcpOAuth2' && $this->oauthIdentityChanged($existing, $incoming)) {
            unset(
                $merged['access_token'],
                $merged['refresh_token'],
                $merged['token_type'],
                $merged['expires_at'],
            );
        }

        return $merged;
    }

    /**
     * @param  array<string, mixed>  $existing
     * @param  array<string, mixed>  $incoming
     */
    private function oauthIdentityChanged(array $existing, array $incoming): bool
    {
        foreach (['endpoint', 'client_id', 'scopes'] as $key) {
            $incomingValue = is_string($incoming[$key] ?? null) && trim($incoming[$key]) !== ''
                ? trim($incoming[$key])
                : null;
            $existingValue = is_string($existing[$key] ?? null) && trim($existing[$key]) !== ''
                ? trim($existing[$key])
                : null;
            if (array_key_exists($key, $incoming) && $incomingValue !== $existingValue) {
                return true;
            }
        }

        return is_string($incoming['client_secret'] ?? null)
            && $incoming['client_secret'] !== ''
            && $incoming['client_secret'] !== ($existing['client_secret'] ?? null);
    }
}
