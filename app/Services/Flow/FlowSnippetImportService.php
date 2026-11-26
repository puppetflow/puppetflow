<?php

namespace App\Services\Flow;

use App\Enums\Authorization\Ability;
use App\Models\Snippet;
use App\Models\User;
use App\Services\Library\LibrarySnippetReferenceRewriter;
use App\Services\Snippet\SnippetArgumentValidator;
use App\Services\Snippet\SnippetVersionService;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class FlowSnippetImportService
{
    public function __construct(
        private readonly LibrarySnippetReferenceRewriter $references,
        private readonly SnippetArgumentValidator $arguments,
        private readonly SnippetVersionService $versions,
    ) {}

    /**
     * Creates the exported snippets a flow archive carries, reusing the ones
     * that still exist and are usable in this workspace.
     *
     * @param array<int, array{
     *     source_id: string,
     *     label: string,
     *     description?: string|null,
     *     args?: string|null,
     *     code?: string|null,
     *     snippet_type: string,
     *     nodal_graph?: array<string, mixed>|null
     * }> $schemas
     * @return array<string, string> source snippet ID => created snippet ID
     */
    public function import(
        array $schemas,
        string $workspaceId,
        User $actor,
        string $ownerId,
        string $scope,
        ?string $teamId,
    ): array {
        if ($schemas === []) {
            return [];
        }

        $sourceIds = array_map(fn (array $schema): string => $schema['source_id'], $schemas);
        $reusable = Snippet::query()
            ->where('workspace_id', $workspaceId)
            ->where('is_active', true)
            ->where('stale', false)
            ->whereNotNull('published_version_id')
            ->whereIn('id', $sourceIds)
            ->get()
            ->filter(fn (Snippet $snippet): bool => $actor->can(Ability::USE->value, $snippet))
            ->keyBy('id');
        $missing = array_values(array_filter(
            $schemas,
            fn (array $schema): bool => ! $reusable->has($schema['source_id']),
        ));
        if ($missing === []) {
            return [];
        }

        Gate::forUser($actor)->authorize(Ability::CREATE->value, Snippet::class);

        $rewrites = [];
        $created = [];
        foreach ($missing as $schema) {
            $snippetType = $schema['snippet_type'];
            $nodalGraph = $snippetType === 'nodal' ? ($schema['nodal_graph'] ?? null) : null;
            if ($snippetType === 'nodal') {
                if ($nodalGraph === null || trim($schema['code'] ?? '') === '') {
                    throw ValidationException::withMessages([
                        'snippet_schemas' => "The nodal snippet \"{$schema['label']}\" must include a graph and compiled code.",
                    ]);
                }
                $this->arguments->validate($schema['args'] ?? '');
            }

            $snippet = Snippet::create([
                'workspace_id' => $workspaceId,
                'user_id' => $ownerId,
                'label' => $schema['label'],
                'description' => $schema['description'] ?? null,
                'group' => null,
                'args' => $schema['args'] ?? '',
                'code' => $schema['code'] ?? '',
                'snippet_type' => $snippetType,
                'nodal_graph' => $nodalGraph,
                'scope' => $scope,
                'team_id' => $scope === 'team' ? $teamId : null,
                'is_active' => true,
            ]);
            $rewrites[$schema['source_id']] = $snippet->id;
            $created[] = $snippet;
        }

        foreach ($created as $snippet) {
            $snippet->update([
                'code' => $this->references->code($snippet->code ?? '', $rewrites),
                'nodal_graph' => $snippet->snippet_type === 'nodal'
                    ? $this->references->graph($snippet->nodal_graph, $rewrites)
                    : null,
            ]);
            $this->versions->publish($snippet, $actor->id);
        }

        return $rewrites;
    }
}
