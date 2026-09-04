<?php

namespace App\Http\Controllers\Api;

use App\Authorization\AuthorizationContextFactory;
use App\Authorization\ResourceAssignmentValidator;
use App\Authorization\Visibility\SharedResourceVisibility;
use App\Enums\Authorization\Ability;
use App\Http\Controllers\Api\Concerns\ResolvesDataTableResources;
use App\Http\Controllers\Controller;
use App\Models\DataTable;
use App\Models\User;
use App\Services\DataTable\DataTableRowRepository;
use App\Services\DataTable\DataTableSchemaService;
use App\Services\FeatureFlags\FeatureFlagService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class DataTableApiController extends Controller
{
    use ResolvesDataTableResources;

    public function __construct(
        private readonly DataTableSchemaService $schema,
        private readonly DataTableRowRepository $rows,
        private readonly AuthorizationContextFactory $authorizationContexts,
        private readonly SharedResourceVisibility $visibility,
        private readonly ResourceAssignmentValidator $assignments,
        private readonly FeatureFlagService $features,
    ) {}

    public function index(Request $request, string $workspace): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $resolvedWorkspace = $this->resolveApiWorkspace($workspace, $user);
        $validated = $request->validate([
            'search' => ['sometimes', 'string', 'max:128'],
            'group' => ['sometimes', 'nullable', 'string', 'max:100'],
            'visibility' => ['sometimes', Rule::in($this->features->allowedScopes())],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $query = DataTable::query()
            ->with(['user:id,name', 'team:id,name'])
            ->withCount('columns');
        $this->visibility->applyView(
            $query,
            $this->authorizationContexts->for($user, $resolvedWorkspace->id),
            scopeColumn: 'visibility',
        );

        if (isset($validated['search'])) {
            $search = $validated['search'];
            $query->where(function ($nested) use ($search): void {
                $nested->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('group', 'like', "%{$search}%");
            });
        }
        if (array_key_exists('group', $validated)) {
            $query->where('group', $validated['group']);
        }
        if (isset($validated['visibility'])) {
            $query->where('visibility', $validated['visibility']);
        }

        $paginator = $query->orderBy('name')->orderBy('id')
            ->paginate($validated['per_page'] ?? 50);
        $rowCounts = $this->rows->countRowsByTable($paginator->getCollection());
        $paginator->through(
            fn (DataTable $table): array => $this->serialize(
                $table,
                $user,
                $rowCounts[$table->id] ?? 0,
            ),
        );

        return response()->json($paginator);
    }

    public function store(Request $request, string $workspace): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $resolvedWorkspace = $this->resolveApiWorkspace($workspace, $user);
        Gate::forUser($user)->authorize(Ability::CREATE->value, DataTable::class);
        $validated = $request->validate($this->mutationRules(requireName: true));
        $visibility = $validated['visibility'] ?? 'owner';
        $ownerData = array_key_exists('user_id', $validated)
            ? ['user_id' => $validated['user_id']]
            : [];
        $ownerId = $this->resolveOwnerId($ownerData, $resolvedWorkspace->id, $user->id);
        $teamId = $visibility === 'team' ? ($validated['team_id'] ?? null) : null;
        $this->assignments->validate($resolvedWorkspace->id, $ownerId, $visibility, $teamId);

        $table = $this->schema->createDataTable([
            'workspace_id' => $resolvedWorkspace->id,
            'user_id' => $ownerId,
            'team_id' => $teamId,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'group' => $validated['group'] ?? null,
            'visibility' => $visibility,
        ]);
        $table->load(['user:id,name', 'team:id,name', 'columns'])->loadCount('columns');

        return response()->json($this->serialize($table, $user, 0, includeColumns: true), 201);
    }

    public function show(Request $request, string $dataTable): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $table = $this->resolveApiDataTableForRequest($request, $dataTable);
        $table->load(['user:id,name', 'team:id,name', 'columns'])->loadCount('columns');

        return response()->json($this->serialize(
            $table,
            $user,
            DB::table($table->physical_name)->count(),
            includeColumns: true,
        ));
    }

    public function update(Request $request, string $dataTable): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $table = $this->resolveApiDataTable(
            $dataTable,
            $user,
            Ability::UPDATE,
        );
        $validated = $request->validate($this->mutationRules(requireName: false));
        $visibility = $validated['visibility'] ?? $table->visibility;
        $ownerData = array_key_exists('user_id', $validated)
            ? ['user_id' => $validated['user_id']]
            : [];
        $ownerId = $this->resolveOwnerId($ownerData, $table->workspace_id, $table->user_id);
        $teamId = $visibility === 'team'
            ? ($validated['team_id'] ?? $table->team_id)
            : null;

        if ($visibility !== $table->visibility || $teamId !== $table->team_id) {
            Gate::forUser($user)->authorize(Ability::MANAGE_SCOPE->value, $table);
        }
        $this->assignments->validate($table->workspace_id, $ownerId, $visibility, $teamId);
        $validated['user_id'] = $ownerId;
        $validated['team_id'] = $teamId;
        $validated['visibility'] = $visibility;

        $table = $this->schema->updateDataTable($table, $validated);
        $table->load(['user:id,name', 'team:id,name', 'columns'])->loadCount('columns');

        return response()->json($this->serialize(
            $table,
            $user,
            DB::table($table->physical_name)->count(),
            includeColumns: true,
        ));
    }

    public function destroy(Request $request, string $dataTable): JsonResponse
    {
        $table = $this->resolveApiDataTableForRequest($request, $dataTable, Ability::DELETE);
        $this->schema->deleteDataTable($table);

        return response()->json(['message' => 'Data table deleted.']);
    }

    /** @return array<string, list<mixed>> */
    private function mutationRules(bool $requireName): array
    {
        return [
            'name' => [$requireName ? 'required' : 'sometimes', 'string', 'max:128'],
            'description' => ['sometimes', 'nullable', 'string'],
            'group' => ['sometimes', 'nullable', 'string', 'max:100'],
            'visibility' => ['sometimes', Rule::in($this->features->allowedScopes())],
            'team_id' => ['sometimes', 'nullable', 'string'],
            'user_id' => ['sometimes', 'string', Rule::exists('users', 'id')],
        ];
    }

    /** @return array<string, mixed> */
    private function serialize(
        DataTable $table,
        User $user,
        ?int $rowsCount = null,
        bool $includeColumns = false,
    ): array {
        $result = [
            'id' => $table->id,
            'workspace_id' => $table->workspace_id,
            'user_id' => $table->user_id,
            'user_name' => $table->user?->name,
            'team_id' => $table->team_id,
            'team_name' => $table->team?->name,
            'name' => $table->name,
            'description' => $table->description,
            'group' => $table->group,
            'visibility' => $table->visibility,
            'columns_count' => $table->columns_count ?? $table->columns()->count(),
            'rows_count' => $rowsCount,
            'can_manage' => Gate::forUser($user)->allows(Ability::UPDATE->value, $table),
            'created_at' => $table->created_at?->toIso8601String(),
            'updated_at' => $table->updated_at?->toIso8601String(),
        ];

        if ($includeColumns) {
            $result['columns'] = $table->columns->map(
                fn ($column): array => [
                    'id' => $column->id,
                    'name' => $column->name,
                    'type' => $column->type->value,
                    'position' => $column->position,
                    'created_at' => $column->created_at?->toIso8601String(),
                    'updated_at' => $column->updated_at?->toIso8601String(),
                ],
            )->values();
        }

        return $result;
    }
}
