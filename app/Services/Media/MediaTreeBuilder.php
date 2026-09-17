<?php

namespace App\Services\Media;

use App\Authorization\AuthorizationContext;
use App\Authorization\AuthorizationContextFactory;
use App\Authorization\Visibility\SharedResourceVisibility;
use App\Models\MediaAsset;
use App\Models\MediaFolder;
use App\Models\User;
use App\Models\WorkspaceTeam;
use App\Services\Explorer\ExplorerAccess;
use App\Services\Explorer\FolderTreeAssembler;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Builds the sidebar trees of the media library with the exact contract used
 * by FlowTreeBuilder (personal, users, workspace and teams sections).
 *
 * Media folders have no physical team root: a team tree lists every folder
 * whose parent is null inside the team scope and exposes root_folder_id null.
 */
final class MediaTreeBuilder
{
    public function __construct(
        private readonly AuthorizationContextFactory $contexts,
        private readonly SharedResourceVisibility $visibility,
        private readonly ExplorerAccess $access,
        private readonly FolderTreeAssembler $assembler,
        private readonly MediaAssetProjector $projector,
    ) {}

    /** @return list<array<string, mixed>> */
    public function personal(string $workspaceId, User $user): array
    {
        $context = $this->contexts->for($user, $workspaceId);
        $folders = $this->folders($context)->personal()->where('user_id', $user->id)->get();
        if ($folders->isEmpty()) {
            return [];
        }

        $assets = $this->assets($context)
            ->whereIn('visibility', $this->access->ownerFallbackVisibilities())
            ->where('user_id', $user->id)
            ->whereIn('folder_id', $folders->pluck('id'))
            ->get();

        return $this->tree($folders, $assets);
    }

    /** @return list<array<string, mixed>> */
    public function users(string $workspaceId, User $user): array
    {
        $context = $this->contexts->for($user, $workspaceId);
        if (! $context->isInstanceAdmin()) {
            return [];
        }

        $folders = $this->folders($context)->personal()->where('user_id', '!=', $user->id)->get();
        $assets = $this->assets($context)
            ->whereIn('visibility', $this->access->ownerFallbackVisibilities())
            ->where('user_id', '!=', $user->id)
            ->get();

        $ownerIds = $folders->pluck('user_id')
            ->merge($assets->pluck('user_id'))
            ->filter()
            ->unique()
            ->values();
        $owners = User::whereIn('id', $ownerIds)->orderBy('name')->get(['id', 'name']);

        return array_values($owners->map(function (User $owner) use ($folders, $assets): array {
            $ownerFolders = $folders->where('user_id', $owner->id)->values();
            $ownerFolderIds = $ownerFolders->pluck('id');
            $ownerAssets = $assets->where('user_id', $owner->id)->values();

            return [
                'id' => $owner->id,
                'name' => $owner->name,
                'tree' => $this->tree($ownerFolders, $ownerAssets->whereIn('folder_id', $ownerFolderIds)->values()),
                'rootItems' => $this->items($ownerAssets->whereNull('folder_id')->values()),
            ];
        })->all());
    }

    /** @return list<array<string, mixed>> */
    public function workspace(string $workspaceId, User $user): array
    {
        $context = $this->contexts->for($user, $workspaceId);
        $folders = $this->folders($context)->workspaceScope()->get();
        if ($folders->isEmpty()) {
            return [];
        }

        $assets = $this->assets($context)
            ->where('visibility', 'workspace')
            ->whereIn('folder_id', $folders->pluck('id'))
            ->get();

        return $this->tree($folders, $assets, fn (MediaFolder $folder): array => [
            'owner_name' => $folder->user?->name,
        ]);
    }

    /**
     * @param  list<string>  $teamIds
     * @return list<array<string, mixed>>
     */
    public function teams(string $workspaceId, User $user, array $teamIds): array
    {
        if ($teamIds === []) {
            return [];
        }

        $context = $this->contexts->for($user, $workspaceId);
        $teams = WorkspaceTeam::where('workspace_id', $workspaceId)
            ->whereIn('id', $teamIds)
            ->orderBy('name')
            ->get();
        $folders = $this->folders($context)
            ->where('visibility', 'team')
            ->whereIn('team_id', $teams->pluck('id'))
            ->get();
        $assets = $this->assets($context)
            ->where('visibility', 'team')
            ->whereIn('team_id', $teams->pluck('id'))
            ->get();

        $result = [];
        foreach ($teams as $team) {
            $teamFolders = $folders->where('team_id', $team->id)->values();
            $teamAssets = $assets->where('team_id', $team->id)->values();

            $result[] = [
                'id' => $team->id,
                'name' => $team->name,
                'root_folder_id' => null,
                'tree' => $this->tree($teamFolders, $teamAssets->whereNotNull('folder_id')->values()),
                'rootItems' => $this->items($teamAssets->whereNull('folder_id')->values()),
            ];
        }

        return $result;
    }

    /**
     * Folders the actor may see, ordered for display.
     *
     * @return Builder<MediaFolder>
     */
    public function folders(AuthorizationContext $context): Builder
    {
        $query = MediaFolder::query()->with('user:id,name');
        $this->visibility->applyView($query, $context, scopeColumn: 'visibility');

        return $query->orderBy('sort_order')->orderBy('name');
    }

    /**
     * Assets the actor may see, ordered by name.
     *
     * @return Builder<MediaAsset>
     */
    public function assets(AuthorizationContext $context): Builder
    {
        $query = MediaAsset::query()->with('storedUpload');
        $this->visibility->applyView($query, $context, scopeColumn: 'visibility');

        return $query->orderBy('name');
    }

    /**
     * @param  Collection<int, MediaAsset>  $assets
     * @return list<array<string, mixed>>
     */
    public function items(Collection $assets): array
    {
        return array_values($assets->map(fn (MediaAsset $asset): array => $this->projector->compact($asset))->all());
    }

    /**
     * @param  Collection<int, MediaFolder>  $folders
     * @param  Collection<int, MediaAsset>  $assets
     * @param  (\Closure(MediaFolder): array<string, mixed>)|null  $extra
     * @return list<array<string, mixed>>
     */
    private function tree(Collection $folders, Collection $assets, ?\Closure $extra = null): array
    {
        $grouped = $this->assembler->groupItems(
            $assets,
            'folder_id',
            fn (MediaAsset $asset): array => $this->projector->compact($asset),
        );

        return $this->assembler->build(
            $folders,
            $grouped,
            null,
            fn (MediaFolder $folder): array => [
                'owner_id' => $folder->user_id,
                'is_shared' => $folder->visibility !== 'owner',
                'visibility' => $folder->visibility,
                ...($extra ? $extra($folder) : []),
            ],
        );
    }
}
