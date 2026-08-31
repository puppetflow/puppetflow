<?php

namespace App\Services\Mcp\Tools;

use App\Authorization\AuthorizationContextFactory;
use App\Authorization\Visibility\SharedResourceVisibility;
use App\Enums\Authorization\Ability;
use App\Models\Snippet;
use App\Models\SnippetVersion;
use App\Services\FeatureFlags\FeatureFlagService;
use App\Services\Snippet\SnippetVersionService;
use App\Services\Snippet\SnippetWriteService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * @phpstan-type Arguments array<string, mixed>
 * @phpstan-type ToolDefinition array{name: string, description: string, inputSchema: array<string, mixed>}
 */
final class SnippetMcpTools implements McpToolHandler
{
    public const TOOL_NAMES = [
        'search_snippets',
        'get_snippet_source',
        'get_snippet_creation_options',
        'write_nodal_snippet',
        'write_code_snippet',
        'publish_snippet',
        'unpublish_snippet',
    ];

    public function __construct(
        private readonly SharedResourceVisibility $visibility,
        private readonly AuthorizationContextFactory $authorizationContexts,
        private readonly McpResourceResolver $resources,
        private readonly SnippetWriteService $writer,
        private readonly SnippetVersionService $versions,
        private readonly FeatureFlagService $features,
    ) {}

    public function definitions(): array
    {
        if (! $this->features->enabled('snippets_enabled')) {
            return [];
        }

        $identifier = ['type' => 'string', 'description' => 'Snippet ID.'];

        return [
            [
                'name' => 'search_snippets',
                'description' => 'Search snippets visible to the connected user in this workspace. Nodal snippets are the preferred source for reusable visual automation.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'properties' => [
                        'query' => ['type' => 'string'],
                        'label' => ['type' => 'string'],
                        'group' => ['type' => 'string'],
                        'snippet_type' => ['type' => 'string', 'enum' => ['code', 'nodal']],
                        'type' => ['type' => 'string', 'enum' => ['code', 'nodal']],
                        'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 100, 'default' => 20],
                    ],
                ],
            ],
            [
                'name' => 'get_snippet_source',
                'description' => 'Get an editable snippet draft, including its function arguments, JavaScript body, complete nodal graph, and exact concurrency timestamp.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['snippet_id'],
                    'properties' => ['snippet_id' => $identifier],
                ],
            ],
            [
                'name' => 'get_snippet_creation_options',
                'description' => 'List allowed snippet visibility scopes and teams.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'properties' => new \stdClass,
                ],
            ],
            $this->nodalWriterDefinition(),
            $this->codeWriterDefinition(),
            [
                'name' => 'publish_snippet',
                'description' => 'Publish the current editable snippet draft as a new version. Call get_snippet_source first and provide its exact content_updated_at value.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['snippet_id', 'content_updated_at'],
                    'properties' => [
                        'snippet_id' => $identifier,
                        'content_updated_at' => ['type' => 'string', 'description' => 'Exact timestamp returned by get_snippet_source.'],
                    ],
                ],
            ],
            [
                'name' => 'unpublish_snippet',
                'description' => 'Unpublish a snippet without deleting its version history or editable draft. Call get_snippet_source first and provide its exact content_updated_at value.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['snippet_id', 'content_updated_at'],
                    'properties' => [
                        'snippet_id' => $identifier,
                        'content_updated_at' => ['type' => 'string', 'description' => 'Exact timestamp returned by get_snippet_source.'],
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
        $this->features->abortIfDisabled('snippets_enabled');

        return match ($name) {
            'search_snippets' => $this->search($arguments, $context),
            'get_snippet_source' => $this->source($arguments, $context),
            'get_snippet_creation_options' => $this->creationOptions($context),
            'write_nodal_snippet' => $this->write($arguments, $context, 'nodal'),
            'write_code_snippet' => $this->write($arguments, $context, 'code'),
            'publish_snippet' => $this->setPublication($arguments, $context, true),
            'unpublish_snippet' => $this->setPublication($arguments, $context, false),
            default => throw ValidationException::withMessages(['name' => 'Unknown snippet tool.']),
        };
    }

    /** @param Arguments $arguments
     * @return array<string, mixed>
     */
    private function search(array $arguments, McpToolContext $context): array
    {
        $limit = max(1, min(McpToolArguments::integer($arguments, 'limit', 20), 100));
        /** @var Builder<Snippet> $query */
        $query = Snippet::query()
            ->where('stale', false)
            ->with('publishedVersion:id,version,args')
            ->select([
                'id',
                'workspace_id',
                'user_id',
                'label',
                'description',
                'group',
                'args',
                'snippet_type',
                'scope',
                'team_id',
                'is_active',
                'published_version_id',
                'content_updated_at',
                'updated_at',
            ]);
        $this->visibility->applyView(
            $query,
            $this->authorizationContexts->for($context->user, $context->workspace->id),
        );

        $text = trim(McpToolArguments::string($arguments, 'query'));
        if ($text !== '') {
            $query->where(fn (Builder $query) => $query
                ->where('label', 'like', "%{$text}%")
                ->orWhere('description', 'like', "%{$text}%")
                ->orWhere('group', 'like', "%{$text}%")
                ->orWhere('id', 'like', "%{$text}%"));
        }
        if (($label = trim(McpToolArguments::string($arguments, 'label'))) !== '') {
            $query->where('label', 'like', "%{$label}%");
        }
        if (($group = trim(McpToolArguments::string($arguments, 'group'))) !== '') {
            $query->where('group', 'like', "%{$group}%");
        }
        $type = trim(McpToolArguments::string(
            $arguments,
            'snippet_type',
            McpToolArguments::string($arguments, 'type'),
        ));
        if ($type !== '') {
            $query->where('snippet_type', $type);
        }

        return [
            'snippets' => $query->orderBy('label')->limit($limit)->get()
                ->map(function (Snippet $snippet): array {
                    $published = $snippet->getRelation('publishedVersion');

                    return [
                        'id' => $snippet->id,
                        'label' => $snippet->label,
                        'description' => $snippet->description,
                        'group' => $snippet->group,
                        'args' => $published instanceof SnippetVersion ? ($published->args ?? '') : ($snippet->args ?? ''),
                        'snippet_type' => $snippet->snippet_type,
                        'scope' => $snippet->scope,
                        'team_id' => $snippet->team_id,
                        'owner_id' => $snippet->user_id,
                        'is_active' => (bool) $snippet->is_active,
                        'published_version' => $snippet->published_version_number,
                        'content_updated_at' => $snippet->content_updated_at?->toJSON(),
                        'updated_at' => $snippet->updated_at?->toIso8601String(),
                    ];
                })
                ->values(),
        ];
    }

    /** @param Arguments $arguments
     * @return array<string, mixed>
     */
    private function source(array $arguments, McpToolContext $context): array
    {
        $snippetId = trim(McpToolArguments::string($arguments, 'snippet_id'));
        if ($snippetId === '') {
            throw ValidationException::withMessages(['snippet_id' => 'Snippet ID is required.']);
        }

        $snippet = Snippet::query()
            ->where('workspace_id', $context->workspace->id)
            ->where('stale', false)
            ->whereKey($snippetId)
            ->first();
        if (! $snippet || Gate::forUser($context->user)->denies(Ability::UPDATE->value, $snippet)) {
            throw ValidationException::withMessages(['snippet_id' => 'Snippet not found or not editable.']);
        }

        return ['snippet' => [
            'id' => $snippet->id,
            'label' => $snippet->label,
            'description' => $snippet->description,
            'group' => $snippet->group,
            'args' => $snippet->args ?? '',
            'snippet_type' => $snippet->snippet_type,
            'code' => $snippet->code ?? '',
            'nodal_graph' => $snippet->nodal_graph,
            'scope' => $snippet->scope,
            'team_id' => $snippet->team_id,
            'is_active' => (bool) $snippet->is_active,
            'library_locked' => (bool) $snippet->library_locked,
            'published_version' => $snippet->published_version_number,
            'content_updated_at' => $snippet->content_updated_at?->toJSON(),
        ]];
    }

    /** @return array<string, mixed> */
    private function creationOptions(McpToolContext $context): array
    {
        $teams = $context->user->teams()
            ->where('workspace_id', $context->workspace->id)
            ->orderBy('name')
            ->get(['workspace_teams.id', 'name']);

        return [
            'visibility_scopes' => $this->features->allowedScopes(),
            'teams' => $teams,
            'defaults' => [
                'scope' => 'owner',
                'is_active' => true,
                'published_version' => null,
                'snippet_type' => 'nodal',
            ],
        ];
    }

    /** @param Arguments $arguments
     * @return array<string, mixed>
     */
    private function write(array $arguments, McpToolContext $context, string $snippetType): array
    {
        $attributes = $arguments;
        unset($attributes['snippet_type'], $attributes['type'], $attributes['team_id']);
        if ($snippetType === 'nodal') {
            unset($attributes['code']);
        } else {
            unset($attributes['nodal_graph']);
        }

        $teamId = trim(McpToolArguments::string($arguments, 'team_id'));
        if ($teamId !== '') {
            $attributes['team_id'] = $this->resources->team($teamId, $context);
        } elseif (array_key_exists('team_id', $arguments) && $arguments['team_id'] === null) {
            $attributes['team_id'] = null;
        }

        $result = $this->writer->write(
            $attributes,
            $snippetType,
            $context->user,
            $context->workspace,
        );
        $snippet = $result['snippet'];

        return ['snippet' => [
            'operation' => $result['operation'],
            'id' => $snippet->id,
            'label' => $snippet->label,
            'snippet_type' => $snippet->snippet_type,
            'scope' => $snippet->scope,
            'team_id' => $snippet->team_id,
            'is_active' => (bool) $snippet->is_active,
            'published_version' => $snippet->published_version_number,
            'content_updated_at' => $snippet->content_updated_at?->toJSON(),
            'url' => route('snippets.index', ['s' => $snippet->id]),
        ]];
    }

    /** @param Arguments $arguments
     * @return array<string, mixed>
     */
    private function setPublication(array $arguments, McpToolContext $context, bool $publish): array
    {
        $snippetId = trim(McpToolArguments::string($arguments, 'snippet_id'));
        $clientTimestamp = trim(McpToolArguments::string($arguments, 'content_updated_at'));
        if ($snippetId === '' || $clientTimestamp === '') {
            throw ValidationException::withMessages([
                $snippetId === '' ? 'snippet_id' : 'content_updated_at' => $snippetId === ''
                    ? 'Snippet ID is required.'
                    : 'The content timestamp is required.',
            ]);
        }

        $snippet = DB::transaction(function () use ($clientTimestamp, $context, $publish, $snippetId): Snippet {
            $snippet = Snippet::query()
                ->where('workspace_id', $context->workspace->id)
                ->where('stale', false)
                ->whereKey($snippetId)
                ->lockForUpdate()
                ->first();
            if (! $snippet || Gate::forUser($context->user)->denies(Ability::UPDATE->value, $snippet)) {
                throw ValidationException::withMessages(['snippet_id' => 'Snippet not found or not editable.']);
            }
            if ($snippet->library_locked) {
                throw ValidationException::withMessages([
                    'snippet_id' => 'Library snippets cannot be published. Duplicate the snippet first.',
                ]);
            }
            $this->ensureCurrent($clientTimestamp, $snippet->content_updated_at ?? $snippet->updated_at);

            if ($publish) {
                $this->versions->publish($snippet, $context->user->id);
            } else {
                $snippet->forceFill(['published_version_id' => null])->saveQuietly();
            }

            return $snippet;
        }, 3);
        $snippet->load('publishedVersion');

        return ['snippet' => [
            'id' => $snippet->id,
            'label' => $snippet->label,
            'is_published' => $snippet->published_version_id !== null,
            'published_version' => $snippet->published_version_number,
            'content_updated_at' => $snippet->content_updated_at?->toJSON(),
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
                'content_updated_at' => 'This snippet changed since it was read. Read the latest source and retry.',
            ]);
        }
    }

    /** @return ToolDefinition */
    private function nodalWriterDefinition(): array
    {
        return [
            'name' => 'write_nodal_snippet',
            'description' => <<<'TEXT'
Create or update a reusable Puppetflow visual snippet from a nodal function graph. This is the preferred writer for snippet creation. Use write_code_snippet only when the user explicitly requests JavaScript or code mode. Omit snippet_id to create and provide label. To update, first call get_snippet_source, then provide snippet_id and its exact content_updated_at. Writes modify the draft only unless publish is true.

Call get_nodal_catalog with mode "nodal" before constructing the graph, and call list_flow_resources when the snippet needs an accessible workspace resource or another published snippet. Provide args as a comma-separated list of unique JavaScript identifiers. The graph must contain the canonical FUNCTION entry node with id "__system_function", name "FUNCTION", and system "function". Build the executable sequence from that node. Puppetflow validates the function graph and compiles its JavaScript body server-side with the declared arguments. Do not provide generated code or invent resource IDs. Library snippets are locked and must be duplicated outside MCP before editing.
TEXT,
            'inputSchema' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['nodal_graph'],
                'oneOf' => [
                    ['required' => ['label'], 'not' => ['required' => ['snippet_id']]],
                    ['required' => ['snippet_id', 'content_updated_at']],
                ],
                'properties' => [
                    ...$this->sharedWriterProperties(),
                    'nodal_graph' => McpNodalGraphSchema::make('function'),
                ],
            ],
        ];
    }

    /** @return ToolDefinition */
    private function codeWriterDefinition(): array
    {
        return [
            'name' => 'write_code_snippet',
            'description' => <<<'TEXT'
Create or update a reusable Puppetflow JavaScript snippet body. Prefer write_nodal_snippet for general snippet requests. Use this tool only when the user explicitly requests JavaScript, code, or code mode. Omit snippet_id to create and provide label. To update, first call get_snippet_source, then provide snippet_id and its exact content_updated_at. Writes modify the draft only unless publish is true.

Call get_nodal_catalog with mode "code" for exact runtime helper signatures and return values, and call list_flow_resources when the snippet needs an accessible workspace resource or another published snippet. Provide args as a comma-separated list of unique JavaScript identifiers. Provide only the body of the async snippet function, not a function declaration or wrapper. The body may use Puppetflow runtime globals, await asynchronous work, and return a value. Do not embed credentials or invent resource IDs. Library snippets are locked and must be duplicated outside MCP before editing.
TEXT,
            'inputSchema' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['code'],
                'oneOf' => [
                    ['required' => ['label'], 'not' => ['required' => ['snippet_id']]],
                    ['required' => ['snippet_id', 'content_updated_at']],
                ],
                'properties' => [
                    ...$this->sharedWriterProperties(),
                    'code' => [
                        'type' => 'string',
                        'description' => 'JavaScript body of the async snippet function.',
                    ],
                ],
            ],
        ];
    }

    /** @return array<string, array<string, mixed>> */
    private function sharedWriterProperties(): array
    {
        return [
            'snippet_id' => ['type' => 'string', 'description' => 'Existing snippet ID for an update. Omit to create.'],
            'content_updated_at' => ['type' => 'string', 'description' => 'Exact timestamp returned by get_snippet_source. Required for updates.'],
            'label' => ['type' => 'string', 'maxLength' => 255, 'description' => 'Required when creating; optional rename when updating.'],
            'description' => ['type' => ['string', 'null'], 'maxLength' => 1000],
            'group' => ['type' => ['string', 'null'], 'maxLength' => 255],
            'args' => ['type' => ['string', 'null'], 'maxLength' => 500, 'description' => 'Comma-separated unique JavaScript argument identifiers.'],
            'scope' => ['type' => 'string', 'enum' => ['owner', 'workspace', 'team'], 'description' => 'Creation default: owner. Omit during update to preserve the current scope.'],
            'team_id' => ['type' => ['string', 'null'], 'pattern' => '^team_[A-Za-z0-9]{12}$'],
            'is_active' => ['type' => 'boolean', 'description' => 'Creation default: true.'],
            'publish' => ['type' => 'boolean', 'description' => 'True publishes the written draft. Omit or use false to leave publication unchanged during updates and create an unpublished draft during creation. Requires the publish_snippet tool to be enabled.'],
        ];
    }
}
