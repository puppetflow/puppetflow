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
        $this->validateSource($code);
    }

    /**
     * @param  list<string>  $arguments
     */
    public function validateFunctionBody(string $code, array $arguments = []): void
    {
        $parameters = implode(', ', $arguments);
        $this->validateSource(
            "async function __snippet({$parameters}) {\n{$code}\n}",
            syntaxOnly: true,
        );
    }

    private function validateSource(string $code, bool $syntaxOnly = false): void
    {
        try {
            $command = ['node', $this->app->basePath('scripts/validate-flow-code.mjs')];
            if ($syntaxOnly) {
                $command[] = '--syntax-only';
            }
            $result = Process::timeout(5)
                ->input($code)
                ->run($command);
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
