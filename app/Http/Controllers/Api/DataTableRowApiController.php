<?php

namespace App\Http\Controllers\Api;

use App\Enums\Authorization\Ability;
use App\Http\Controllers\Api\Concerns\ResolvesDataTableResources;
use App\Http\Controllers\Controller;
use App\Services\DataTable\DataTableRowRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DataTableRowApiController extends Controller
{
    use ResolvesDataTableResources;

    private const FILTER_OPERATORS = [
        'eq',
        'neq',
        'gt',
        'gte',
        'lt',
        'lte',
        'like',
        'ilike',
        'is_empty',
        'is_not_empty',
        'is_true',
        'is_false',
    ];

    public function __construct(private readonly DataTableRowRepository $rows) {}

    public function index(Request $request, string $dataTable): JsonResponse
    {
        $table = $this->resolveApiDataTableForRequest($request, $dataTable);
        $validated = $request->validate([
            ...$this->filterRules(),
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'sort_by' => ['sometimes', 'nullable', 'string', 'max:63'],
            'sort_direction' => ['sometimes', Rule::in(['asc', 'desc'])],
        ]);

        return response()->json($this->rows->paginateNamed(
            $table,
            $validated['per_page'] ?? 50,
            $this->internalFilters($validated['filters'] ?? []),
            $this->internalMatchType($validated['match_type'] ?? 'all'),
            $validated['sort_by'] ?? 'id',
            $validated['sort_direction'] ?? 'asc',
        ));
    }

    public function store(Request $request, string $dataTable): JsonResponse
    {
        $table = $this->resolveApiDataTableForRequest($request, $dataTable, Ability::UPDATE);
        $validated = $request->validate([
            'values' => ['required', 'array', $this->objectRule()],
        ]);

        return response()->json(
            $this->rows->runtimeInsert($table, $validated['values'], namedValues: true),
            201,
        );
    }

    public function storeBulk(Request $request, string $dataTable): JsonResponse
    {
        $table = $this->resolveApiDataTableForRequest($request, $dataTable, Ability::UPDATE);
        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1', 'max:1000'],
            'rows.*' => ['required', 'array', $this->objectRule()],
        ]);
        $inserted = $this->rows->createManyNamed($table, array_values($validated['rows']));

        return response()->json(['inserted' => $inserted], 201);
    }

    public function show(
        Request $request,
        string $dataTable,
        string $row,
    ): JsonResponse {
        $table = $this->resolveApiDataTableForRequest($request, $dataTable);

        return response()->json(
            $this->rows->findNamed($table, $this->resolveApiRowId($row)),
        );
    }

    public function update(
        Request $request,
        string $dataTable,
        string $row,
    ): JsonResponse {
        $table = $this->resolveApiDataTableForRequest($request, $dataTable, Ability::UPDATE);
        $validated = $request->validate([
            'values' => ['required', 'array', 'min:1', $this->objectRule()],
        ]);

        return response()->json($this->rows->update(
            $table,
            $this->resolveApiRowId($row),
            $validated['values'],
            namedValues: true,
        ));
    }

    public function updateFiltered(Request $request, string $dataTable): JsonResponse
    {
        $table = $this->resolveApiDataTableForRequest($request, $dataTable, Ability::UPDATE);
        $validated = $request->validate([
            ...$this->filterRules(),
            'values' => ['required', 'array', 'min:1', $this->objectRule()],
            'update_all' => ['sometimes', 'boolean'],
            'dry_run' => ['sometimes', 'boolean'],
        ]);
        $filters = $validated['filters'] ?? [];
        $updateAll = ($validated['update_all'] ?? false) === true;
        $dryRun = ($validated['dry_run'] ?? false) === true;
        if ($filters === [] && ! $updateAll) {
            throw ValidationException::withMessages([
                'filters' => 'At least one filter is required unless update_all is true.',
            ]);
        }

        $rows = $this->rows->runtimeUpdate(
            $table,
            $this->internalFilters($filters),
            $this->internalMatchType($validated['match_type'] ?? 'all'),
            $validated['values'],
            $dryRun,
            $updateAll,
            namedValues: true,
        );

        return response()->json([
            'updated' => $this->affectedCount($rows, $dryRun),
            'rows' => $rows,
        ]);
    }

    public function upsert(Request $request, string $dataTable): JsonResponse
    {
        $table = $this->resolveApiDataTableForRequest($request, $dataTable, Ability::UPDATE);
        $validated = $request->validate([
            ...$this->filterRules(requireFilters: true),
            'values' => ['required', 'array', $this->objectRule()],
            'dry_run' => ['sometimes', 'boolean'],
        ]);
        $dryRun = ($validated['dry_run'] ?? false) === true;
        $rows = $this->rows->runtimeUpsert(
            $table,
            $this->internalFilters($validated['filters']),
            $this->internalMatchType($validated['match_type'] ?? 'all'),
            $validated['values'],
            $dryRun,
            namedValues: true,
        );

        return response()->json([
            'affected' => $this->affectedCount($rows, $dryRun),
            'rows' => $rows,
        ]);
    }

    public function destroy(
        Request $request,
        string $dataTable,
        string $row,
    ): JsonResponse {
        $table = $this->resolveApiDataTableForRequest($request, $dataTable, Ability::UPDATE);
        $this->rows->delete($table, $this->resolveApiRowId($row));

        return response()->json(['message' => 'Data table row deleted.']);
    }

    public function destroyFiltered(Request $request, string $dataTable): JsonResponse
    {
        $table = $this->resolveApiDataTableForRequest($request, $dataTable, Ability::UPDATE);
        $validated = $request->validate([
            ...$this->filterRules(),
            'ids' => ['sometimes', 'array', 'min:1', 'max:100'],
            'ids.*' => ['required', 'integer', 'min:1', 'distinct'],
            'dry_run' => ['sometimes', 'boolean'],
        ]);
        $dryRun = ($validated['dry_run'] ?? false) === true;

        if (isset($validated['ids'])) {
            if ($dryRun) {
                $rows = [];
                foreach ($validated['ids'] as $rowId) {
                    $before = $this->rows->findNamed($table, $rowId);
                    $rows[] = [...$before, 'dry_run_state' => 'before'];
                    $rows[] = [
                        ...array_fill_keys(array_keys($before), null),
                        'dry_run_state' => 'after',
                    ];
                }

                return response()->json([
                    'deleted' => count($validated['ids']),
                    'rows' => $rows,
                ]);
            }

            $deleted = $this->rows->deleteMany($table, array_values($validated['ids']));

            return response()->json(['deleted' => $deleted]);
        }
        if (($validated['filters'] ?? []) === []) {
            throw ValidationException::withMessages([
                'filters' => 'At least one filter or row ID is required.',
            ]);
        }

        $rows = $this->rows->runtimeDelete(
            $table,
            $this->internalFilters($validated['filters']),
            $this->internalMatchType($validated['match_type'] ?? 'all'),
            $dryRun,
        );

        return response()->json([
            'deleted' => $this->affectedCount($rows, $dryRun),
            'rows' => $rows,
        ]);
    }

    /**
     * @return array<string, list<mixed>>
     */
    private function filterRules(bool $requireFilters = false): array
    {
        $filters = [$requireFilters ? 'required' : 'sometimes', 'array', 'max:20'];
        if ($requireFilters) {
            $filters[] = 'min:1';
        }

        return [
            'filters' => $filters,
            'filters.*.column' => ['required', 'string', 'max:63'],
            'filters.*.operator' => ['required', Rule::in(self::FILTER_OPERATORS)],
            'filters.*.value' => ['sometimes', 'nullable'],
            'match_type' => ['sometimes', Rule::in(['all', 'any'])],
        ];
    }

    private function objectRule(): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail): void {
            if (is_array($value) && $value !== [] && array_is_list($value)) {
                $fail("The {$attribute} field must be an object.");
            }
        };
    }

    /**
     * @param  list<array{column: string, operator: string, value?: mixed}>  $filters
     * @return list<array{keyName: string, condition: string, keyValue?: mixed}>
     */
    private function internalFilters(array $filters): array
    {
        return array_map(function (array $filter): array {
            $mapped = [
                'keyName' => $filter['column'],
                'condition' => match ($filter['operator']) {
                    'is_empty' => 'isEmpty',
                    'is_not_empty' => 'isNotEmpty',
                    'is_true' => 'isTrue',
                    'is_false' => 'isFalse',
                    default => $filter['operator'],
                },
            ];
            if (array_key_exists('value', $filter)) {
                $mapped['keyValue'] = $filter['value'];
            }

            return $mapped;
        }, $filters);
    }

    private function internalMatchType(string $matchType): string
    {
        return $matchType === 'any' ? 'anyCondition' : 'allConditions';
    }

    /** @param list<array<string, mixed>> $rows */
    private function affectedCount(array $rows, bool $dryRun): int
    {
        return $dryRun ? intdiv(count($rows), 2) : count($rows);
    }
}
