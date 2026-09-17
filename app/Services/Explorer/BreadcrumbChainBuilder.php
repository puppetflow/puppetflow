<?php

namespace App\Services\Explorer;

use Illuminate\Database\Eloquent\Model;

/**
 * Walks a folder and its parents to produce the breadcrumb contract shared by
 * every explorer: { id, name, team_id, is_shared, parent_id, owner_id }.
 */
final class BreadcrumbChainBuilder
{
    /**
     * @template TFolder of Model
     *
     * @param  TFolder|null  $folder
     * @param  callable(TFolder): array<string, mixed>  $project
     * @return list<array<string, mixed>>
     */
    public function chain(?Model $folder, callable $project, string $parentRelation = 'parent'): array
    {
        $breadcrumbs = [];
        $current = $folder;
        while ($current instanceof Model) {
            /** @var TFolder $current */
            array_unshift($breadcrumbs, $project($current));
            $parent = $current->getRelationValue($parentRelation);
            $current = $parent instanceof Model ? $parent : null;
        }

        return $breadcrumbs;
    }
}
