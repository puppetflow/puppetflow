<?php

namespace App\Services\Media;

use App\Authorization\OnBehalfOwnerResolver;
use App\Authorization\ResourceAssignmentValidator;
use App\Enums\Authorization\Ability;
use App\Models\MediaAsset;
use App\Models\MediaFolder;
use App\Models\User;
use App\Models\WorkspaceTeam;
use App\Services\FeatureFlags\FeatureFlagService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/**
 * Resolves where media assets and folders live (personal, on behalf, workspace
 * or team) and applies moves with the same rules as the flow explorer.
 */
final class MediaPlacementService
{
    public function __construct(
        private readonly ResourceAssignmentValidator $assignments,
        private readonly OnBehalfOwnerResolver $onBehalfOwners,
        private readonly FeatureFlagService $features,
    ) {}

    /**
     * Resolves the target location of a new folder or upload from the explorer payload:
     * parent folder, team, shared workspace, on behalf owner or the actor's personal space.
     *
     * @param  array<string, mixed>  $input
     */
    public function resolveLocation(User $actor, string $workspaceId, array $input, string $folderKey = 'parent_id'): MediaLocation
    {
        $folder = $this->folder($workspaceId, $input[$folderKey] ?? null);
        if ($folder !== null) {
            return MediaLocation::fromFolder($folder);
        }

        $teamId = $input['team_id'] ?? null;
        $visibility = $input['visibility'] ?? null;
        if ((is_string($teamId) && $teamId !== '') || $visibility === 'team') {
            abort_unless(in_array('team', $this->features->allowedScopes(), true), 422, 'Team media is not available.');
            abort_unless(is_string($teamId) && $teamId !== '', 422, 'A team is required for team media.');
            $team = WorkspaceTeam::where('workspace_id', $workspaceId)->findOrFail($teamId);
            $this->assignments->validate($workspaceId, $actor->id, 'team', $team->id);

            return new MediaLocation($actor->id, 'team', $team->id, null);
        }

        if (! empty($input['is_shared']) || $visibility === 'workspace') {
            abort_unless(in_array('workspace', $this->features->allowedScopes(), true), 422, 'Workspace media is not available.');
            $this->assignments->validate($workspaceId, $actor->id, 'workspace');

            return new MediaLocation($actor->id, 'workspace', null, null);
        }

        $ownerId = $input['owner_id'] ?? null;
        if (is_string($ownerId) && $ownerId !== '' && $ownerId !== $actor->id) {
            $memberId = User::workspaceMemberId($ownerId, $workspaceId);
            abort_unless($memberId !== null, 404);
            $owner = $this->onBehalfOwners->resolveOrFail($actor, $workspaceId, $memberId);

            return new MediaLocation($owner->id, 'owner', null, null);
        }

        return new MediaLocation($actor->id, 'owner', null, null);
    }

    /**
     * Applies a validated update payload to an asset: metadata plus optional
     * owner / visibility / team / folder changes (omitted keys keep their value).
     *
     * @param  array{
     *     name?: string, description?: string|null, alt_text?: string|null, tags?: list<string>,
     *     visibility?: string, team_id?: string|null, user_id?: string, folder_id?: string|null
     * }  $validated
     */
    public function updateAsset(MediaAsset $asset, array $validated): void
    {
        $folder = array_key_exists('folder_id', $validated)
            ? $this->folder($asset->workspace_id, $validated['folder_id'])
            : null;
        if ($folder !== null) {
            $target = MediaLocation::fromFolder($folder);
        } else {
            $visibility = $validated['visibility'] ?? $asset->visibility;
            $target = new MediaLocation(
                $validated['user_id'] ?? $asset->user_id,
                $visibility,
                $visibility === 'team' ? ($validated['team_id'] ?? $asset->team_id) : null,
                array_key_exists('folder_id', $validated) ? null : $asset->folder_id,
            );
        }
        unset($validated['visibility'], $validated['team_id'], $validated['user_id'], $validated['folder_id']);
        $this->place($asset, $target, true, $validated);
    }

    /**
     * Applies a validated update payload to a folder: rename / reorder, move under
     * a parent (parent_id) or to the root of another scope (visibility, team_id, user_id).
     *
     * @param  array{
     *     name?: string, sort_order?: int, parent_id?: string|null,
     *     visibility?: string, team_id?: string|null, user_id?: string
     * }  $validated
     */
    public function updateFolder(MediaFolder $folder, array $validated): void
    {
        if (array_key_exists('parent_id', $validated)) {
            $this->moveFolder($folder, $validated['parent_id']);
        } else {
            $visibility = $validated['visibility'] ?? $folder->visibility;
            $target = new MediaLocation(
                $validated['user_id'] ?? $folder->user_id,
                $visibility,
                $visibility === 'team' ? ($validated['team_id'] ?? $folder->team_id) : null,
                null,
            );
            if (! $target->matchesFolder($folder)) {
                $this->place($folder, $target, true, ['parent_id' => null]);
            }
        }
        $folder->update(array_intersect_key($validated, ['name' => true, 'sort_order' => true]));
    }

    /**
     * Moves an asset using the shared explorer payload:
     * { folder_id } for the personal space or { workspace_folder_id, scope, team_id } for shared spaces.
     *
     * @param  array{folder_id?: string|null, workspace_folder_id?: string|null, scope?: string, team_id?: string|null, owner_id?: string|null}  $validated
     */
    public function moveAsset(MediaAsset $asset, array $validated, bool $confirmed): void
    {
        $scope = $validated['scope'] ?? 'owner';
        $folder = $this->folder(
            $asset->workspace_id,
            $scope === 'owner' ? ($validated['folder_id'] ?? null) : ($validated['workspace_folder_id'] ?? null),
        );
        if ($folder !== null) {
            $target = MediaLocation::fromFolder($folder);
        } else {
            $teamId = $scope === 'team' ? ($validated['team_id'] ?? null) : null;
            abort_if($scope === 'team' && ! is_string($teamId), 422, 'A team is required for team media.');
            $ownerId = $scope === 'owner' && is_string($validated['owner_id'] ?? null)
                ? $validated['owner_id']
                : $asset->user_id;
            $target = new MediaLocation($ownerId, $scope, is_string($teamId) ? $teamId : null, null);
        }

        $this->place($asset, $target, $confirmed);
    }

    /** Moves a folder under a parent or to a virtual owner, workspace or team root. */
    public function moveFolder(
        MediaFolder $folder,
        mixed $parentId,
        ?string $scope = null,
        ?string $teamId = null,
        ?string $ownerId = null,
        bool $confirmed = true,
    ): void {
        $parent = $this->folder($folder->workspace_id, $parentId);
        if ($parent === null) {
            $visibility = $scope ?? $folder->visibility;
            $targetTeamId = $visibility === 'team'
                ? ($scope === null ? $folder->team_id : $teamId)
                : null;
            abort_if(
                $visibility === 'team' && (! is_string($targetTeamId) || $targetTeamId === ''),
                422,
                'A team is required for team media.',
            );
            $this->place(
                $folder,
                new MediaLocation(
                    $visibility === 'owner' && $ownerId !== null ? $ownerId : $folder->user_id,
                    $visibility,
                    $targetTeamId,
                    null,
                ),
                $confirmed,
                ['parent_id' => null],
            );

            return;
        }

        abort_if($this->isSelfOrDescendant($folder, $parent), 422, 'Cannot move a folder into itself or one of its descendants.');
        $this->place($folder, MediaLocation::fromFolder($parent), $confirmed, ['parent_id' => $parent->id]);
    }

    /**
     * Applies a location to an asset or folder: scope and ownership changes are
     * authorised and validated, folders propagate the assignment to their content.
     *
     * @param  array<string, mixed>  $attributes  Extra attributes saved alongside the assignment.
     */
    public function place(MediaAsset|MediaFolder $model, MediaLocation $target, bool $confirmed = true, array $attributes = []): void
    {
        $assignmentChanges = $model->user_id !== $target->userId
            || $model->visibility !== $target->visibility
            || $model->team_id !== $target->teamId;
        if ($assignmentChanges) {
            abort_unless($confirmed, 422, 'Visibility must be changed when moving to a folder with a different scope.');
            Gate::authorize(Ability::MANAGE_SCOPE->value, $model);
            if ($model->user_id !== $target->userId) {
                Gate::authorize(Ability::TRANSFER_OWNERSHIP->value, $model);
            }
        }
        $this->assignments->validate($model->workspace_id, $target->userId, $target->visibility, $target->teamId);
        if ($model instanceof MediaAsset) {
            if ($target->folderId !== null) {
                $folder = MediaFolder::where('workspace_id', $model->workspace_id)->findOrFail($target->folderId);
                abort_unless($target->matchesFolder($folder), 422, 'The destination folder must match the owner and visibility.');
            }
            $attributes['folder_id'] = $target->folderId;
        }

        DB::transaction(function () use ($model, $target, $assignmentChanges, $attributes): void {
            $model->update([...$attributes, ...$target->assignment()]);
            if ($assignmentChanges && $model instanceof MediaFolder) {
                $this->propagateAssignment($model, $target);
            }
        }, 3);
    }

    private function propagateAssignment(MediaFolder $folder, MediaLocation $target): void
    {
        $folder->assets()->update($target->assignment());
        foreach ($folder->children()->get() as $child) {
            $child->update($target->assignment());
            $this->propagateAssignment($child, $target);
        }
    }

    private function isSelfOrDescendant(MediaFolder $folder, MediaFolder $destination): bool
    {
        for ($current = $destination; $current !== null; $current = $current->parent) {
            if ($current->id === $folder->id) {
                return true;
            }
        }

        return false;
    }

    /** Loads a viewable workspace folder from a raw payload value, or null when none is given. */
    private function folder(string $workspaceId, mixed $folderId): ?MediaFolder
    {
        if (! is_string($folderId) || $folderId === '') {
            return null;
        }
        $folder = MediaFolder::where('workspace_id', $workspaceId)->findOrFail($folderId);
        Gate::authorize(Ability::VIEW->value, $folder);

        return $folder;
    }
}
