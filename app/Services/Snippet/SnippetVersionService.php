<?php

namespace App\Services\Snippet;

use App\Models\Snippet;
use App\Models\SnippetVersion;

final class SnippetVersionService
{
    public function publish(Snippet $snippet, ?string $publisherId): SnippetVersion
    {
        $latestVersion = $snippet->versions()->max('version');
        $nextVersion = is_numeric($latestVersion) ? ((int) $latestVersion) + 1 : 1;
        $version = $snippet->versions()->create([
            'version' => $nextVersion,
            'args' => $snippet->args,
            'code' => $snippet->code,
            'snippet_type' => $snippet->snippet_type,
            'nodal_graph' => $snippet->snippet_type === 'nodal' ? $snippet->nodal_graph : null,
            'published_by' => $publisherId,
            'published_at' => now(),
        ]);
        $snippet->updateQuietly(['published_version_id' => $version->id]);
        $snippet->setRelation('publishedVersion', $version);

        return $version;
    }
}
