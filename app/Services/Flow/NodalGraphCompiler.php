<?php

namespace App\Services\Flow;

use Illuminate\Foundation\Application;
use Illuminate\Process\Exceptions\ProcessTimedOutException;
use Illuminate\Support\Facades\Process;
use Illuminate\Validation\ValidationException;

final class NodalGraphCompiler
{
    public function __construct(private readonly Application $app) {}

    /**
     * @param  array<string, mixed>  $graph
     */
    public function compile(array $graph): string
    {
        $executable = $this->app->bootstrapPath('nodal-compiler/compiler.mjs');
        if (! is_file($executable)) {
            throw ValidationException::withMessages([
                'nodal_graph' => 'The server nodal compiler is not available.',
            ]);
        }

        $payload = json_encode(['graph' => $graph], JSON_THROW_ON_ERROR);
        try {
            $result = Process::timeout(15)
                ->input($payload)
                ->run(['node', $executable]);
        } catch (ProcessTimedOutException) {
            throw ValidationException::withMessages([
                'nodal_graph' => 'Nodal graph compilation timed out.',
            ]);
        }

        $decoded = json_decode($result->output(), true);
        if (
            ! $result->successful()
            || ! is_array($decoded)
            || ! is_string($decoded['code'] ?? null)
        ) {
            $message = is_array($decoded) && is_string($decoded['error'] ?? null)
                ? $decoded['error']
                : trim($result->errorOutput());

            throw ValidationException::withMessages([
                'nodal_graph' => $message !== '' ? $message : 'The nodal graph could not be compiled.',
            ]);
        }

        return $decoded['code'];
    }
}
