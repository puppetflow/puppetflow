<?php

namespace App\Services\Flow;

use App\Models\FlowRun;
use App\Models\FlowRunArtifact;
use App\Services\Storage\SniffBodyStore;

final class FlowRunStorageAccounting
{
    public function __construct(private readonly SniffBodyStore $sniffBodies) {}

    /**
     * @return array{
     *     recording_size_bytes: int,
     *     screenshots_size_bytes: int,
     *     downloads_size_bytes: int,
     *     sniff_bodies_size_bytes: int,
     *     flow_data_size_bytes: int,
     *     console_logs_size_bytes: int,
     *     storage_size_bytes: int
     * }
     */
    public function calculate(FlowRun $run): array
    {
        $artifactSizes = $run->artifacts()
            ->where('status', FlowRunArtifact::STATUS_READY)
            ->selectRaw("
                COALESCE(SUM(CASE
                    WHEN type = 'recording' AND relative_path = 'recording.mp4'
                    THEN size_bytes ELSE 0 END), 0) AS recording_size,
                COALESCE(SUM(CASE WHEN type = 'screenshots' THEN size_bytes ELSE 0 END), 0) AS screenshots_size,
                COALESCE(SUM(CASE WHEN type = 'downloads' THEN size_bytes ELSE 0 END), 0) AS downloads_size
            ")
            ->first();

        $recordingSize = $this->integer($artifactSizes?->getAttribute('recording_size'));
        $screenshotsSize = $this->integer($artifactSizes?->getAttribute('screenshots_size'));
        $downloadsSize = $this->integer($artifactSizes?->getAttribute('downloads_size'));
        $sniffBodiesSize = $this->sniffBodies->totalBytes($run);
        $flowDataSize = $this->jsonSize($run, 'internal_meta');
        $consoleLogsSize = $this->jsonSize($run, 'console_logs');

        return [
            'recording_size_bytes' => $recordingSize,
            'screenshots_size_bytes' => $screenshotsSize,
            'downloads_size_bytes' => $downloadsSize,
            'sniff_bodies_size_bytes' => $sniffBodiesSize,
            'flow_data_size_bytes' => $flowDataSize,
            'console_logs_size_bytes' => $consoleLogsSize,
            'storage_size_bytes' => $recordingSize
                + $screenshotsSize
                + $downloadsSize
                + $sniffBodiesSize
                + $flowDataSize
                + $consoleLogsSize,
        ];
    }

    /** Refresh counters after artifacts finish persisting, including late cancellation races. */
    public function refresh(FlowRun $run): void
    {
        $persistedRun = $run->newModelQuery()->whereKey($run->getKey())->first();
        if (! $persistedRun instanceof FlowRun) {
            return;
        }

        $sizes = $this->calculate($persistedRun);
        $persistedRun->newModelQuery()->whereKey($persistedRun->getKey())->update($sizes);
        $run->forceFill($sizes);
    }

    /**
     * Measures the JSON column as stored, without decoding it: nodal previews can
     * weigh hundreds of kilobytes and re-encoding them is what used to spike memory.
     */
    private function jsonSize(FlowRun $run, string $column): int
    {
        // `array` casts keep the encoded JSON string in the raw attributes.
        $raw = $run->getAttributes()[$column] ?? null;

        return is_string($raw) && $raw !== 'null' ? strlen($raw) : 0;
    }

    private function integer(mixed $value): int
    {
        return is_numeric($value) ? max(0, (int) $value) : 0;
    }
}
