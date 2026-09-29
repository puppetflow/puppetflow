<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Workspace chosen by a user when authorizing an instance-level OAuth client.
 *
 * @property string $user_id
 * @property string $oauth_client_id
 * @property string $workspace_id
 */
class McpOauthWorkspaceGrant extends Model
{
    protected $fillable = [
        'user_id',
        'oauth_client_id',
        'workspace_id',
    ];

    /** @return BelongsTo<Workspace, $this> */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }
}
