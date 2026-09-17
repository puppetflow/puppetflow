<?php

namespace App\Models;

use App\Casts\SafeEncrypted;
use App\Models\Concerns\HasStringId;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $workspace_id
 * @property string $user_id
 * @property string|null $team_id
 * @property string $name
 * @property string $authentication
 * @property array<string, mixed> $config
 * @property string $scope
 * @property bool $is_active
 * @property bool $stale
 */
class McpCredential extends Model
{
    use HasStringId;

    public const ID_PREFIX = 'mcpc';

    protected $fillable = [
        'workspace_id',
        'user_id',
        'team_id',
        'name',
        'authentication',
        'config',
        'scope',
        'is_active',
        'stale',
    ];

    protected $hidden = ['config'];

    protected function casts(): array
    {
        return [
            'config' => SafeEncrypted::class.':true',
            'is_active' => 'boolean',
            'stale' => 'boolean',
        ];
    }

    public function endpoint(): ?string
    {
        $endpoint = $this->config['endpoint'] ?? null;

        return is_string($endpoint) && trim($endpoint) !== '' ? trim($endpoint) : null;
    }

    public function transport(): string
    {
        return ($this->config['transport'] ?? null) === 'sse' ? 'sse' : 'httpStreamable';
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
        return $this->belongsTo(WorkspaceTeam::class, 'team_id');
    }
}
