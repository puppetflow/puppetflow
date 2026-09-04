<?php

namespace App\Services\Mcp\Tools;

use App\Authorization\Visibility\FlowVisibility;
use App\Authorization\Visibility\FolderVisibility;
use App\Enums\Authorization\Ability;
use App\Models\Flow;
use App\Models\Folder;
use App\Rules\ValidNodalGraph;
use App\Services\FeatureFlags\FeatureFlagService;
use App\Services\Flow\FlowWriteService;
use App\Services\Flow\NodalCatalogService;
use App\Services\Mcp\AuthoringResourceProjection;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * @phpstan-type Arguments array<string, mixed>
 * @phpstan-type ToolDefinition array{name: string, description: string, inputSchema: array<string, mixed>}
 */
final class FlowMcpTools implements McpToolHandler
{
    private const TOOL_NAMES = [
        'search_flows',
        'get_flow_details',
        'get_flow_source',
        'list_folders',
        'get_flow_creation_options',
        'get_nodal_catalog',
        'list_flow_resources',
        'write_code_flow',
        'write_nodal_flow',
        'publish_flow',
        'unpublish_flow',
    ];

    public function __construct(
        private readonly FlowVisibility $flowVisibility,
        private readonly FolderVisibility $folderVisibility,
        private readonly McpResourceResolver $resources,
        private readonly FlowWriteService $writer,
        private readonly NodalCatalogService $nodalCatalog,
        private readonly AuthoringResourceProjection $authoringResources,
        private readonly FeatureFlagService $features,
    ) {}

    public function definitions(): array
    {
        $identifier = ['type' => 'string', 'description' => 'Flow ID.'];

        return [
            ['name' => 'search_flows', 'description' => 'Search flows visible to the connected user in this workspace.', 'inputSchema' => ['type' => 'object', 'properties' => [
                'query' => ['type' => 'string'], 'name' => ['type' => 'string'],
                'flow_type' => ['type' => 'string', 'enum' => ['code', 'nodal']],
                'type' => ['type' => 'string', 'enum' => ['code', 'nodal']],
                'folder_id' => ['type' => 'string', 'description' => 'Folder ID.'],
                'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 100, 'default' => 20],
            ]]],
            [
                'name' => 'get_flow_details',
                'description' => 'Get safe details for an MCP-enabled flow, including its default_inputs (called Flow Inputs in the editor). Flow Inputs are a shared JSON object configured on the flow and merged into every run, including manual, webhook, cron, API, and MCP runs. Values supplied by a specific run override default_inputs with the same top-level key. Flow code reads them through $input.key, while nodal expressions use {{ $run.$input.key }}. Treat default_inputs as the flow\'s reusable input defaults and expected input shape, not as per-user or per-run state.',
                'inputSchema' => ['type' => 'object', 'required' => ['flow_id'], 'properties' => ['flow_id' => $identifier]],
            ],
            ['name' => 'get_flow_source', 'description' => 'Get the source code and complete nodal graph for an MCP-enabled flow.', 'inputSchema' => ['type' => 'object', 'required' => ['flow_id'], 'properties' => ['flow_id' => $identifier]]],
            ['name' => 'list_folders', 'description' => 'List folders visible to the connected user in this workspace.', 'inputSchema' => ['type' => 'object', 'properties' => ['search' => ['type' => 'string']]]],
            ['name' => 'get_flow_creation_options', 'description' => 'List allowed visibility scopes, teams, and folders for creating a flow.', 'inputSchema' => ['type' => 'object', 'properties' => new \stdClass]],
            ['name' => 'get_nodal_catalog', 'description' => 'Always-available Puppetflow framework reference. Returns a compact, paginated node list by default. Provide query to retrieve complete matching definitions before authoring a flow. Use mode code for JavaScript helpers or mode nodal for visual nodes.', 'inputSchema' => [
                'type' => 'object',
                'additionalProperties' => false,
                'properties' => [
                    'mode' => ['type' => 'string', 'enum' => ['code', 'nodal'], 'default' => 'nodal'],
                    'query' => ['type' => 'string', 'description' => 'Optional node name, alias, category, or capability. Matching entries include their complete definitions.'],
                    'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 20, 'description' => 'Page size. Defaults to 20 for the compact index and 5 for complete query results.'],
                    'cursor' => ['type' => 'string', 'description' => 'Opaque next_cursor value from a previous response.'],
                ],
            ]],
            ['name' => 'list_flow_resources', 'description' => 'List workspace resources the connected user may reference while authoring a flow or snippet. Resource values, credentials, tokens, destinations, and snippet source are never returned. Provide flow_id to include flow-specific mailbox watchers.', 'inputSchema' => ['type' => 'object', 'properties' => [
                'flow_id' => ['type' => 'string', 'description' => 'Optional flow context. Required to list mailbox watchers.'],
                'kinds' => ['type' => 'array', 'items' => ['type' => 'string', 'enum' => AuthoringResourceProjection::KINDS], 'uniqueItems' => true],
                'query' => ['type' => 'string'],
                'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 100, 'default' => 100],
            ]]],
            $this->codeWriterDefinition(),
            $this->nodalWriterDefinition(),
            [
                'name' => 'publish_flow',
                'description' => 'Publish the current editable flow draft as a new version. Call get_flow_source first and provide its exact content_updated_at value.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['flow_id', 'content_updated_at'],
                    'properties' => [
                        'flow_id' => $identifier,
                        'content_updated_at' => ['type' => 'string', 'description' => 'Exact timestamp returned by get_flow_source.'],
                    ],
                ],
            ],
            [
                'name' => 'unpublish_flow',
                'description' => 'Unpublish a flow without deleting its version history or editable draft. Call get_flow_source first and provide its exact content_updated_at value.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['flow_id', 'content_updated_at'],
                    'properties' => [
                        'flow_id' => $identifier,
                        'content_updated_at' => ['type' => 'string', 'description' => 'Exact timestamp returned by get_flow_source.'],
                    ],
                ],
            ],
        ];
    }

    public function handles(string $name): bool
    {
        return in_array($name, self::TOOL_NAMES, true);
    }

    public function call(string $name, array $arguments, McpToolContext $context): array
    {
        return match ($name) {
            'search_flows' => $this->search($arguments, $context),
            'get_flow_details' => $this->details($arguments, $context),
            'get_flow_source' => $this->source($arguments, $context),
            'list_folders' => $this->folders($arguments, $context),
            'get_flow_creation_options' => $this->creationOptions($context),
            'get_nodal_catalog' => $this->catalog($arguments),
            'list_flow_resources' => $this->flowResources($arguments, $context),
            'write_code_flow' => $this->write($arguments, $context, 'code'),
            'write_nodal_flow' => $this->write($arguments, $context, 'nodal'),
            'publish_flow' => $this->setPublication($arguments, $context, true),
            'unpublish_flow' => $this->setPublication($arguments, $context, false),
            default => throw ValidationException::withMessages(['name' => 'Unknown flow tool.']),
        };
    }

    /** @param Arguments $arguments
     * @return array<string, mixed>
     */
    private function search(array $arguments, McpToolContext $context): array
    {
        $limit = max(1, min(McpToolArguments::integer($arguments, 'limit', 20), 100));
        $query = Flow::query()->where('workspace_id', $context->workspace->id)
            ->with(['folder:id', 'workspaceFolder:id', 'team:id'])
            ->select(['id', 'name', 'description', 'flow_type', 'visibility', 'team_id', 'folder_id', 'workspace_folder_id', 'is_published', 'available_in_mcp', 'updated_at']);
        $this->flowVisibility->applyForUser($query, $context->user, $context->workspace->id);
        if (! $context->setting->include_unexposed_flow_previews) {
            $query->where('available_in_mcp', true);
        }

        $text = trim(McpToolArguments::string($arguments, 'query'));
        if ($text !== '') {
            $query->where(fn (Builder $q) => $q->where('name', 'like', "%{$text}%")
                ->orWhere('description', 'like', "%{$text}%")
                ->orWhere('id', 'like', "%{$text}%"));
        }
        if (($name = trim(McpToolArguments::string($arguments, 'name'))) !== '') {
            $query->where('name', 'like', "%{$name}%");
        }
        $type = trim(McpToolArguments::string($arguments, 'flow_type', McpToolArguments::string($arguments, 'type')));
        if ($type !== '') {
            $query->where('flow_type', $type);
        }
        $folderId = trim(McpToolArguments::string($arguments, 'folder_id'));
        if ($folderId !== '') {
            $folderId = $this->resolveFolderId($folderId, $context, 'folder_id');
            $query->where(fn (Builder $query) => $query
                ->where('folder_id', $folderId)
                ->orWhere('workspace_folder_id', $folderId));
        }

        return ['flows' => $query->orderBy('name')->limit($limit)->get()
            ->map(fn (Flow $flow): array => [
                'id' => $flow->id,
                'name' => $flow->name,
                'description' => $flow->description,
                'flow_type' => $flow->flow_type,
                'visibility' => $flow->visibility,
                'team_id' => $flow->team?->id,
                'folder_id' => $flow->folder?->id,
                'workspace_folder_id' => $flow->workspaceFolder?->id,
                'is_published' => (bool) $flow->is_published,
                'available_in_mcp' => (bool) $flow->available_in_mcp,
                'updated_at' => $flow->updated_at?->toIso8601String(),
            ])->values()];
    }

    /** @param Arguments $arguments
     * @return array<string, mixed>
     */
    private function details(array $arguments, McpToolContext $context): array
    {
        $flow = $this->resources->flow(trim(McpToolArguments::string($arguments, 'flow_id')), $context);
        $flow->load(['owner:id,name', 'team:id,name', 'folder:id', 'workspaceFolder:id']);

        return ['flow' => [
            'id' => $flow->id, 'name' => $flow->name,
            'description' => $flow->description, 'readme' => $flow->readme,
            'source_type' => $flow->source_type, 'flow_type' => $flow->flow_type,
            'manual_input' => $flow->manual_input, 'default_inputs' => $flow->default_inputs,
            'is_published' => (bool) $flow->is_published, 'available_in_mcp' => (bool) $flow->available_in_mcp,
            'visibility' => $flow->visibility, 'team_id' => $flow->team?->id,
            'folder_id' => $flow->folder?->id,
            'workspace_folder_id' => $flow->workspaceFolder?->id,
            'owner_id' => $flow->owner?->id,
            'settings' => [
                'queue_index' => $flow->queue_index,
                'timeout_seconds' => $flow->timeout_seconds, 'operator_seconds' => $flow->operator_seconds,
                'max_retries' => $flow->max_retries, 'include_raw_output' => (bool) $flow->include_raw_output,
                'include_input_in_output' => (bool) $flow->include_input_in_output,
                'include_context_in_output' => (bool) $flow->include_context_in_output,
                'always_success_response' => (bool) $flow->always_success_response,
                'export_artifacts_screenshots' => (bool) $flow->export_artifacts_screenshots,
                'export_artifacts_downloads' => (bool) $flow->export_artifacts_downloads,
                'export_artifacts_recording' => (bool) $flow->export_artifacts_recording,
                'finally_enabled' => (bool) $flow->finally_enabled,
            ],
            'created_at' => $flow->created_at?->toIso8601String(), 'updated_at' => $flow->updated_at?->toIso8601String(),
        ]];
    }

    /** @param Arguments $arguments
     * @return array<string, mixed>
     */
    private function source(array $arguments, McpToolContext $context): array
    {
        $flow = $this->resources->flow(
            trim(McpToolArguments::string($arguments, 'flow_id')),
            $context,
            requireExposed: false,
        );
        if (
            ! $flow->available_in_mcp
            && Gate::forUser($context->user)->denies(Ability::UPDATE->value, $flow)
        ) {
            throw ValidationException::withMessages(['flow_id' => 'Flow is not available in MCP.']);
        }

        return ['flow' => [
            'id' => $flow->id, 'flow_type' => $flow->flow_type,
            'code' => $flow->code, 'nodal_graph' => $flow->nodal_graph,
            'content_updated_at' => $flow->content_updated_at?->toJSON(),
        ]];
    }

    /** @param Arguments $arguments
     * @return array<string, mixed>
     */
    private function folders(array $arguments, McpToolContext $context): array
    {
        $query = Folder::query()->where('workspace_id', $context->workspace->id)
            ->with(['parent:id', 'team:id', 'owner:id'])
            ->select(['id', 'name', 'parent_id', 'is_shared', 'team_id', 'owner_id']);
        $this->folderVisibility->applyForUser($query, $context->user, $context->workspace->id);
        if (($search = trim(McpToolArguments::string($arguments, 'search'))) !== '') {
            $query->where('name', 'like', "%{$search}%");
        }

        return ['folders' => $query->orderBy('name')->get()
            ->map(fn (Folder $folder): array => [
                'id' => $folder->id,
                'name' => $folder->name,
                'parent_id' => $folder->parent?->id,
                'is_shared' => (bool) $folder->is_shared,
                'team_id' => $folder->team?->id,
                'owner_id' => $folder->owner?->id,
            ])->values()];
    }

    /** @return array<string, mixed> */
    private function creationOptions(McpToolContext $context): array
    {
        $folders = $this->folders([], $context)['folders'];
        $teams = $context->user->teams()
            ->where('workspace_id', $context->workspace->id)
            ->orderBy('name')
            ->get(['workspace_teams.id', 'name']);

        return [
            'visibility_scopes' => $this->features->allowedScopes(),
            'teams' => $teams,
            'folders' => $folders,
            'defaults' => ['visibility' => 'owner', 'is_published' => false, 'available_in_mcp' => true],
        ];
    }

    /** @param Arguments $arguments
     * @return array<string, mixed>
     */
    private function catalog(array $arguments): array
    {
        $mode = McpToolArguments::string($arguments, 'mode') === 'code' ? 'code' : 'flow';
        $entries = collect($this->nodalCatalog->entries($mode));
        $query = strtolower(trim(McpToolArguments::string($arguments, 'query')));
        if ($query !== '') {
            $entries = $entries->filter(
                fn (array $entry): bool => str_contains(strtolower((string) json_encode($entry)), $query),
            );
        }
        $entries = $entries->values();
        $total = $entries->count();
        $limit = max(1, min(McpToolArguments::integer($arguments, 'limit', $query === '' ? 20 : 5), 20));
        $cursor = trim(McpToolArguments::string($arguments, 'cursor'));
        $offset = ctype_digit($cursor) ? (int) $cursor : 0;
        $page = $entries->slice($offset, $limit)->values();
        if ($query === '') {
            $page = $page->map(fn (array $entry): array => array_filter([
                'name' => $entry['name'] ?? null,
                'signature' => $entry['signature'] ?? null,
                'description' => $entry['description'] ?? null,
                'category' => $entry['category'] ?? null,
                'aliases' => $entry['aliases'] ?? null,
            ], fn (mixed $value): bool => $value !== null && $value !== [] && $value !== ''));
        }
        $nextOffset = $offset + $page->count();

        return [
            'mode' => $mode === 'code' ? 'code' : 'nodal',
            'nodes' => $page,
            'total' => $total,
            'next_cursor' => $nextOffset < $total ? (string) $nextOffset : null,
        ];
    }

    /** @param Arguments $arguments
     * @return array<string, mixed>
     */
    private function flowResources(array $arguments, McpToolContext $context): array
    {
        $flowId = trim(McpToolArguments::string($arguments, 'flow_id'));
        $flow = $flowId !== ''
            ? $this->resources->flow($flowId, $context, requireExposed: false)
            : null;
        if (
            $flow
            && ! $flow->available_in_mcp
            && Gate::forUser($context->user)->denies(Ability::UPDATE->value, $flow)
        ) {
            throw ValidationException::withMessages(['flow_id' => 'Flow is not available in MCP.']);
        }
        $requestedKinds = is_array($arguments['kinds'] ?? null)
            ? array_values(array_intersect(
                AuthoringResourceProjection::KINDS,
                array_filter($arguments['kinds'], 'is_string'),
            ))
            : AuthoringResourceProjection::KINDS;
        $search = trim(McpToolArguments::string($arguments, 'query'));
        $limit = max(1, min(McpToolArguments::integer($arguments, 'limit', 100), 100));
        $resources = $this->authoringResources->project(
            $context->workspace,
            $context->user,
            $flow,
            $requestedKinds,
            $search,
            $limit,
        );

        return ['resources' => $resources];
    }

    /** @param Arguments $arguments
     * @return array<string, mixed>
     */
    private function write(array $arguments, McpToolContext $context, string $flowType): array
    {
        $attributes = $arguments;
        unset($attributes['folder_id'], $attributes['workspace_folder_id'], $attributes['team_id'], $attributes['flow_type']);
        if ($flowType === 'nodal') {
            unset($attributes['code']);
        }

        $teamId = trim(McpToolArguments::string($arguments, 'team_id'));
        if ($teamId !== '') {
            $attributes['team_id'] = $this->resources->team($teamId, $context);
        } elseif (array_key_exists('team_id', $arguments) && $arguments['team_id'] === null) {
            $attributes['team_id'] = null;
        }

        $folderId = trim(McpToolArguments::string($arguments, 'folder_id'));
        if ($folderId !== '') {
            $attributes['folder_id'] = $this->resolveFolderId($folderId, $context, 'folder_id');
        } elseif (array_key_exists('folder_id', $arguments) && $arguments['folder_id'] === null) {
            $attributes['folder_id'] = null;
        }

        $workspaceFolderId = trim(McpToolArguments::string($arguments, 'workspace_folder_id'));
        if ($workspaceFolderId !== '') {
            $attributes['workspace_folder_id'] = $this->resolveFolderId($workspaceFolderId, $context, 'workspace_folder_id');
        } elseif (array_key_exists('workspace_folder_id', $arguments) && $arguments['workspace_folder_id'] === null) {
            $attributes['workspace_folder_id'] = null;
        }

        $result = $this->writer->write($attributes, $flowType, $context->user, $context->workspace);
        $flow = $result['flow'];

        return ['flow' => [
            'operation' => $result['operation'],
            'id' => $flow->id, 'name' => $flow->name,
            'flow_type' => $flow->flow_type,
            'visibility' => $flow->visibility, 'is_published' => (bool) $flow->is_published,
            'published_version' => $flow->published_version_number,
            'available_in_mcp' => (bool) $flow->available_in_mcp,
            'queue_index' => $flow->queue_index,
            'finally_enabled' => (bool) $flow->finally_enabled,
            'content_updated_at' => $flow->content_updated_at?->toJSON(),
            'url' => route('flows.show', $flow).'#code',
        ]];
    }

    /** @param Arguments $arguments
     * @return array<string, mixed>
     */
    private function setPublication(array $arguments, McpToolContext $context, bool $publish): array
    {
        $flowId = trim(McpToolArguments::string($arguments, 'flow_id'));
        $clientTimestamp = trim(McpToolArguments::string($arguments, 'content_updated_at'));
        if ($flowId === '' || $clientTimestamp === '') {
            throw ValidationException::withMessages([
                $flowId === '' ? 'flow_id' : 'content_updated_at' => $flowId === ''
                    ? 'Flow ID is required.'
                    : 'The content timestamp is required.',
            ]);
        }

        $flow = DB::transaction(function () use ($clientTimestamp, $context, $flowId, $publish): Flow {
            $flow = Flow::query()
                ->where('workspace_id', $context->workspace->id)
                ->whereKey($flowId)
                ->lockForUpdate()
                ->first();
            if (! $flow || Gate::forUser($context->user)->denies(Ability::UPDATE->value, $flow)) {
                throw ValidationException::withMessages(['flow_id' => 'Flow not found or not editable.']);
            }
            if ($flow->library_locked) {
                throw ValidationException::withMessages([
                    'flow_id' => 'Library flows cannot be published. Duplicate the flow first.',
                ]);
            }
            $this->ensureCurrent($clientTimestamp, $flow->content_updated_at ?? $flow->updated_at);

            if (! $publish) {
                $flow->update(['is_published' => false]);

                return $flow;
            }

            $rules = ['code' => ['required', 'string']];
            if ($flow->flow_type === 'nodal') {
                $rules['nodal_graph'] = ['required', 'array', new ValidNodalGraph];
            }
            Validator::make($flow->only(['code', 'nodal_graph']), $rules)->validate();
            $latestVersion = $flow->versions()->max('version');
            $version = $flow->versions()->create([
                'version' => is_numeric($latestVersion) ? ((int) $latestVersion) + 1 : 1,
                'code' => $flow->code,
                'nodal_graph' => $flow->flow_type === 'nodal' ? $flow->nodal_graph : null,
                'flow_type' => $flow->flow_type,
                'published_by' => $context->user->id,
                'published_at' => now(),
            ]);
            $flow->update([
                'published_version_id' => $version->id,
                'is_published' => true,
            ]);

            return $flow;
        }, 3);
        $flow->load('publishedVersion');

        return ['flow' => [
            'id' => $flow->id,
            'name' => $flow->name,
            'is_published' => (bool) $flow->is_published,
            'published_version' => $flow->published_version_number,
            'content_updated_at' => $flow->content_updated_at?->toJSON(),
        ]];
    }

    private function ensureCurrent(string $clientTimestamp, ?Carbon $serverTimestamp): void
    {
        try {
            $client = Carbon::parse($clientTimestamp);
        } catch (\Throwable) {
            throw ValidationException::withMessages([
                'content_updated_at' => 'The content timestamp is invalid.',
            ]);
        }
        if (! $serverTimestamp || ! $serverTimestamp->equalTo($client)) {
            throw ValidationException::withMessages([
                'content_updated_at' => 'This flow changed since it was read. Read the latest source and retry.',
            ]);
        }
    }

    /** @return ToolDefinition */
    private function codeWriterDefinition(): array
    {
        return [
            'name' => 'write_code_flow',
            'description' => <<<'TEXT'
Create or update a Puppetflow JavaScript flow. Use this tool only when the user explicitly asks for code, JavaScript, or code mode. For every general request to create a flow, prefer write_nodal_flow. Omit flow_id to create and provide name. To update, first call get_flow_source, then provide flow_id and its exact content_updated_at.

The source must define `async function run($page, $input)`. `$page` is a Puppeteer Page and `$input` contains the flow's shared default_inputs merged with values supplied for the current run; current-run values override defaults with the same top-level key. In the Flow Editor, default_inputs are shown as Flow Inputs. Use `$input.key` for configurable values instead of hardcoding values that callers may need to change. When updating a flow, call get_flow_details to inspect its existing default_inputs. Use Puppetflow runtime helpers directly (for example `$gotoUrl`, `$loginRemember`, `$selectElement`, `$clickElement`, `$fillInput`, `$screenshot`, and `$generateResponseSuccess`). Query get_nodal_catalog with mode "code" for each needed capability to retrieve exact helper names, signatures, parameter descriptions, and return values; browse its paginated compact index only when discovery is needed. Call list_flow_resources when the flow needs workspace resources such as variables, AI models, channels, Data Tables, mailbox watchers, or snippets. Await browser actions and every helper that returns a Promise. Return a Puppetflow response, normally `$generateResponseSuccess("message", data)`; let errors throw unless the flow has a deliberate recovery path. Never import packages, create a browser, close `$page`, embed credentials, or invent resource IDs.

Minimal source:
async function run($page, $input) {
    await $gotoUrl($input.url);
    return $generateResponseSuccess('Flow completed');
}

New flows are automatically available to MCP clients. On update, available_in_mcp can change that state. is_published is optional; omitting it preserves the current publication state, true publishes this exact content, and false unpublishes it.
TEXT,
            'inputSchema' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['code'],
                'oneOf' => [
                    ['required' => ['name'], 'not' => ['required' => ['flow_id']]],
                    ['required' => ['flow_id', 'content_updated_at']],
                ],
                'properties' => [
                    ...$this->sharedWriterProperties(),
                    'code' => [
                        'type' => 'string',
                        'description' => 'Complete JavaScript source defining async function run($page, $input).',
                    ],
                ],
            ],
        ];
    }

    /** @return ToolDefinition */
    private function nodalWriterDefinition(): array
    {
        return [
            'name' => 'write_nodal_flow',
            'description' => <<<'TEXT'
Create or update a Puppetflow visual flow from a nodal JSON graph. This is the default and preferred tool whenever the user asks to create a flow. Use write_code_flow only when the user explicitly requests code, JavaScript, or code mode. Omit flow_id to create and provide name. To update, first call get_flow_source, then provide flow_id and its exact content_updated_at. Puppetflow validates the graph and compiles the JavaScript server-side; do not provide generated code.

Query get_nodal_catalog with mode "nodal" for each needed capability before constructing the graph; browse its paginated compact index only when discovery is needed. Flow Inputs are stored as default_inputs: a shared JSON object merged into every run, with current-run values overriding defaults that use the same top-level key. In nodal values, reference configurable inputs with expressions such as `{{ $run.$input.url }}` instead of hardcoding values callers may need to change. Each node produces cumulative state: object results are merged into `$run`, while scalar and array results are available as `$run.$result`. Use `$nodes.last` for the latest state and `$('Node label')` for a specific node's state. When updating a flow, call get_flow_details to inspect its existing default_inputs. Use exact catalog node names, required parameter keys, value types, defaults, options, and output port IDs. Call list_flow_resources when the graph needs workspace resources such as variables, AI models, channels, Data Tables, mailbox watchers, or snippets, and use only returned IDs. Every flow has canonical RUN and TERMINATE system nodes. Connect the main sequence from RUN; connect independent cleanup steps from TERMINATE (they only run when the flow setting finally_enabled is on, which is off by default). Ordinary edges default to sourcePort "output" and targetPort "input". If / Else branches use "true" and "false". Loop uses "loop" and "done". Callback ports use the exact `flow-*` ID from the catalog. Keep branches structured and converge them through Merge where needed. Node and edge IDs must be unique, edges cannot cross private-function scopes, and coordinates must be numeric.

Minimal graph:
{"nodes":[{"id":"__system_run","name":"RUN","system":"run","x":0,"y":0,"values":{}},{"id":"step_1","name":"$gotoUrl","x":320,"y":0,"values":{"url":{"mode":"expression","value":"{{ $run.$input.url }}"}}},{"id":"__system_terminate","name":"TERMINATE","system":"terminate","x":0,"y":400,"values":{}}],"edges":[{"id":"run_to_step","sourceNodeId":"__system_run","targetNodeId":"step_1","sourcePort":"output","targetPort":"input"}]}

For private functions, the FUNCTION declaration node uses system "function", name "FUNCTION", and an id equal to scopeId; all nodes in that function use the same scopeId. Calls use localFunctionId and callArguments. Snippet nodes use the exact $$ name and arguments returned by get_nodal_catalog or list_flow_resources. New flows are automatically available to MCP clients. On update, available_in_mcp can change that state. is_published follows the same preserve/true/false behavior as write_code_flow.
TEXT,
            'inputSchema' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['nodal_graph'],
                'oneOf' => [
                    ['required' => ['name'], 'not' => ['required' => ['flow_id']]],
                    ['required' => ['flow_id', 'content_updated_at']],
                ],
                'properties' => [
                    ...$this->sharedWriterProperties(),
                    'finally_enabled' => [
                        'type' => 'boolean',
                        'description' => 'Enable the TERMINATE branch after every run. Creation default: false. Omit during update to preserve the current value.',
                    ],
                    'nodal_graph' => McpNodalGraphSchema::make('flow'),
                ],
            ],
        ];
    }

    /** @return array<string, array<string, mixed>> */
    private function sharedWriterProperties(): array
    {
        return [
            'flow_id' => ['type' => 'string', 'description' => 'Existing flow ID for an update. Omit to create.'],
            'content_updated_at' => ['type' => 'string', 'description' => 'Exact timestamp returned by get_flow_source. Required for updates.'],
            'name' => ['type' => 'string', 'maxLength' => 128, 'description' => 'Required when creating; optional rename when updating.'],
            'description' => ['type' => ['string', 'null']],
            'visibility' => ['type' => 'string', 'enum' => ['owner', 'workspace', 'team'], 'description' => 'Creation default: owner. Omit during update to preserve the current scope.'],
            'team_id' => ['type' => ['string', 'null'], 'pattern' => '^team_[A-Za-z0-9]{12}$'],
            'folder_id' => ['type' => ['string', 'null'], 'description' => 'Personal folder ID.'],
            'workspace_folder_id' => ['type' => ['string', 'null'], 'description' => 'Workspace or team folder ID.'],
            'is_published' => ['type' => 'boolean', 'description' => 'Creation default: false. On update, omit to preserve, true to publish this content, or false to unpublish. Publishing and unpublishing require their corresponding MCP tools to be enabled.'],
            'available_in_mcp' => ['type' => 'boolean', 'description' => 'New flows are always created with this enabled. During update, omit it to preserve the current value.'],
            'queue_index' => ['type' => ['integer', 'null'], 'minimum' => 1, 'maximum' => config()->integer('puppetflow.queues_counter', 1)],
        ];
    }

    private function resolveFolderId(string $id, McpToolContext $context, string $field): string
    {
        $query = Folder::query()
            ->where('workspace_id', $context->workspace->id)
            ->where('id', $id);
        $this->folderVisibility->applyForUser($query, $context->user, $context->workspace->id);
        $folder = $query->first();

        if (! $folder) {
            throw ValidationException::withMessages([$field => 'The selected folder is invalid.']);
        }

        return $folder->id;
    }
}
