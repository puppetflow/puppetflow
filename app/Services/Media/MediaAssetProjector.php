<?php

namespace App\Services\Media;

use App\Enums\Authorization\Ability;
use App\Models\MediaAsset;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

/**
 * Projects media assets into the explorer item contract (id, name, visibility,
 * owner_id, team_id) plus the media specific metadata consumed by the cards
 * and the metadata modal.
 */
final class MediaAssetProjector
{
    /**
     * Compact projection used inside the sidebar trees.
     *
     * @return array<string, mixed>
     */
    public function compact(MediaAsset $asset): array
    {
        $mime = $asset->storedUpload->mime_type ?? 'application/octet-stream';

        return [
            'id' => $asset->id,
            'name' => $asset->name,
            'visibility' => $asset->visibility,
            'owner_id' => $asset->user_id,
            'team_id' => $asset->team_id,
            'folder_id' => $asset->folder_id,
            'mime_type' => $mime,
            'thumbnail_url' => self::thumbnailUrl($asset, $mime),
        ];
    }

    /** Generated video frame or inline image URL used by explorer cards and selectors. */
    public static function thumbnailUrl(MediaAsset $asset, string $mime): ?string
    {
        if (str_starts_with($mime, 'video/') && $asset->thumbnail_stored_upload_id !== null) {
            return route('media.thumbnail', $asset, false);
        }

        return str_starts_with($mime, 'image/') && UploadStoragePreview::supportsInline($mime)
                ? route('media.preview', $asset, false)
                : null;
    }

    /**
     * Full projection used by the explorer results and the metadata modal.
     *
     * @return array<string, mixed>
     */
    public function full(MediaAsset $asset, User $actor): array
    {
        $asset->loadMissing(['user:id,name', 'storedUpload']);
        $mime = $asset->storedUpload->mime_type ?? 'application/octet-stream';
        $gate = Gate::forUser($actor);

        return [
            ...$this->compact($asset),
            'original_filename' => $asset->original_filename,
            'extension' => pathinfo($asset->original_filename, PATHINFO_EXTENSION) ?: null,
            'size_bytes' => $asset->storedUpload->size_bytes,
            'url' => UploadStoragePreview::supportsInline($mime)
                ? route('media.preview', $asset, false)
                : route('media.download', $asset, false),
            'download_url' => route('media.download', $asset, false),
            'alt_text' => $asset->alt_text,
            'description' => $asset->description,
            'tags' => $asset->tags ?? [],
            'owner' => $asset->user,
            'can_manage' => $gate->allows(Ability::UPDATE->value, $asset),
            'can_transfer_ownership' => $gate->allows(Ability::TRANSFER_OWNERSHIP->value, $asset),
            'updated_at' => $asset->updated_at,
        ];
    }
}
