<?php

namespace App\Services\Flow;

use App\Enums\DataTableColumnType;
use App\Services\DataTable\DataTableSchemaService;

final class FlowDataTableImportService
{
    public function __construct(
        private readonly DataTableSchemaService $schema,
    ) {}

    /**
     * @param array<int, array{
     *     source_id: string,
     *     name: string,
     *     description?: string|null,
     *     group?: string|null,
     *     columns: array<int, array{name: string, type: string}>
     * }> $schemas
     * @param array<string, mixed>|null $defaultInputs
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

        $schemasBySourceId = collect($schemas)->keyBy('source_id');
        $sourceIds = collect($defaultInputs)
            ->map(fn (mixed $value): ?string => $this->dataTableReferenceId($value))
            ->filter()
            ->unique()
            ->values();
        $newIdBySourceId = [];

        foreach ($sourceIds as $sourceId) {
            $definition = $schemasBySourceId->get($sourceId);
            if (! is_array($definition)) {
                continue;
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

        return collect($defaultInputs)->map(function (mixed $value) use ($newIdBySourceId): mixed {
            $sourceId = $this->dataTableReferenceId($value);
            if ($sourceId === null || ! isset($newIdBySourceId[$sourceId])) {
                return $value;
            }

            return '${dataTables.'.$newIdBySourceId[$sourceId].'}';
        })->all();
    }

    private function dataTableReferenceId(mixed $value): ?string
    {
        if (! is_string($value) || preg_match('/^\$\{dataTables\.([^}]+)\}$/', $value, $matches) !== 1) {
            return null;
        }

        return $matches[1];
    }
}
