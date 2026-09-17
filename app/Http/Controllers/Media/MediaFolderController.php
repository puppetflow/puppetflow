<?php

namespace App\Http\Controllers\Media;

use App\Enums\Authorization\Ability;
use App\Http\Controllers\Controller;
use App\Http\Requests\Media\StoreMediaFolderRequest;
use App\Http\Requests\Media\UpdateMediaFolderRequest;
use App\Models\MediaFolder;
use App\Models\User;
use App\Services\Media\MediaPlacementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

final class MediaFolderController extends Controller
{
    public function __construct(private readonly MediaPlacementService $placement) {}

    /**
     * Creates a folder in the explorer location described by the shared payload:
     * parent_id, team_id (virtual team root), is_shared (workspace root) or owner_id (on behalf).
     */
    public function store(StoreMediaFolderRequest $request): JsonResponse|RedirectResponse
    {
        $workspaceId = $this->workspaceIdFromSession();
        /** @var User $user */
        $user = $request->user();
        /** @var array{name: string, parent_id?: string|null, team_id?: string|null, is_shared?: bool, owner_id?: string|null} $validated */
        $validated = $request->validated();
        $location = $this->placement->resolveLocation($user, $workspaceId, $validated);

        $folder = MediaFolder::create([
            'workspace_id' => $workspaceId,
            ...$location->assignment(),
            'parent_id' => $location->folderId,
            'name' => $validated['name'],
        ]);

        return $this->folderResponse($request, $folder, 'Folder created.', 201);
    }

    /** Renames or reorders a folder; moves go through move(). */
    public function update(UpdateMediaFolderRequest $request, MediaFolder $mediaFolder): JsonResponse|RedirectResponse
    {
        /** @var array{name?: string, sort_order?: int} $validated */
        $validated = $request->validated();
        $this->placement->updateFolder($mediaFolder, $validated);

        return $this->folderResponse($request, $mediaFolder, 'Folder updated.');
    }

    public function move(Request $request, MediaFolder $mediaFolder): JsonResponse|RedirectResponse
    {
        $this->authorizeOwn($mediaFolder, Ability::UPDATE);
        /** @var array{parent_id?: string|null, scope?: 'owner'|'workspace'|'team', team_id?: string|null, owner_id?: string|null, change_visibility?: bool} $validated */
        $validated = $request->validate([
            'parent_id' => ['nullable', 'string'],
            'scope' => ['sometimes', 'string', 'in:owner,workspace,team'],
            'team_id' => ['nullable', 'string'],
            'owner_id' => ['nullable', 'string'],
            'change_visibility' => ['sometimes', 'boolean'],
        ]);
        $this->placement->moveFolder(
            $mediaFolder,
            $validated['parent_id'] ?? null,
            $validated['scope'] ?? null,
            $validated['team_id'] ?? null,
            $validated['owner_id'] ?? null,
            $validated['change_visibility'] ?? false,
        );

        return $this->folderResponse($request, $mediaFolder, 'Folder moved.');
    }

    public function destroy(Request $request, MediaFolder $mediaFolder): JsonResponse|RedirectResponse
    {
        $this->authorizeOwn($mediaFolder, Ability::DELETE);
        DB::transaction(fn () => $mediaFolder->delete(), 3);

        return $request->wantsJson()
            ? response()->json(['message' => 'Folder deleted.'])
            : back()->with('success', 'Folder deleted.');
    }

    private function authorizeOwn(MediaFolder $folder, Ability $ability): void
    {
        abort_unless($folder->workspace_id === $this->workspaceIdFromSession(), 404);
        Gate::authorize($ability->value, $folder);
    }

    private function folderResponse(Request $request, MediaFolder $folder, string $message, int $status = 200): JsonResponse|RedirectResponse
    {
        return $request->wantsJson()
            ? response()->json($folder->refresh()->load('user:id,name')->toExplorerFolder(), $status)
            : back()->with('success', $message);
    }
}
