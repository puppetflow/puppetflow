<?php

namespace App\Services\Runtime;

use App\Enums\Authorization\Ability;
use App\Models\FlowRun;
use App\Models\MediaAsset;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

final class MediaRuntimeService
{
    public function resolve(FlowRun $run, string $mediaId): MediaAsset
    {
        $flow = $run->flow()->firstOrFail();
        $actor = $run->triggeredBy()->first();
        abort_unless($actor instanceof User, 403, 'The media operation has no authorized actor.');

        $asset = MediaAsset::query()
            ->where('workspace_id', $flow->workspace_id)
            ->with('storedUpload')
            ->findOrFail($mediaId);
        Gate::forUser($actor)->authorize(Ability::USE->value, $asset);

        return $asset;
    }
}
