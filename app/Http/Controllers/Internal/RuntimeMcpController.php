<?php

namespace App\Http\Controllers\Internal;

use App\Authorization\AuthorizationContextFactory;
use App\Authorization\Visibility\SharedResourceVisibility;
use App\Enums\Authorization\Ability;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Internal\Concerns\ResolvesRuntimeActor;
use App\Models\Flow;
use App\Models\FlowRun;
use App\Models\McpCredential;
use App\Models\User;
use App\Services\FeatureFlags\FeatureFlagService;
use App\Services\Mcp\McpClientService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

final class RuntimeMcpController extends Controller
{
    use ResolvesRuntimeActor;

    public function __construct(
        private readonly McpClientService $client,
        private readonly AuthorizationContextFactory $authorizationContexts,
        private readonly SharedResourceVisibility $visibility,
        private readonly FeatureFlagService $features,
    ) {}

    public function tools(Request $request): JsonResponse
    {
        $this->assertAvailable();
        $validated = $this->validateServer($request);
        [$run, $flow, $actor] = $this->runtimeContext($request);
        $credential = $this->credential($validated, $flow, $actor);
        $endpoint = $credential->requiredEndpoint();
        $tools = $this->client->listTools(
            $endpoint,
            $credential->transport(),
            $credential,
            $validated['timeout'],
            $this->sessionKey($run, $validated['nodeId'], $credential, $endpoint),
        );
        $mode = $validated['tools']['mode'];
        $names = array_values(array_filter($validated['tools']['names'] ?? [], 'is_string'));
        $tools = array_values(array_filter(
            $tools,
            fn (array $tool): bool => $this->toolAllowed($tool['name'], $mode, $names),
        ));
        abort_if(count($tools) > 256, 422, 'An AI node cannot expose more than 256 MCP tools.');
        $prefix = $this->toolPrefix($validated['nodeId']);
        $projected = array_map(fn (array $tool): array => [
            'name' => $this->exposedToolName($prefix, $tool['name']),
            'sourceName' => $tool['name'],
            'serverNodeId' => $validated['nodeId'],
            'credentialName' => $credential->name,
            'description' => $tool['description'],
            'inputSchema' => $tool['inputSchema'],
        ], $tools);

        return response()->json([
            'tools' => $projected,
            'runId' => $run->id,
        ]);
    }

    public function call(Request $request): JsonResponse
    {
        $this->assertAvailable();
        $validated = $this->validateServer($request, withTool: true);
        [$run, $flow, $actor] = $this->runtimeContext($request);
        $credential = $this->credential($validated, $flow, $actor);
        $endpoint = $credential->requiredEndpoint();
        $tool = $validated['tool'] ?? null;
        abort_unless(is_string($tool), 422, 'MCP tool is required.');
        $mode = $validated['tools']['mode'];
        $names = array_values(array_filter($validated['tools']['names'] ?? [], 'is_string'));
        abort_unless($this->toolAllowed($tool, $mode, $names), 422, 'The MCP tool is not enabled for this node.');

        return response()->json([
            'result' => $this->client->callTool(
                $endpoint,
                $credential->transport(),
                $credential,
                $tool,
                $this->toolArguments($validated),
                $validated['timeout'],
                $this->sessionKey($run, $validated['nodeId'], $credential, $endpoint),
            ),
        ]);
    }

    /**
     * @return array{
     *     nodeId: string,
     *     credentialId: string,
     *     tools: array{mode: string, names?: list<string>},
     *     timeout: int,
     *     tool?: string,
     *     arguments?: array<string, mixed>,
     *     arguments_json?: string
     * }
     */
    private function validateServer(Request $request, bool $withTool = false): array
    {
        $rules = [
            'nodeId' => ['required', 'string', 'max:255'],
            'credentialId' => ['required', 'string', 'max:255'],
            'tools' => ['required', 'array'],
            'tools.mode' => ['required', Rule::in(['all', 'selected', 'except'])],
            'tools.names' => ['nullable', 'array', 'max:500'],
            'tools.names.*' => ['string', 'max:255', 'distinct'],
            'timeout' => ['required', 'integer', 'min:1', 'max:900000'],
        ];
        if ($withTool) {
            $rules += [
                'tool' => ['required', 'string', 'max:255'],
                'arguments' => ['nullable', 'array'],
                'arguments_json' => ['nullable', 'json', 'max:1000000'],
            ];
        }

        return $request->validate($rules);
    }

    /**
     * @param  array{
     *     credentialId: string
     * }  $server
     */
    private function credential(array $server, Flow $flow, User $actor): McpCredential
    {
        $credentialId = $server['credentialId'];
        $context = $this->authorizationContexts->for($actor, $flow->workspace_id);
        $query = McpCredential::query()
            ->whereKey($credentialId)
            ->where('workspace_id', $flow->workspace_id)
            ->where('is_active', true)
            ->where('stale', false);
        $this->visibility->applyUse($query, $context);
        $credential = $query->first();
        abort_unless($credential instanceof McpCredential, 404, 'MCP credential not found or not available.');
        abort_unless(Gate::forUser($actor)->allows(Ability::USE->value, $credential), 403);

        return $credential;
    }

    private function toolPrefix(string $nodeId): string
    {
        $prefix = preg_replace('/[^A-Za-z0-9_-]+/', '_', $nodeId) ?: 'mcp';

        return trim($prefix, '_');
    }

    private function exposedToolName(string $prefix, string $tool): string
    {
        $safeTool = preg_replace('/[^A-Za-z0-9_-]+/', '_', $tool) ?: 'tool';
        $base = trim($prefix.'_'.$safeTool, '_') ?: 'mcp_tool';
        $suffix = substr(hash('sha256', $prefix."\0".$tool), 0, 8);

        return substr($base, 0, 55).'_'.$suffix;
    }

    private function sessionKey(
        FlowRun $run,
        string $nodeId,
        McpCredential $credential,
        string $endpoint,
    ): string {
        $runId = $run->getKey();
        abort_unless(is_int($runId) || is_string($runId), 500, 'Flow run ID is invalid.');

        return $runId.':'.json_encode([
            'node' => $nodeId,
            'transport' => $credential->transport(),
            'endpoint' => $endpoint,
            'authentication' => $credential->authentication,
            'credential' => $credential->id,
        ], JSON_THROW_ON_ERROR);
    }

    private function assertAvailable(): void
    {
        $this->features->abortIfDisabled('mcp_enabled');
        $this->features->abortIfDisabled('ai_enabled');
    }

    /** @param list<string> $names */
    private function toolAllowed(string $tool, string $mode, array $names): bool
    {
        return match ($mode) {
            'selected' => in_array($tool, $names, true),
            'except' => ! in_array($tool, $names, true),
            default => true,
        };
    }

    /** @param array<string, mixed> $validated
     * @return array<string, mixed>
     */
    private function toolArguments(array $validated): array
    {
        if (is_string($validated['arguments_json'] ?? null)) {
            $decoded = json_decode($validated['arguments_json']);
            abort_unless($decoded instanceof \stdClass, 422, 'MCP tool arguments must be a JSON object.');

            return get_object_vars($decoded);
        }

        return is_array($validated['arguments'] ?? null) ? $validated['arguments'] : [];
    }
}
