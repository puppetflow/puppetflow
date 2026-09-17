<?php

namespace App\Models;

use App\Models\Concerns\HasStringId;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $workspace_id
 * @property string $user_id
 * @property string|null $team_id
 * @property string|null $parent_id
 * @property string $name
 * @property string $visibility
 * @property int $sort_order
 * @property-read User|null $user
 * @property-read WorkspaceTeam|null $team
 * @property-read MediaFolder|null $parent
 */
class MediaFolder extends Model
{
    use HasStringId;

    public const ID_PREFIX = 'mfld';

    protected $fillable = [
        'workspace_id',
        'user_id',
        'team_id',
        'parent_id',
        'name',
        'visibility',
        'sort_order',
    ];

    protected function casts(): array
    {
        return ['sort_order' => 'integer'];
    }

    protected static function booted(): void
    {
        static::deleting(function (MediaFolder $folder): void {
            $folder->children()->get()->each->delete();
            $folder->assets()->get()->each->delete();
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
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    /** @return HasMany<MediaFolder, $this> */
    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('sort_order')->orderBy('name');
    }

    /** @return HasMany<MediaAsset, $this> */
    public function assets(): HasMany
    {
        return $this->hasMany(MediaAsset::class, 'folder_id');
    }

    /**
     * Personal folders (owner scope) mirror Folder::personal().
     *
     * @param  Builder<MediaFolder>  $query
     * @return Builder<MediaFolder>
     */
    public function scopePersonal(Builder $query): Builder
    {
        return $query->where('visibility', 'owner')->whereNull('team_id');
    }

    /**
     * Workspace wide folders mirror Folder::workspaceScope().
     *
     * @param  Builder<MediaFolder>  $query
     * @return Builder<MediaFolder>
     */
    public function scopeWorkspaceScope(Builder $query): Builder
    {
        return $query->where('visibility', 'workspace')->whereNull('team_id');
    }

    /**
     * Team folders mirror Folder::teamScope().
     *
     * @param  Builder<MediaFolder>  $query
     * @return Builder<MediaFolder>
     */
    public function scopeTeamScope(Builder $query, string $teamId): Builder
    {
        return $query->where('visibility', 'team')->where('team_id', $teamId);
    }

    /**
     * Explorer folder contract shared with Flow folders.
     *
     * @return array<string, mixed>
     */
    public function toExplorerFolder(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'parent_id' => $this->parent_id,
            'sort_order' => $this->sort_order,
            'is_shared' => $this->visibility !== 'owner',
            'visibility' => $this->visibility,
            'team_id' => $this->team_id,
            'owner_id' => $this->user_id,
            'owner' => $this->relationLoaded('user') && $this->user
                ? ['id' => $this->user->id, 'name' => $this->user->name]
                : null,
        ];
    }
}
