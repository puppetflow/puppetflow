<?php

/*
 * Explicit proprietary scope: the paid shared-scope and private-library source fields in this file implement paid
 * Puppetflow features and are licensed under the Puppetflow Proprietary License.
 * See LICENSE_PROPRIETARY.md.
 */

namespace App\Models;

use App\Models\Concerns\HasStringId;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string|null $library_latest_source_sha
 * @property bool $library_update_available
 * @property string $scope
 * @property string|null $team_id
 */
class Snippet extends Model
{
    use HasStringId;

    public const ID_PREFIX = 'snip';

    protected $fillable = [
        'workspace_id',
        'user_id',
        'label',
        'description',
        'group',
        'args',
        'code',
        'snippet_type',
        'nodal_graph',
        'scope',
        'team_id',
        'is_active',
        'stale',
        'library_external_id',
        'library_external_key',
        'library_namespace',
        'library_reference',
        'library_source_path',
        'library_source_sha',
        'library_source_url',
        'library_imported_at',
    ];

    protected $appends = ['library_locked', 'published_version_number'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'stale' => 'boolean',
            'snippet_type' => 'string',
            'nodal_graph' => 'array',
            'content_updated_at' => 'datetime',
            'library_imported_at' => 'datetime',
        ];
    }

    public function getLibraryLockedAttribute(): bool
    {
        return ! empty($this->library_reference);
    }

    public function getPublishedVersionNumberAttribute(): ?int
    {
        $version = $this->publishedVersion;

        return $version instanceof SnippetVersion ? $version->version : null;
    }

    protected static function booted(): void
    {
        static::creating(function (Snippet $snippet): void {
            $snippet->content_updated_at ??= Carbon::now();
        });

        static::saving(function (Snippet $snippet): void {
            if (
                $snippet->exists
                && (
                    $snippet->isDirty('args')
                    || $snippet->isDirty('code')
                    || $snippet->isDirty('snippet_type')
                    || $snippet->isDirty('nodal_graph')
                    || $snippet->isDirty('label')
                    || $snippet->isDirty('description')
                    || $snippet->isDirty('group')
                    || $snippet->isDirty('is_active')
                    || $snippet->isDirty('scope')
                    || $snippet->isDirty('team_id')
                    || $snippet->isDirty('user_id')
                )
            ) {
                $snippet->content_updated_at = Carbon::now();
            }
        });
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<WorkspaceTeam, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(WorkspaceTeam::class, 'team_id');
    }

    /** @return HasMany<SnippetVersion, $this> */
    public function versions(): HasMany
    {
        return $this->hasMany(SnippetVersion::class);
    }

    /** @return BelongsTo<SnippetVersion, $this> */
    public function publishedVersion(): BelongsTo
    {
        return $this->belongsTo(SnippetVersion::class, 'published_version_id');
    }
}
