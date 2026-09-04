<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property \Illuminate\Support\Carbon $expires_at
 */
class McpBrokerAuthorizationCode extends Model
{
    protected $fillable = [
        'code_hash',
        'user_id',
        'workspace_id',
        'redirect_uri',
        'code_challenge',
        'expires_at',
    ];

    protected $hidden = [
        'code_hash',
        'code_challenge',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Workspace, $this> */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }
}
