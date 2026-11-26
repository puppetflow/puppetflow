<?php

namespace App\Services\Flow;

use App\Enums\Authorization\Ability;
use App\Enums\DataTableColumnType;
use App\Models\DataTable;
use App\Models\User;
use App\Services\DataTable\DataTableSchemaService;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * @phpstan-type DataTableSchema array{
 *     source_id: string,
 *     name: string,
 *     description?: string|null,
 *     group?: string|null,
 *     columns: array<int, array{name: string, type: string}>
 * }
 */
final class FlowDataTableImportService
{
    public function __construct(
        private readonly DataTableSchemaService $schema,
    ) {}

    /**
     * @param  array<int, DataTableSchema>  $schemas
     * @param  array<string, mixed>|null  $defaultInputs
     * @return array<string, mixed>|null
     */
    public function import(
        array $schemas,
        ?array $defaultInputs,
        string $workspaceId,
        string $ownerId,
        string $visibility,
        ?string $teamId,
    ): ?array {
        if ($defaultInputs === null) {
            return null;
        }

        $newIdBySourceId = $this->createTables(
            collect($schemas)->keyBy('source_id'),
            $this->inputSourceIds($defaultInputs),
            $workspaceId,
            $ownerId,
            $visibility,
            $teamId,
        );

        return $this->rewriteInputs($defaultInputs, $newIdBySourceId);
    }

    /**
     * Also recreates Data Tables whose ids are written directly in the code or the nodal graph.
     * Tables the flow only looks up by name are created when no visible table already has that name.
     *
     * @param  array<int, DataTableSchema>  $schemas
     * @param  array<string, mixed>|null  $defaultInputs
     * @param  array<string, mixed>|null  $graph
     * @return array{default_inputs: array<string, mixed>|null, code: string, nodal_graph: array<string, mixed>|null}
     */
    public function importWithContent(
        array $schemas,
        ?array $defaultInputs,
        string $code,
        ?array $graph,
        User $actor,
        string $workspaceId,
        string $ownerId,
        string $visibility,
        ?string $teamId,
    ): array {
        $schemasBySourceId = collect($schemas)->keyBy('source_id');
        $contentSourceIds = collect($this->literalIds($code))
            ->merge($graph === null ? [] : $this->literalIds((string) json_encode($graph)))
            ->filter(fn (string $sourceId): bool => $schemasBySourceId->has($sourceId));
        $referencedSourceIds = $this->inputSourceIds($defaultInputs)->merge($contentSourceIds)->unique()->values();
        $namedSourceIds = $schemasBySourceId
            ->reject(fn (array $schema, int|string $sourceId): bool => $referencedSourceIds->contains((string) $sourceId))
            ->reject(fn (array $schema): bool => $this->hasVisibleTableNamed($workspaceId, $actor, $schema['name']))
            ->keys()
            ->map(fn (int|string $sourceId): string => (string) $sourceId);
        $newIdBySourceId = $this->createTables(
            $schemasBySourceId,
            $referencedSourceIds->merge($namedSourceIds)->values(),
            $workspaceId,
            $ownerId,
            $visibility,
            $teamId,
        );

        return [
            'default_inputs' => $defaultInputs === null ? null : $this->rewriteInputs($defaultInputs, $newIdBySourceId),
            'code' => strtr($code, $newIdBySourceId),
            'nodal_graph' => $graph === null ? null : $this->rewriteGraph($graph, $newIdBySourceId),
        ];
    }

    /**
     * @param  Collection<array-key, DataTableSchema>  $schemasBySourceId
     * @param  Collection<int, string>  $sourceIds
     * @return array<string, string>
     */
    private function createTables(
        Collection $schemasBySourceId,
        Collection $sourceIds,
        string $workspaceId,
        string $ownerId,
        string $visibility,
        ?string $teamId,
    ): array {
        $newIdBySourceId = [];

        foreach ($sourceIds as $sourceId) {
            $definition = $schemasBySourceId->get($sourceId);
            if (! is_array($definition)) {
                throw ValidationException::withMessages([
                    'data_table_schemas' => "The referenced Data Table {$sourceId} is missing from the import.",
                ]);
            }

            $dataTable = $this->schema->createDataTable([
                'workspace_id' => $workspaceId,
                'user_id' => $ownerId,
                'team_id' => $teamId,
                'name' => $definition['name'],
                'description' => $definition['description'] ?? null,
                'group' => $definition['group'] ?? null,
                'visibility' => $visibility,
            ]);
            foreach ($definition['columns'] as $position => $column) {
                $this->schema->addColumn(
                    $dataTable,
                    $column['name'],
                    DataTableColumnType::from($column['type']),
                    $position,
                );
            }
            $newIdBySourceId[$sourceId] = $dataTable->id;
        }

        return $newIdBySourceId;
    }

    /**
     * @param  array<string, mixed>|null  $defaultInputs
     * @return Collection<int, string>
     */
    private function inputSourceIds(?array $defaultInputs): Collection
    {
        /** @var Collection<int, string> $sourceIds */
        $sourceIds = collect($defaultInputs ?? [])
            ->map(fn (mixed $value): ?string => $this->dataTableReferenceId($value))
            ->filter()
            ->unique()
            ->values();

        return $sourceIds;
    }

    /**
     * @param  array<string, mixed>  $defaultInputs
     * @param  array<string, string>  $newIdBySourceId
     * @return array<string, mixed>
     */
    private function rewriteInputs(array $defaultInputs, array $newIdBySourceId): array
    {
        return collect($defaultInputs)->map(function (mixed $value) use ($newIdBySourceId): mixed {
            $sourceId = $this->dataTableReferenceId($value);
            if ($sourceId === null || ! isset($newIdBySourceId[$sourceId])) {
                return $value;
            }

            return '${dataTables.'.$newIdBySourceId[$sourceId].'}';
        })->all();
    }

    /**
     * @param  array<array-key, mixed>  $graph
     * @param  array<string, string>  $newIdBySourceId
     * @return array<array-key, mixed>
     */
    private function rewriteGraph(array $graph, array $newIdBySourceId): array
    {
        if ($newIdBySourceId === []) {
            return $graph;
        }

        return array_map(fn (mixed $value): mixed => match (true) {
            is_string($value) => strtr($value, $newIdBySourceId),
            is_array($value) => $this->rewriteGraph($value, $newIdBySourceId),
            default => $value,
        }, $graph);
    }

    private function hasVisibleTableNamed(string $workspaceId, User $actor, string $name): bool
    {
        return DataTable::query()
            ->where('workspace_id', $workspaceId)
            ->where('name', $name)
            ->get()
            ->contains(fn (DataTable $table): bool => $actor->can(Ability::VIEW->value, $table));
    }

    /** @return list<string> */
    private function literalIds(string $content): array
    {
        preg_match_all('/\b'.DataTable::ID_PREFIX.'_[A-Za-z0-9]{12}\b/', $content, $matches);

        return array_values(array_unique($matches[0]));
    }

    private function dataTableReferenceId(mixed $value): ?string
    {
        if (! is_string($value) || preg_match('/^\$\{dataTables\.([^}]+)\}$/', $value, $matches) !== 1) {
            return null;
        }

        return $matches[1];
    }
}
