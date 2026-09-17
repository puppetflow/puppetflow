<?php

namespace App\Policies\Media;

use App\Policies\Shared\ScopedResourcePolicy;

final class MediaAssetPolicy extends ScopedResourcePolicy
{
    protected function scopeColumn(): string
    {
        return 'visibility';
    }
}
