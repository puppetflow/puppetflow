<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SnippetVersion extends Model
{
    protected $fillable = [
        'snippet_id',
        'version',
        'args',
        'code',
        'snippet_type',
        'nodal_graph',
        'published_by',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'nodal_graph' => 'array',
            'published_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Snippet, $this> */
    public function snippet(): BelongsTo
    {
        return $this->belongsTo(Snippet::class);
    }

    /** @return BelongsTo<User, $this> */
    public function publisher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by');
    }
}
