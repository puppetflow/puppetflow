<?php

namespace App\Policies\Media;

use App\Policies\Shared\ScopedResourcePolicy;

final class MediaFolderPolicy extends ScopedResourcePolicy
{
    protected function scopeColumn(): string
    {
        return 'visibility';
    }
}
