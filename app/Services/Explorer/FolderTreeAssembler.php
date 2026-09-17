<?php

namespace App\Services\Explorer;

use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

/**
 * Builds the nested folder tree contract shared by every explorer:
 * { id, name, parent_id, children[], items[], ...extra }.
 */
final class FolderTreeAssembler
{
    /**
     * @template TFolder of Model
     *
     * @param  Collection<int, TFolder>  $folders  Flat list of folders exposing id, name and parent_id.
     * @param  array<string, list<array<string, mixed>>>  $itemsByFolder  Projected items keyed by folder id.
     * @param  (Closure(TFolder): array<string, mixed>)|null  $extra  Extra attributes merged into every node.
     * @return list<array<string, mixed>>
     */
    public function build(
        Collection $folders,
        array $itemsByFolder = [],
        ?string $startParent = null,
        ?Closure $extra = null,
    ): array {
        $byParent = [];
        foreach ($folders as $folder) {
            $byParent[self::key($folder->getAttribute('parent_id'))][] = $folder;
        }

        $build = function (?string $parentId) use (&$build, $byParent, $itemsByFolder, $extra): array {
            $children = $byParent[$parentId === null ? '' : $parentId] ?? [];
            $nodes = [];
            foreach ($children as $folder) {
                $id = self::key($folder->getKey());
                $node = [
                    'id' => $id,
                    'name' => $folder->getAttribute('name'),
                    'parent_id' => $folder->getAttribute('parent_id'),
                    'children' => $build($id),
                    'items' => $itemsByFolder[$id] ?? [],
                ];
                $teamId = $folder->getAttribute('team_id');
                if ($teamId !== null) {
                    $node['team_id'] = $teamId;
                }
                if ($extra !== null) {
                    $node = [...$node, ...$extra($folder)];
                }
                $nodes[] = $node;
            }

            return $nodes;
        };

        return $build($startParent);
    }

    /**
     * Groups projected items by their folder column.
     *
     * @template TItem of Model
     *
     * @param  iterable<TItem>  $items
     * @param  Closure(TItem): array<string, mixed>  $project
     * @return array<string, list<array<string, mixed>>>
     */
    public function groupItems(iterable $items, string $folderKey, Closure $project): array
    {
        $grouped = [];
        foreach ($items as $item) {
            $grouped[self::key($item->getAttribute($folderKey))][] = $project($item);
        }

        return $grouped;
    }

    private static function key(mixed $value): string
    {
        if ($value === null) {
            return '';
        }

        return is_scalar($value) ? (string) $value : '';
    }
}
