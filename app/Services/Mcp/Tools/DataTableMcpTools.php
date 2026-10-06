<?php

namespace App\Services\Mcp\Tools;

use App\Authorization\AuthorizationContextFactory;
use App\Authorization\Visibility\SharedResourceVisibility;
use App\Enums\Authorization\Ability;
use App\Models\DataTable;
use App\Models\DataTableColumn;
use App\Services\DataTable\DataTableRowRepository;
use App\Services\DataTable\DataTableSchemaService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * @phpstan-type Arguments array<string, mixed>
 * @phpstan-type ToolDefinition array{name: string, description: string, inputSchema: array<string, mixed>}
 */
final class DataTableMcpTools implements McpToolHandler
{
    public const TOOL_NAMES = [
        'search_data_tables',
        'get_data_table',
        'get_data_table_rows',
        'update_data_table',
    ];

    private const FILTER_OPERATORS = [
        'eq',
        'neq',
        'gt',
        'gte',
        'lt',
        'lte',
        'like',
        'ilike',
        'isEmpty',
        'isNotEmpty',
        'isTrue',
        'isFalse',
    ];

    public function __construct(
        private readonly AuthorizationContextFactory $contexts,
        private readonly SharedResourceVisibility $visibility,
        private readonly DataTableRowRepository $rows,
        private readonly DataTableSchemaService $schema,
    ) {}

    /** @return list<ToolDefinition> */
    public function definitions(): array
    {
        $tableId = ['type' => 'string', 'description' => 'Data Table ID returned by search_data_tables.'];
        $filter = [
            'type' => 'object',
            'additionalProperties' => false,
            'required' => ['column', 'operator'],
            'properties' => [
                'column' => ['type' => 'string', 'description' => 'Column name, or id, created_at, or updated_at.'],
                'operator' => ['type' => 'string', 'enum' => self::FILTER_OPERATORS],
                'value' => ['type' => ['string', 'number', 'boolean', 'null']],
            ],
        ];

        return [
            [
                'name' => 'search_data_tables',
                'description' => 'Search Data Tables visible to the connected user. Returns safe metadata, groups, schemas, and capabilities without reading rows.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'properties' => [
                        'query' => ['type' => 'string', 'description' => 'Search name, description, group, or ID.'],
                        'name' => ['type' => 'string'],
                        'group' => ['type' => ['string', 'null'], 'description' => 'Exact organizational group.'],
                        'visibility' => ['type' => 'string', 'enum' => ['owner', 'workspace', 'team']],
                        'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 100, 'default' => 20],
                    ],
                ],
            ],
            [
                'name' => 'get_data_table',
                'description' => 'Get safe Data Table metadata, its complete column schema, capabilities, and row count.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['data_table_id'],
                    'properties' => ['data_table_id' => $tableId],
                ],
            ],
            [
                'name' => 'get_data_table_rows',
                'description' => 'Read Data Table rows directly without running a flow. Filters are typed and combined with AND by default. Results are capped and paginated with limit and offset.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['data_table_id'],
                    'properties' => [
                        'data_table_id' => $tableId,
                        'filters' => ['type' => 'array', 'maxItems' => 50, 'items' => $filter],
                        'match_type' => ['type' => 'string', 'enum' => ['all', 'any'], 'default' => 'all'],
                        'order_by' => ['type' => 'string', 'description' => 'Column name. Defaults to updated_at.'],
                        'direction' => ['type' => 'string', 'enum' => ['asc', 'desc'], 'default' => 'desc'],
                        'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 1000, 'default' => 100],
                        'offset' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 1000000, 'default' => 0],
                    ],
                ],
            ],
            [
                'name' => 'update_data_table',
                'description' => 'Update Data Table metadata directly without changing rows or columns. Use group to organize tables; null removes the group.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['data_table_id'],
                    'anyOf' => [
                        ['required' => ['name']],
                        ['required' => ['description']],
                        ['required' => ['group']],
                    ],
                    'properties' => [
                        'data_table_id' => $tableId,
                        'name' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 128],
                        'description' => ['type' => ['string', 'null'], 'maxLength' => 500],
                        'group' => ['type' => ['string', 'null'], 'maxLength' => 100],
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
            'search_data_tables' => $this->search($arguments, $context),
            'get_data_table' => $this->get($arguments, $context),
            'get_data_table_rows' => $this->getRows($arguments, $context),
            'update_data_table' => $this->update($arguments, $context),
            default => throw ValidationException::withMessages(['name' => 'Unknown Data Table tool.']),
        };
    }

    /**
     * @param  Arguments  $arguments
     * @return array<string, mixed>
     */
    private function search(array $arguments, McpToolContext $context): array
    {
        $validated = validator($arguments, [
            'query' => ['sometimes', 'string', 'max:255'],
            'name' => ['sometimes', 'string', 'max:128'],
            'group' => ['sometimes', 'nullable', 'string', 'max:100'],
            'visibility' => ['sometimes', Rule::in(['owner', 'workspace', 'team'])],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ])->validate();
        $query = DataTable::query()->with('columns');
        $this->visibility->applyView(
            $query,
            $this->contexts->for($context->user, $context->workspace->id),
            scopeColumn: 'visibility',
        );
        $search = trim((string) ($validated['query'] ?? ''));
        if ($search !== '') {
            $query->where(fn (Builder $query) => $query
                ->where('name', 'like', "%{$search}%")
                ->orWhere('description', 'like', "%{$search}%")
                ->orWhere('group', 'like', "%{$search}%")
                ->orWhere('id', 'like', "%{$search}%"));
        }
        if (($name = trim((string) ($validated['name'] ?? ''))) !== '') {
            $query->where('name', 'like', "%{$name}%");
        }
        if (array_key_exists('group', $validated)) {
            $group = is_string($validated['group']) ? trim($validated['group']) : null;
            $group === null || $group === ''
                ? $query->whereNull('group')
                : $query->where('group', $group);
        }
        if (isset($validated['visibility'])) {
            $query->where('visibility', $validated['visibility']);
        }

        $tables = $query
            ->orderBy('group')
            ->orderBy('name')
            ->limit((int) ($validated['limit'] ?? 20))
            ->get()
            ->filter(fn (DataTable $table): bool => Gate::forUser($context->user)
                ->allows(Ability::VIEW->value, $table))
            ->map(fn (DataTable $table): array => $this->serialize($table, $context))
            ->values()
            ->all();

        return ['data_tables' => $tables];
    }

    /**
     * @param  Arguments  $arguments
     * @return array<string, mixed>
     */
    private function get(array $arguments, McpToolContext $context): array
    {
        $table = $this->table(McpToolArguments::string($arguments, 'data_table_id'), $context, Ability::VIEW);
        $counts = $this->rows->countRowsByTable(collect([$table]));

        return ['data_table' => [
            ...$this->serialize($table, $context),
            'row_count' => $counts[$table->id] ?? 0,
        ]];
    }

    /**
     * @param  Arguments  $arguments
     * @return array<string, mixed>
     */
    private function getRows(array $arguments, McpToolContext $context): array
    {
        $validated = validator($arguments, [
            'data_table_id' => ['required', 'string'],
            'filters' => ['sometimes', 'array', 'max:50'],
            'filters.*' => ['array:column,operator,value'],
            'filters.*.column' => ['required', 'string', 'max:255'],
            'filters.*.operator' => ['required', Rule::in(self::FILTER_OPERATORS)],
            'filters.*.value' => ['nullable'],
            'match_type' => ['sometimes', Rule::in(['all', 'any'])],
            'order_by' => ['sometimes', 'string', 'max:255'],
            'direction' => ['sometimes', Rule::in(['asc', 'desc'])],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:1000'],
            'offset' => ['sometimes', 'integer', 'min:0', 'max:1000000'],
        ])->validate();
        $table = $this->table((string) $validated['data_table_id'], $context, Ability::VIEW);
        /** @var list<array{column: string, operator: string, value?: mixed}> $validatedFilters */
        $validatedFilters = is_array($validated['filters'] ?? null) ? $validated['filters'] : [];
        $filters = [];
        foreach ($validatedFilters as $filter) {
            $filters[] = array_filter([
                'keyName' => $filter['column'],
                'condition' => $filter['operator'],
                'keyValue' => $filter['value'] ?? null,
            ], fn (mixed $value, string $key): bool => $key !== 'keyValue' || array_key_exists('value', $filter), ARRAY_FILTER_USE_BOTH);
        }
        $limit = (int) ($validated['limit'] ?? 100);
        $offset = (int) ($validated['offset'] ?? 0);
        $rows = $this->rows->runtimeRows(
            $table,
            $filters,
            ($validated['match_type'] ?? 'all') === 'any' ? 'anyCondition' : 'allConditions',
            $limit + 1,
            (string) ($validated['order_by'] ?? 'updated_at'),
            (string) ($validated['direction'] ?? 'desc'),
            $offset,
        );
        $hasMore = count($rows) > $limit;
        if ($hasMore) {
            array_pop($rows);
        }

        return [
            'data_table_id' => $table->id,
            'rows' => $rows,
            'limit' => $limit,
            'offset' => $offset,
            'has_more' => $hasMore,
        ];
    }

    /**
     * @param  Arguments  $arguments
     * @return array<string, mixed>
     */
    private function update(array $arguments, McpToolContext $context): array
    {
        $validated = validator($arguments, [
            'data_table_id' => ['required', 'string'],
            'name' => ['sometimes', 'string', 'max:128'],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'group' => ['sometimes', 'nullable', 'string', 'max:100'],
        ])->validate();
        $table = $this->table((string) $validated['data_table_id'], $context, Ability::UPDATE);
        unset($validated['data_table_id']);
        if ($validated === []) {
            throw ValidationException::withMessages([
                'data_table' => 'Provide at least one Data Table change.',
            ]);
        }
        if (array_key_exists('name', $validated)) {
            $validated['name'] = trim((string) $validated['name']);
            if ($validated['name'] === '') {
                throw ValidationException::withMessages(['name' => 'The Data Table name is required.']);
            }
        }
        foreach (['description', 'group'] as $field) {
            if (array_key_exists($field, $validated) && is_string($validated[$field])) {
                $validated[$field] = trim($validated[$field]) ?: null;
            }
        }
        $table = $this->schema->updateDataTable($table, $validated)->load('columns');

        return ['data_table' => $this->serialize($table, $context)];
    }

    private function table(string $id, McpToolContext $context, Ability $ability): DataTable
    {
        $table = DataTable::query()
            ->where('workspace_id', $context->workspace->id)
            ->with('columns')
            ->find($id);
        if (! $table || Gate::forUser($context->user)->denies($ability->value, $table)) {
            throw ValidationException::withMessages([
                'data_table_id' => 'Data Table not found or not accessible.',
            ]);
        }

        return $table;
    }

    /** @return array<string, mixed> */
    private function serialize(DataTable $table, McpToolContext $context): array
    {
        $table->loadMissing('columns');

        return [
            'id' => $table->id,
            'name' => $table->name,
            'description' => $table->description,
            'group' => $table->group,
            'visibility' => $table->visibility,
            'owner_id' => $table->user_id,
            'team_id' => $table->team_id,
            'schema' => $table->columns
                ->sortBy('position')
                ->map(fn (DataTableColumn $column): array => [
                    'id' => $column->id,
                    'name' => $column->name,
                    'type' => $column->type->value,
                    'position' => $column->position,
                ])
                ->values()
                ->all(),
            'capabilities' => [
                'read_rows' => Gate::forUser($context->user)->allows(Ability::VIEW->value, $table),
                'update_metadata' => Gate::forUser($context->user)->allows(Ability::UPDATE->value, $table),
            ],
        ];
    }
}
