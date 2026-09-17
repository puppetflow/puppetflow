<?php

namespace App\Services\Integration\Ai\Vendor\Concerns;

trait DecodesToolArguments
{
    /**
     * Tool call arguments as sent by the runtime: the raw JSON wins so that `{}` survives the round trip.
     *
     * @param  array<string, mixed>  $part
     * @return array<mixed, mixed>|\stdClass
     */
    private function toolArguments(array $part): array|\stdClass
    {
        if (is_string($part['arguments_json'] ?? null)) {
            $decoded = json_decode($part['arguments_json']);
            if ($decoded instanceof \stdClass) {
                return $decoded;
            }
        }

        return is_array($part['arguments'] ?? null) && $part['arguments'] !== []
            ? $part['arguments']
            : new \stdClass;
    }
}
