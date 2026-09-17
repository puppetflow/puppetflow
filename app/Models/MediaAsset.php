<?php

namespace App\Models;

use App\Models\Concerns\HasStringId;
use App\Services\Storage\UploadStorage;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

/**
 * @property string $id
 * @property string $workspace_id
 * @property string $user_id
 * @property string|null $team_id
 * @property string|null $folder_id
 * @property int $stored_upload_id
 * @property int|null $thumbnail_stored_upload_id
 * @property string $name
 * @property string $original_filename
 * @property string|null $description
 * @property string|null $alt_text
 * @property list<string>|null $tags
 * @property string $visibility
 * @property-read User|null $user
 * @property-read WorkspaceTeam|null $team
 * @property-read MediaFolder|null $folder
 * @property-read StoredUpload $storedUpload
 * @property-read StoredUpload|null $thumbnailStoredUpload
 */
class MediaAsset extends Model
{
    use HasStringId;

    public const ID_PREFIX = 'media';

    protected $fillable = [
        'workspace_id',
        'user_id',
        'team_id',
        'folder_id',
        'stored_upload_id',
        'thumbnail_stored_upload_id',
        'name',
        'original_filename',
        'description',
        'alt_text',
        'tags',
        'visibility',
    ];

    protected function casts(): array
    {
        return ['tags' => 'array'];
    }

    protected static function booted(): void
    {
        // Runs after the row is gone: the stored upload has a FK back to this asset.
        static::deleted(function (MediaAsset $asset): void {
            $paths = [
                $asset->storedUpload()->value('path'),
                $asset->thumbnailStoredUpload()->value('path'),
            ];
            foreach ($paths as $path) {
                if (is_string($path) && $path !== '') {
                    DB::afterCommit(fn () => app(UploadStorage::class)->delete($path));
                }
            }
        });
    }

    /** @return BelongsTo<Workspace, $this> */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<WorkspaceTeam, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(WorkspaceTeam::class);
    }

    /** @return BelongsTo<MediaFolder, $this> */
    public function folder(): BelongsTo
    {
        return $this->belongsTo(MediaFolder::class, 'folder_id');
    }

    /** @return BelongsTo<StoredUpload, $this> */
    public function storedUpload(): BelongsTo
    {
        return $this->belongsTo(StoredUpload::class);
    }

    /** @return BelongsTo<StoredUpload, $this> */
    public function thumbnailStoredUpload(): BelongsTo
    {
        return $this->belongsTo(StoredUpload::class, 'thumbnail_stored_upload_id');
    }
}
