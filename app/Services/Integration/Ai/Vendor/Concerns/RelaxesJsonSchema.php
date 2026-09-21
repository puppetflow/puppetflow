<?php

namespace App\Services\Integration\Ai\Vendor\Concerns;

use Illuminate\Http\Client\Response;

trait RelaxesJsonSchema
{
    /**
     * Whether a failed response is the provider rejecting the output JSON
     * Schema itself (as opposed to auth, quota or an unsupported option).
     *
     * @param  list<string>  $markers  Lowercase substrings identifying a schema error.
     */
    private function isSchemaRejected(Response $response, array $markers): bool
    {
        if ($response->status() !== 400) {
            return false;
        }

        $errorMessage = $response->json('error.message') ?? $response->json('message');
        $detail = is_string($errorMessage) ? strtolower($errorMessage) : '';
        if ($detail === '') {
            return false;
        }

        foreach ($markers as $marker) {
            if (str_contains($detail, strtolower($marker))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Remove JSON Schema value constraints that structured output engines
     * commonly refuse (they compile the schema into a grammar), moving them
     * into the description so the model still sees them.
     *
     * @param  array<mixed>  $schema
     * @return array<mixed>
     */
    private function relaxSchema(array $schema): array
    {
        $hints = [];
        foreach ([
            'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
            'minLength', 'maxLength', 'minItems', 'maxItems', 'uniqueItems',
            'minProperties', 'maxProperties', 'minContains', 'maxContains',
        ] as $keyword) {
            if (! array_key_exists($keyword, $schema)) {
                continue;
            }
            $value = $schema[$keyword];
            $hints[] = $keyword.' '.(is_bool($value) ? ($value ? 'true' : 'false') : json_encode($value));
            unset($schema[$keyword]);
        }
        if ($hints !== []) {
            $description = is_string($schema['description'] ?? null) ? trim($schema['description']) : '';
            $schema['description'] = trim($description.' Constraints: '.implode(', ', $hints).'.');
        }

        foreach (['properties', 'patternProperties', '$defs', 'definitions'] as $mapKeyword) {
            if (is_array($schema[$mapKeyword] ?? null)) {
                foreach ($schema[$mapKeyword] as $key => $child) {
                    if (is_array($child)) {
                        $schema[$mapKeyword][$key] = $this->relaxSchema($child);
                    }
                }
            }
        }
        foreach (['allOf', 'anyOf', 'oneOf', 'prefixItems'] as $listKeyword) {
            if (is_array($schema[$listKeyword] ?? null)) {
                foreach ($schema[$listKeyword] as $index => $child) {
                    if (is_array($child)) {
                        $schema[$listKeyword][$index] = $this->relaxSchema($child);
                    }
                }
            }
        }
        foreach (['items', 'additionalProperties', 'contains', 'not', 'if', 'then', 'else', 'propertyNames'] as $keyword) {
            if (is_array($schema[$keyword] ?? null) && $schema[$keyword] !== []) {
                $schema[$keyword] = $this->relaxSchema($schema[$keyword]);
            }
        }

        return $schema;
    }
}
