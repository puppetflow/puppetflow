<?php

namespace App\Http\Controllers\Api;

use App\Enums\Authorization\Ability;
use App\Enums\DataTableColumnType;
use App\Http\Controllers\Api\Concerns\ResolvesDataTableResources;
use App\Http\Controllers\Controller;
use App\Models\DataTableColumn;
use App\Services\DataTable\DataTableSchemaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DataTableColumnApiController extends Controller
{
    use ResolvesDataTableResources;

    public function __construct(private readonly DataTableSchemaService $schema) {}

    public function index(Request $request, string $dataTable): JsonResponse
    {
        $table = $this->resolveApiDataTableForRequest($request, $dataTable);

        return response()->json(
            $table->columns()->get()->map(fn (DataTableColumn $column): array => $this->serialize($column))->values(),
        );
    }

    public function store(Request $request, string $dataTable): JsonResponse
    {
        $table = $this->resolveApiDataTableForRequest($request, $dataTable, Ability::UPDATE);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:63'],
            'type' => ['required', Rule::enum(DataTableColumnType::class)],
            'position' => ['sometimes', 'integer', 'min:0'],
        ]);
        $column = $this->schema->addColumn(
            $table,
            $validated['name'],
            DataTableColumnType::from($validated['type']),
            $validated['position'] ?? null,
        );

        return response()->json($this->serialize($column), 201);
    }

    public function show(
        Request $request,
        string $dataTable,
        string $column,
    ): JsonResponse {
        $table = $this->resolveApiDataTableForRequest($request, $dataTable);

        return response()->json($this->serialize(
            $this->resolveApiDataTableColumn($table, $column),
        ));
    }

    public function update(
        Request $request,
        string $dataTable,
        string $column,
    ): JsonResponse {
        $table = $this->resolveApiDataTableForRequest($request, $dataTable, Ability::UPDATE);
        $resolvedColumn = $this->resolveApiDataTableColumn($table, $column);
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:63'],
            'position' => ['sometimes', 'integer', 'min:0'],
        ]);
        $resolvedColumn = $this->schema->updateColumn(
            $resolvedColumn,
            $validated['name'] ?? null,
            $validated['position'] ?? null,
        );

        return response()->json($this->serialize($resolvedColumn));
    }

    public function reorder(Request $request, string $dataTable): JsonResponse
    {
        $table = $this->resolveApiDataTableForRequest($request, $dataTable, Ability::UPDATE);
        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['required', 'string', 'distinct'],
        ]);
        $columns = $this->schema->reorderColumns($table, array_values($validated['ids']));

        return response()->json(array_map(
            fn (DataTableColumn $column): array => $this->serialize($column),
            $columns,
        ));
    }

    public function destroy(
        Request $request,
        string $dataTable,
        string $column,
    ): JsonResponse {
        $table = $this->resolveApiDataTableForRequest($request, $dataTable, Ability::UPDATE);
        $resolvedColumn = $this->resolveApiDataTableColumn($table, $column);
        $this->schema->deleteColumn($resolvedColumn);

        return response()->json(['message' => 'Data table column deleted.']);
    }

    /** @return array<string, mixed> */
    private function serialize(DataTableColumn $column): array
    {
        return [
            'id' => $column->id,
            'data_table_id' => $column->data_table_id,
            'name' => $column->name,
            'type' => $column->type->value,
            'position' => $column->position,
            'created_at' => $column->created_at?->toIso8601String(),
            'updated_at' => $column->updated_at?->toIso8601String(),
        ];
    }
}
