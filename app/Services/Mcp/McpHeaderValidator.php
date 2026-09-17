<?php

namespace App\Services\Mcp;

final class McpHeaderValidator
{
    private const RESERVED_NAMES = [
        'accept',
        'content-length',
        'content-type',
        'host',
        'mcp-protocol-version',
        'mcp-session-id',
    ];

    public function validName(mixed $name): bool
    {
        if (! is_string($name)) {
            return false;
        }

        $normalized = strtolower(trim($name));

        return $normalized !== ''
            && preg_match("/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/", $normalized) === 1
            && ! in_array($normalized, self::RESERVED_NAMES, true);
    }

    public function normalizedName(string $name): string
    {
        return strtolower(trim($name));
    }
}
