<?php

namespace App\Services\Media;

use App\Authorization\AuthorizationContext;
use App\Authorization\AuthorizationContextFactory;
use App\Authorization\OnBehalfOwnerResolver;
use App\Enums\Authorization\Ability;
use App\Models\MediaAsset;
use App\Models\MediaFolder;
use App\Models\User;
use App\Services\Explorer\BreadcrumbChainBuilder;
use App\Services\Explorer\ExplorerAccess;
use App\Services\Explorer\ExplorerFilters;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Media library page query. Exposes the same Inertia contract as
 * FlowExplorerQuery so both explorers share the front end kit.
 */
final class MediaExplorerQuery
{
    private const PER_PAGE = 24;

    public function __construct(
        private readonly AuthorizationContextFactory $contexts,
        private readonly ExplorerAccess $access,
        private readonly MediaTreeBuilder $trees,
        private readonly MediaPickerQuery $picker,
        private readonly MediaAssetProjector $projector,
        private readonly BreadcrumbChainBuilder $breadcrumbs,
        private readonly OnBehalfOwnerResolver $onBehalfOwners,
    ) {}

    public function render(Request $request, string $workspaceId, User $user): Response
    {
        $context = $this->contexts->for($user, $workspaceId);
        $filters = ExplorerFilters::fromRequest($request);
        $tag = trim($request->string('tag')->toString());
        $teamIds = $this->access->visibleTeamIds($context, $workspaceId);
        $workspaceAllowed = $this->access->workspaceAllowed($context);
        $search = $filters->search;
        $inspectingId = trim($request->string('media')->toString());
        $inspectingAsset = $inspectingId !== ''
            ? $this->trees->assets($context)->whereKey($inspectingId)->first()
            : null;
        abort_if($inspectingId !== '' && ! $inspectingAsset, 404);

        $currentFolder = $filters->folderId !== null
            ? MediaFolder::where('workspace_id', $workspaceId)
                ->where('id', $filters->folderId)
                ->with('user:id,name')
                ->first()
            : null;
        abort_if($filters->folderId !== null && ! $currentFolder, 404);
        if ($currentFolder) {
            abort_unless($user->can(Ability::VIEW->value, $currentFolder), 404);
        }
        $folderId = $currentFolder?->id;

        // Virtual team root: workspace view with a team_id and no folder.
        $teamId = $currentFolder?->team_id;
        if ($teamId === null && $filters->isWorkspaceView() && $filters->teamId !== null && $currentFolder === null) {
            abort_unless(in_array($filters->teamId, $teamIds, true), 404);
            $teamId = $filters->teamId;
        }

        $personalOwner = $user;
        if (! $filters->isWorkspaceView()) {
            $requestedOwnerId = $currentFolder && $currentFolder->visibility === 'owner'
                ? $currentFolder->user_id
                : $filters->ownerId;
            if ($requestedOwnerId !== null) {
                $requestedOwnerId = User::workspaceMemberId($requestedOwnerId, $workspaceId);
                abort_unless($requestedOwnerId !== null, 404);
            }
            $personalOwner = $this->onBehalfOwners->resolveOrFallback($user, $workspaceId, $requestedOwnerId);
        }

        $assets = $this->trees->assets($context)->reorder()->with(['user:id,name', 'team:id,name', 'folder:id,name']);
        $folders = collect();
        if ($filters->everywhere) {
            $this->applySearch($assets, $search);
        } elseif ($filters->isWorkspaceView()) {
            if ($teamId !== null) {
                $assets->where('visibility', 'team')->where('team_id', $teamId);
            } else {
                $assets->where('visibility', 'workspace');
            }
            $this->applyFolderAndSearch($assets, $folderId, $search);
            $folders = $this->workspaceFolders($context, $teamId, $folderId, $workspaceAllowed);
        } elseif ($filters->isUsersView()) {
            $assets->whereRaw('1 = 0');
        } else {
            $assets->whereIn('visibility', $this->access->ownerFallbackVisibilities())
                ->where('user_id', $personalOwner->id);
            $this->applyFolderAndSearch($assets, $folderId, $search);
            $folders = $this->trees->folders($context)->personal()
                ->where('user_id', $personalOwner->id)
                ->where('parent_id', $folderId)
                ->get();
        }
        if ($tag !== '') {
            $assets->whereJsonContains('tags', $tag);
        }

        $paginated = $assets->latest('updated_at')->paginate(self::PER_PAGE)->withQueryString();
        $paginated->through(fn (MediaAsset $asset): array => $this->projector->full($asset, $user));
        $tagSuggestions = $this->trees->assets($context)
            ->withoutEagerLoads()
            ->reorder()
            ->whereNotNull('tags')
            ->get(['tags'])
            ->flatMap(fn (MediaAsset $asset): array => $asset->tags ?? [])
            ->filter(fn (string $tag): bool => trim($tag) !== '')
            ->map(fn (string $tag): string => trim($tag))
            ->unique(fn (string $tag): string => mb_strtolower($tag))
            ->sort(fn (string $left, string $right): int => strnatcasecmp($left, $right))
            ->values()
            ->all();
        $pickerData = $this->picker->data($workspaceId, $user);

        return Inertia::render('Media/MediaLibrary/MediaLibrary', [
            'items' => $paginated,
            'folders' => $folders->map(fn (MediaFolder $folder): array => $folder->toExplorerFolder())->values(),
            'currentFolder' => $currentFolder?->toExplorerFolder(),
            'breadcrumbs' => $this->breadcrumbs->chain($currentFolder, fn (MediaFolder $folder): array => $folder->toExplorerFolder()),
            ...$pickerData,
            'filters' => [
                ...$filters->toPayload(
                    $folderId,
                    $personalOwner->id === $user->id ? null : $personalOwner->id,
                    $teamId,
                ),
                'persistent_filters' => $tag !== '' ? ['tag' => $tag] : [],
            ],
            'personalOwner' => [
                'id' => $personalOwner->id,
                'name' => $personalOwner->name,
            ],
            'inspectingItem' => $inspectingAsset
                ? $this->projector->full($inspectingAsset, $user)
                : null,
            'maxUploadSize' => config()->integer('puppetflow.media.max_upload_bytes'),
            'tagSuggestions' => $tagSuggestions,
            'activeTag' => $tag !== '' ? $tag : null,
        ]);
    }

    /** @param Builder<MediaAsset> $query */
    private function applyFolderAndSearch(Builder $query, ?string $folderId, string $search): void
    {
        if ($folderId !== null) {
            $query->where('folder_id', $folderId);
        } elseif ($search === '') {
            $query->whereNull('folder_id');
        }
        $this->applySearch($query, $search);
    }

    /** @param Builder<MediaAsset> $query */
    private function applySearch(Builder $query, string $search): void
    {
        if ($search === '') {
            return;
        }
        $query->where(fn (Builder $nested) => $nested->where('name', 'like', "%{$search}%")
            ->orWhere('original_filename', 'like', "%{$search}%")
            ->orWhere('description', 'like', "%{$search}%")
            ->orWhere('id', 'like', "%{$search}%"));
    }

    /** @return Collection<int, MediaFolder> */
    private function workspaceFolders(
        AuthorizationContext $context,
        ?string $teamId,
        ?string $parentId,
        bool $workspaceAllowed,
    ): Collection {
        $query = $this->trees->folders($context)->where('parent_id', $parentId);
        if ($teamId !== null) {
            return $query->teamScope($teamId)->get();
        }

        return $workspaceAllowed ? $query->workspaceScope()->get() : collect();
    }
}
