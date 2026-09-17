<?php

namespace App\Services\Media;

final class UploadStoragePreview
{
    private const INLINE_MIME_TYPES = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'audio/mpeg',
        'audio/ogg',
        'audio/wav',
        'video/mp4',
        'video/webm',
        'application/pdf',
        'text/plain',
    ];

    public static function supportsInline(?string $mimeType): bool
    {
        return is_string($mimeType) && in_array($mimeType, self::INLINE_MIME_TYPES, true);
    }
}
