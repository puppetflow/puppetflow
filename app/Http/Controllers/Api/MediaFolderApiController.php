<?php

namespace App\Http\Controllers\Api;

use App\Authorization\AuthorizationContextFactory;
use App\Authorization\Visibility\SharedResourceVisibility;
use App\Enums\Authorization\Ability;
use App\Http\Controllers\Api\Concerns\ResolvesApiResources;
use App\Http\Controllers\Controller;
use App\Http\Requests\Media\StoreMediaFolderRequest;
use App\Http\Requests\Media\UpdateMediaFolderRequest;
use App\Models\MediaFolder;
use App\Models\User;
use App\Services\FeatureFlags\FeatureFlagService;
use App\Services\Media\MediaPlacementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

final class MediaFolderApiController extends Controller
{
    use ResolvesApiResources;

    public function __construct(
        private readonly MediaPlacementService $placement,
        private readonly AuthorizationContextFactory $contexts,
        private readonly SharedResourceVisibility $visibility,
        private readonly FeatureFlagService $features,
    ) {}

    public function index(Request $request, string $workspace): JsonResponse
    {
        $user = $this->apiUser($request);
        $resolvedWorkspace = $this->resolveApiWorkspace($workspace, $user);
        $validated = $request->validate([
            'search' => ['sometimes', 'string', 'max:128'],
            'parent_id' => ['sometimes', 'nullable', 'string'],
            'visibility' => ['sometimes', Rule::in($this->features->allowedScopes())],
            'team_id' => ['sometimes', 'string'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $query = MediaFolder::query()->with(['user:id,name', 'team:id,name'])->withCount(['children', 'assets']);
        $this->visibility->applyView(
            $query,
            $this->contexts->for($user, $resolvedWorkspace->id),
            scopeColumn: 'visibility',
        );

        if (isset($validated['search'])) {
            $query->where('name', 'like', "%{$validated['search']}%");
        }
        if (array_key_exists('parent_id', $validated)) {
            $parentId = $validated['parent_id'];
            $parentId === null || $parentId === ''
                ? $query->whereNull('parent_id')
                : $query->where('parent_id', $parentId);
        }
        if (isset($validated['visibility'])) {
            $query->where('visibility', $validated['visibility']);
        }
        if (isset($validated['team_id'])) {
            $query->where('team_id', $validated['team_id']);
        }

        $paginator = $query->orderBy('sort_order')->orderBy('name')->orderBy('id')
            ->paginate($validated['per_page'] ?? 50);
        $paginator->through(fn (MediaFolder $folder): array => $this->serialize($folder, $user));

        return response()->json($paginator);
    }

    /** Creates a folder under a parent, at a team / workspace root, or in a member's personal space. */
    public function store(Request $request, string $workspace): JsonResponse
    {
        $user = $this->apiUser($request);
        $resolvedWorkspace = $this->resolveApiWorkspace($workspace, $user);
        Gate::forUser($user)->authorize(Ability::CREATE->value, MediaFolder::class);
        $this->rejectCombinedPlacement($request, 'parent_id');
        $rules = StoreMediaFolderRequest::rulesFor($resolvedWorkspace->id);
        unset($rules['owner_id'], $rules['is_shared']);
        $rules['is_shared'] = ['prohibited'];
        $rules['parent_id'] = [
            'nullable',
            Rule::exists('media_folders', 'id')->where('workspace_id', $resolvedWorkspace->id),
        ];
        $rules['user_id'] = [
            'sometimes',
            'required',
            Rule::exists('user_workspace', 'user_id')->where('workspace_id', $resolvedWorkspace->id),
        ];
        /** @var array{name: string, parent_id?: string|null, team_id?: string|null, visibility?: string, is_shared?: bool, owner_id?: string|null, user_id?: string} $validated */
        $validated = $request->validate($rules);
        if (isset($validated['user_id'])) {
            $validated['owner_id'] = $validated['user_id'];
            unset($validated['user_id']);
        }
        $location = $this->placement->resolveLocation($user, $resolvedWorkspace->id, $validated);

        $folder = MediaFolder::create([
            'workspace_id' => $resolvedWorkspace->id,
            ...$location->assignment(),
            'parent_id' => $location->folderId,
            'name' => $validated['name'],
        ]);

        return response()->json($this->serialize($folder->refresh(), $user), 201);
    }

    public function show(Request $request, string $folder): JsonResponse
    {
        $user = $this->apiUser($request);
        $resolved = $this->resolveApiResource(MediaFolder::class, $folder, $user, Ability::VIEW, 'Media folder');

        return response()->json($this->serialize($resolved, $user));
    }

    /** Renames, reorders or moves a folder (parent_id, or visibility / team_id / user_id for a scope root). */
    public function update(Request $request, string $folder): JsonResponse
    {
        $user = $this->apiUser($request);
        $resolved = $this->resolveApiResource(MediaFolder::class, $folder, $user, Ability::UPDATE, 'Media folder');
        $workspaceId = $resolved->workspace_id;
        $this->rejectCombinedPlacement($request, 'parent_id');
        $validated = $request->validate([
            ...UpdateMediaFolderRequest::rulesFor(),
            'parent_id' => [
                'sometimes',
                'nullable',
                Rule::exists('media_folders', 'id')->where('workspace_id', $workspaceId),
            ],
            'visibility' => ['sometimes', Rule::in($this->features->allowedScopes())],
            'team_id' => ['sometimes', 'nullable', Rule::exists('workspace_teams', 'id')->where('workspace_id', $workspaceId)],
            'user_id' => ['sometimes', 'required', Rule::exists('user_workspace', 'user_id')->where('workspace_id', $workspaceId)],
        ]);
        $this->placement->updateFolder($resolved, $validated);

        return response()->json($this->serialize($resolved->refresh(), $user));
    }

    public function destroy(Request $request, string $folder): JsonResponse
    {
        $resolved = $this->resolveApiResource(MediaFolder::class, $folder, $this->apiUser($request), Ability::DELETE, 'Media folder');
        DB::transaction(fn () => $resolved->delete(), 3);

        return response()->json(['message' => 'Media folder deleted.']);
    }

    /** @return array<string, mixed> */
    private function serialize(MediaFolder $folder, User $user): array
    {
        $folder->loadMissing(['user:id,name', 'team:id,name']);
        if (! isset($folder->children_count)) {
            $folder->loadCount(['children', 'assets']);
        }

        return [
            'id' => $folder->id,
            'workspace_id' => $folder->workspace_id,
            'user_id' => $folder->user_id,
            'user_name' => $folder->user?->name,
            'team_id' => $folder->team_id,
            'team_name' => $folder->team?->name,
            'parent_id' => $folder->parent_id,
            'name' => $folder->name,
            'visibility' => $folder->visibility,
            'sort_order' => $folder->sort_order,
            'children_count' => $folder->children_count,
            'assets_count' => $folder->assets_count,
            'can_manage' => Gate::forUser($user)->allows(Ability::UPDATE->value, $folder),
            'created_at' => $folder->created_at?->toIso8601String(),
            'updated_at' => $folder->updated_at?->toIso8601String(),
        ];
    }
}
