<?php

namespace App\Services\Flow;

use Illuminate\Foundation\Application;
use Illuminate\Process\Exceptions\ProcessTimedOutException;
use Illuminate\Support\Facades\Process;
use Illuminate\Validation\ValidationException;

final class FlowCodeValidator
{
    public function __construct(private readonly Application $app) {}

    public function validate(string $code): void
    {
        try {
            $result = Process::timeout(5)
                ->input($code)
                ->run(['node', $this->app->basePath('scripts/validate-flow-code.mjs')]);
        } catch (ProcessTimedOutException) {
            throw ValidationException::withMessages([
                'code' => 'JavaScript syntax validation timed out.',
            ]);
        }

        if (! $result->successful()) {
            throw ValidationException::withMessages([
                'code' => trim($result->errorOutput()) ?: 'The JavaScript source has invalid syntax.',
            ]);
        }
    }
}
