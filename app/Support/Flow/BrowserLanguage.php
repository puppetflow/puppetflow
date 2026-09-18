<?php

namespace App\Support\Flow;

/**
 * Browser language preference as a comma-separated list of BCP 47 tags,
 * for example "fr-FR,fr". Shared by the instance, workspace and flow levels.
 */
final class BrowserLanguage
{
    public const MAX_LENGTH = 64;

    /** Validation regex for a comma-separated list of BCP 47 language tags. */
    public const PATTERN = '/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*(\s*,\s*[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*)*$/';

    /**
     * @return list<string>
     */
    public static function rules(): array
    {
        return ['sometimes', 'nullable', 'string', 'max:'.self::MAX_LENGTH, 'regex:'.self::PATTERN];
    }

    /**
     * Trims each tag and drops empty entries. Returns null when nothing is left.
     */
    public static function normalize(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $tags = array_values(array_filter(
            array_map('trim', explode(',', $value)),
            static fn (string $tag): bool => $tag !== '',
        ));

        return $tags === [] ? null : implode(',', $tags);
    }
}
