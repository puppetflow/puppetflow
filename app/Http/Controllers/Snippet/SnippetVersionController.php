<?php

namespace App\Http\Controllers\Snippet;

use App\Enums\Authorization\Ability;
use App\Http\Controllers\Controller;
use App\Models\Snippet;
use App\Models\SnippetVersion;
use App\Models\User;
use App\Services\FeatureFlags\FeatureFlagService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class SnippetVersionController extends Controller
{
    public function index(Snippet $snippet): JsonResponse
    {
        $this->authorizeSnippetAccess($snippet);

        $versions = $snippet->versions()
            ->with('publisher:id,name')
            ->latest('version')
            ->get()
            ->map(fn (SnippetVersion $version): array => $this->metadata($version));

        return response()->json([
            'current_version_id' => $snippet->published_version_id,
            'versions' => $versions,
        ]);
    }

    public function show(Snippet $snippet, SnippetVersion $snippetVersion): JsonResponse
    {
        $this->authorizeSnippetAccess($snippet);
        $this->assertVersionBelongsToSnippet($snippet, $snippetVersion);
        $snippetVersion->load('publisher:id,name');

        return response()->json([
            ...$this->metadata($snippetVersion),
            'args' => $snippetVersion->args,
            'code' => $snippetVersion->code,
            'nodal_graph' => $snippetVersion->nodal_graph,
        ]);
    }

    public function restore(Request $request, Snippet $snippet, SnippetVersion $snippetVersion): JsonResponse
    {
        $this->authorizeSnippetAccess($snippet, Ability::UPDATE);
        $this->assertVersionBelongsToSnippet($snippet, $snippetVersion);
        abort_if(
            $snippet->library_locked,
            423,
            'Duplicate this library snippet before restoring a historical version.',
        );
        $request->validate(['client_updated_at' => 'sometimes|nullable|string']);

        $snippet = DB::transaction(function () use ($snippet, $snippetVersion, $request): Snippet {
            $lockedSnippet = Snippet::query()->whereKey($snippet->id)->lockForUpdate()->firstOrFail();
            $this->ensureDraftCurrent($request, $lockedSnippet);
            $lockedSnippet->update([
                'args' => $snippetVersion->args ?? '',
                'code' => $snippetVersion->code ?? '',
                'snippet_type' => $snippetVersion->snippet_type,
                'nodal_graph' => $snippetVersion->snippet_type === 'nodal'
                    ? $snippetVersion->nodal_graph
                    : null,
            ]);

            return $lockedSnippet;
        }, 3);

        return response()->json([
            'restored_version' => $snippetVersion->version,
            'content_updated_at' => $snippet->content_updated_at?->toJSON(),
        ]);
    }

    public function publish(Snippet $snippet, SnippetVersion $snippetVersion): JsonResponse
    {
        $this->authorizeSnippetAccess($snippet, Ability::UPDATE);
        $this->assertVersionBelongsToSnippet($snippet, $snippetVersion);

        DB::transaction(function () use ($snippet, $snippetVersion): void {
            $lockedSnippet = Snippet::query()->whereKey($snippet->id)->lockForUpdate()->firstOrFail();
            $lockedSnippet->updateQuietly(['published_version_id' => $snippetVersion->id]);
        }, 3);

        return response()->json([
            'published_version_id' => $snippetVersion->id,
            'published_version' => $snippetVersion->version,
        ]);
    }

    private function authorizeSnippetAccess(Snippet $snippet, Ability $ability = Ability::VIEW): void
    {
        $features = app(FeatureFlagService::class);
        $features->abortIfDisabled('snippets_enabled');
        $features->abortIfStale($snippet);
        abort_unless($snippet->workspace_id === $this->workspaceIdFromSession(), 404);
        Gate::authorize($ability->value, $snippet);
    }

    private function assertVersionBelongsToSnippet(Snippet $snippet, SnippetVersion $snippetVersion): void
    {
        abort_unless($snippetVersion->snippet_id === $snippet->id, 404);
    }

    private function ensureDraftCurrent(Request $request, Snippet $snippet): void
    {
        $value = $request->input('client_updated_at');
        if (! is_string($value) || $value === '') {
            return;
        }
        try {
            $client = Carbon::parse($value);
        } catch (\Throwable) {
            return;
        }
        $server = $snippet->content_updated_at ?? $snippet->updated_at;
        if ($server && $server->gt($client)) {
            throw ValidationException::withMessages([
                'client_updated_at' => 'The draft was updated by someone else. Reload the snippet before restoring a version.',
            ]);
        }
    }

    /** @return array<string, mixed> */
    private function metadata(SnippetVersion $version): array
    {
        $publisher = $version->publisher;

        return [
            'id' => $version->id,
            'version' => $version->version,
            'snippet_type' => $version->snippet_type,
            'published_at' => $version->published_at->toJSON(),
            'publisher' => $publisher instanceof User
                ? ['id' => $publisher->id, 'name' => $publisher->name]
                : null,
        ];
    }
}
