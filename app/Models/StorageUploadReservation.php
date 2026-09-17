<?php

namespace App\Models;

use App\Models\Concerns\HasStringId;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $workspace_id
 * @property string $user_id
 * @property string $disk
 * @property string $status
 * @property int $expected_bytes
 * @property array<string, mixed> $payload
 * @property \Illuminate\Support\Carbon $expires_at
 */
final class StorageUploadReservation extends Model
{
    use HasStringId;

    public const ID_PREFIX = 'upload';

    public const STATUS_PENDING = 'pending';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'workspace_id',
        'user_id',
        'disk',
        'status',
        'expected_bytes',
        'payload',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'expected_bytes' => 'integer',
            'payload' => 'array',
            'expires_at' => 'datetime',
        ];
    }
}
