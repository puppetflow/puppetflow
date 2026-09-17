<?php

namespace App\Services\Storage;

use App\Models\FlowRun;
use Illuminate\Support\Facades\DB;

/**
 * Network capture bodies are kept out of the run metadata: the runtime spills each one
 * to a pod-local temporary file and this store moves them, redacted, into the database
 * right after the process ends. Rows are removed with their run through the foreign key.
 */
final class SniffBodyStore
{
    public const TABLE = 'flow_run_sniff_bodies';

    /**
     * Imports the spilled bodies found in $directory one at a time, then removes every file.
     * Only bodies referenced by the nodal preview JSON are kept: the preview truncates execution
     * history, so captures it dropped would never be displayed (no preview keeps no body).
     */
    public function ingest(FlowRun $run, string $directory, ?string $previewJson): void
    {
        preg_match_all('/"captureId":\s*"([a-f0-9]{32})"/', $previewJson ?? '', $matches);
        $referenced = array_fill_keys($matches[1], true);
        foreach (glob("{$directory}/*.body") ?: [] as $path) {
            $captureId = basename($path, '.body');
            $raw = isset($referenced[$captureId]) && is_file($path) && ! is_link($path) ? file_get_contents($path) : false;
            if (is_string($raw)) {
                $content = $run->redactResolvedSecrets(str_replace("\0", '', $raw));
                DB::table(self::TABLE)->upsert([[
                    'flow_run_id' => $run->getKey(),
                    'capture_id' => $captureId,
                    'content' => is_string($content) ? $content : FlowRun::REDACTION_UNAVAILABLE,
                    'created_at' => now(),
                ]], ['flow_run_id', 'capture_id'], ['content']);
            }
            @unlink($path);
        }
    }

    public function read(FlowRun $run, string $captureId): ?string
    {
        $content = DB::table(self::TABLE)
            ->where('flow_run_id', $run->getKey())
            ->where('capture_id', $captureId)
            ->value('content');

        return is_string($content) ? $content : null;
    }

    public function totalBytes(FlowRun $run): int
    {
        return (int) DB::table(self::TABLE)->where('flow_run_id', $run->getKey())->sum(DB::raw('length(content)'));
    }
}
