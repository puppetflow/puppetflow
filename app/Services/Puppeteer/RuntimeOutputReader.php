<?php

namespace App\Services\Puppeteer;

use App\Models\Flow;
use App\Models\FlowRun;
use Illuminate\Contracts\Process\ProcessResult;
use Illuminate\Support\Facades\Log;

final class RuntimeOutputReader
{
    public function __construct(private readonly RuntimeSecretManager $secrets) {}

    /** @return array<array-key, mixed>|null */
    public function output(string $path): ?array
    {
        return $this->decode($this->consume($path));
    }

    /**
     * The internal output (nodal previews) is produced by the runtime without a hard size
     * guarantee, so it is read with a byte ceiling to keep the worker's memory bounded. An
     * oversized preview is replaced by a marker the editor surfaces instead of silently vanishing.
     *
     * @return array<array-key, mixed>|null
     */
    public function internalOutput(string $path): ?array
    {
        $maxBytes = $this->internalOutputMaxBytes();
        $json = $this->consume($path, $maxBytes + 1);
        if ($json !== null && strlen($json) > $maxBytes) {
            Log::warning('Runtime internal output omitted because it exceeded its byte limit.', ['limit' => $maxBytes]);

            return ['nodal_preview' => ['omitted' => ['reason' => 'size', 'limit' => $maxBytes]]];
        }

        return $this->decode($json);
    }

    /** Raw internal output left in place for internalOutput(); null when missing or above the ceiling. */
    public function peekInternalOutput(string $path): ?string
    {
        $maxBytes = $this->internalOutputMaxBytes();
        $json = $this->read($path, $maxBytes + 1);

        return $json !== null && strlen($json) <= $maxBytes ? $json : null;
    }

    /** @return positive-int */
    private function internalOutputMaxBytes(): int
    {
        return max(1, config()->integer('puppetflow.runner_internal_output_max_bytes'));
    }

    /** @param  positive-int|null  $length */
    private function read(string $path, ?int $length = null): ?string
    {
        if (! file_exists($path)) {
            return null;
        }
        $json = $length === null ? file_get_contents($path) : file_get_contents($path, length: $length);

        return is_string($json) ? $json : null;
    }

    /**
     * Reads a runtime output file (up to $length bytes) and removes it.
     *
     * @param  positive-int|null  $length
     */
    private function consume(string $path, ?int $length = null): ?string
    {
        $json = $this->read($path, $length);
        @unlink($path);

        return $json;
    }

    /** @return array<array-key, mixed>|null */
    private function decode(?string $json): ?array
    {
        $decoded = $json === null ? null : json_decode($json, true);

        return is_array($decoded) ? $decoded : null;
    }

    /** @return array<int, array{level: string, message: string, ts: string}>|null */
    public function actionLogs(string $path): ?array
    {
        $logs = $this->output($path);

        /** @var array<int, array{level: string, message: string, ts: string}>|null $logs */
        return $logs;
    }

    /** @return list<array{message_id: int, claim_token: string}> */
    public function mailboxClaims(string $path): array
    {
        if (! file_exists($path) || ! is_string($content = file_get_contents($path)) || $content === '') {
            return [];
        }
        $claims = [];
        foreach (explode("\n", $content) as $line) {
            $claim = $line !== '' ? json_decode($line, true) : null;
            $messageId = is_array($claim) ? ($claim['message_id'] ?? null) : null;
            $token = is_array($claim) ? ($claim['claim_token'] ?? null) : null;
            if (
                is_numeric($messageId)
                && (int) $messageId > 0
                && is_string($token)
                && strlen($token) === 64
                && ctype_xdigit($token)
            ) {
                $claims[(int) $messageId] = [
                    'message_id' => (int) $messageId,
                    'claim_token' => $token,
                ];
            }
        }

        return array_values($claims);
    }

    /** @param array<string, string> $files */
    public function throwProcessFailure(ProcessResult $process, array $files, string $tag, FlowRun $run): never
    {
        @unlink($files['output']);
        $stderr = $this->secrets->redact($run, $process->errorOutput());
        $stdout = $this->secrets->redact($run, $process->output());
        Log::error("{$tag} Process exited with error", [
            'exit_code' => $process->exitCode(),
            'stderr' => $stderr,
            'stdout_tail' => substr($stdout ?? '', -1000),
        ]);

        $errorData = $this->error($files['error']);
        $simplified = $errorData['simplified'] ?? null;
        $stack = $errorData['fullstack'] ?? null;
        $userError = $this->secrets->redact($run, is_string($simplified) ? $simplified : null);
        $fullstack = $this->secrets->redact($run, is_string($stack) ? $stack : null);
        Log::error("{$tag} Error details", [
            'error_file_exists' => file_exists($files['error']),
            'user_error' => $userError,
            'fullstack' => $fullstack,
            'thrown_message' => $userError ?: 'Puppeteer run failed: '.$stderr,
        ]);
        @unlink($files['error']);

        throw new \RuntimeException($userError ?: 'Puppeteer run failed: '.$stderr);
    }

    /**
     * @param  array<string, string>  $files
     * @return array<array-key, mixed>
     */
    public function successfulOutput(Flow $flow, FlowRun $run, ProcessResult $process, array $files): array
    {
        @unlink($files['error']);
        $rawOutput = trim($this->secrets->redact($run, $process->output()) ?? '');
        $structured = $this->output($files['output']);
        $response = is_array($structured) ? $structured : [];
        if ($flow->include_raw_output && $rawOutput !== '') {
            $response['$raw_output'] = $rawOutput;
        }

        return $response ?: ($flow->include_raw_output ? ['$raw_output' => $rawOutput] : []);
    }

    /** @return array<string, mixed>|null */
    private function error(string $path): ?array
    {
        if (! file_exists($path) || ($raw = file_get_contents($path)) === false) {
            return null;
        }
        $decoded = json_decode(trim($raw), true);

        if (! is_array($decoded)) {
            return null;
        }

        /** @var array<string, mixed> $decoded */
        return $decoded;
    }
}
