<?php

namespace App\Services\Media;

use App\Authorization\AuthorizationContextFactory;
use App\Authorization\Visibility\SharedResourceVisibility;
use App\Models\MediaAsset;
use App\Models\User;
use App\Services\Explorer\ExplorerAccess;

final class MediaPickerQuery
{
    public function __construct(
        private readonly AuthorizationContextFactory $contexts,
        private readonly SharedResourceVisibility $visibility,
        private readonly ExplorerAccess $access,
        private readonly MediaTreeBuilder $trees,
    ) {}

    /** @return array<string, mixed> */
    public function data(string $workspaceId, User $user): array
    {
        $context = $this->contexts->for($user, $workspaceId);
        $teamIds = $this->access->visibleTeamIds($context, $workspaceId);
        $workspaceAllowed = $this->access->workspaceAllowed($context);
        $usableAssets = MediaAsset::query();
        $this->visibility->applyUse($usableAssets, $context, scopeColumn: 'visibility');
        /** @var list<string> $usableIdList */
        $usableIdList = $usableAssets->pluck('id')
            ->filter(static fn (mixed $id): bool => is_string($id))
            ->values()
            ->all();
        $usableIds = array_fill_keys($usableIdList, true);
        $filterItems = static fn (array $items): array => array_values(array_filter(
            $items,
            static fn (mixed $item): bool => is_array($item)
                && isset($item['id'])
                && is_string($item['id'])
                && isset($usableIds[$item['id']]),
        ));

        return [
            'folderTree' => $this->filterTrees($this->trees->personal($workspaceId, $user), $usableIds),
            'rootItems' => $filterItems($this->trees->items(
                $this->trees->assets($context)
                    ->whereIn('visibility', $this->access->ownerFallbackVisibilities())
                    ->where('user_id', $user->id)
                    ->whereNull('folder_id')
                    ->get(),
            )),
            'workspaceTree' => $this->filterTrees($this->trees->workspace($workspaceId, $user), $usableIds),
            'workspaceRootItems' => $workspaceAllowed
                ? $filterItems($this->trees->items(
                    $this->trees->assets($context)
                        ->where('visibility', 'workspace')
                        ->whereNull('folder_id')
                        ->get(),
                ))
                : [],
            'teamTrees' => array_map(fn (array $team): array => [
                ...$team,
                'tree' => $this->filterTrees(
                    isset($team['tree']) && is_array($team['tree']) ? $team['tree'] : [],
                    $usableIds,
                ),
                'rootItems' => $filterItems(
                    isset($team['rootItems']) && is_array($team['rootItems']) ? $team['rootItems'] : [],
                ),
            ], $this->trees->teams($workspaceId, $user, $teamIds)),
            'userTrees' => array_map(fn (array $owner): array => [
                ...$owner,
                'tree' => $this->filterTrees(
                    isset($owner['tree']) && is_array($owner['tree']) ? $owner['tree'] : [],
                    $usableIds,
                ),
                'rootItems' => $filterItems(
                    isset($owner['rootItems']) && is_array($owner['rootItems']) ? $owner['rootItems'] : [],
                ),
            ], $this->trees->users($workspaceId, $user)),
        ];
    }

    /**
     * @param  array<mixed>  $trees
     * @param  array<string, true>  $usableIds
     * @return list<array<string, mixed>>
     */
    private function filterTrees(array $trees, array $usableIds): array
    {
        $filtered = [];
        foreach ($trees as $folder) {
            if (! is_array($folder)) {
                continue;
            }
            $items = isset($folder['items']) && is_array($folder['items']) ? $folder['items'] : [];
            $children = isset($folder['children']) && is_array($folder['children']) ? $folder['children'] : [];

            $filtered[] = [
                ...$folder,
                'items' => array_values(array_filter(
                    $items,
                    static fn (mixed $item): bool => is_array($item)
                        && isset($item['id'])
                        && is_string($item['id'])
                        && isset($usableIds[$item['id']]),
                )),
                'children' => $this->filterTrees($children, $usableIds),
            ];
        }

        return $filtered;
    }
}
