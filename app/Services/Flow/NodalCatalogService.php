<?php

namespace App\Services\Flow;

use Illuminate\Support\Facades\File;
use RuntimeException;

final class NodalCatalogService
{
    /** @var array{flow: list<array<string, mixed>>, code: list<array<string, mixed>>}|null */
    private ?array $catalog = null;

    /** @return list<array<string, mixed>> */
    public function entries(string $context = 'flow'): array
    {
        $catalog = $this->catalog();

        return $catalog[$context === 'code' ? 'code' : 'flow'];
    }

    /** @return list<string> */
    public function names(): array
    {
        return array_map(
            fn (array $entry): string => is_string($entry['name'] ?? null) ? $entry['name'] : '',
            $this->entries(),
        );
    }

    /** @return array{flow: list<array<string, mixed>>, code: list<array<string, mixed>>} */
    private function catalog(): array
    {
        if ($this->catalog !== null) {
            return $this->catalog;
        }

        $path = base_path('bootstrap/nodal-compiler/catalog.json');
        if (! File::exists($path)) {
            throw new RuntimeException('The generated nodal catalog is missing. Run npm run build:nodal-compiler.');
        }

        $decoded = json_decode(File::get($path), true, flags: JSON_THROW_ON_ERROR);
        if (! is_array($decoded) || ! is_array($decoded['flow'] ?? null) || ! is_array($decoded['code'] ?? null)) {
            throw new RuntimeException('The generated nodal catalog has an invalid structure.');
        }

        /** @var array{flow: list<array<string, mixed>>, code: list<array<string, mixed>>} $catalog */
        $catalog = [
            'flow' => array_values($decoded['flow']),
            'code' => array_values($decoded['code']),
        ];

        return $this->catalog = $catalog;
    }
}
