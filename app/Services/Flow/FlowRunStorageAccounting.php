<?php

namespace App\Services\Flow;

use App\Models\FlowRun;
use App\Models\FlowRunArtifact;

final class FlowRunStorageAccounting
{
    /**
     * @return array{
     *     recording_size_bytes: int,
     *     screenshots_size_bytes: int,
     *     downloads_size_bytes: int,
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
        $flowDataSize = $this->jsonSize($run->getAttribute('internal_meta'));
        $consoleLogsSize = $this->jsonSize($run->getAttribute('console_logs'));

        return [
            'recording_size_bytes' => $recordingSize,
            'screenshots_size_bytes' => $screenshotsSize,
            'downloads_size_bytes' => $downloadsSize,
            'flow_data_size_bytes' => $flowDataSize,
            'console_logs_size_bytes' => $consoleLogsSize,
            'storage_size_bytes' => $recordingSize
                + $screenshotsSize
                + $downloadsSize
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

    private function jsonSize(mixed $value): int
    {
        if ($value === null) {
            return 0;
        }

        $encoded = json_encode(
            $value,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE,
        );

        return is_string($encoded) ? strlen($encoded) : 0;
    }

    private function integer(mixed $value): int
    {
        return is_numeric($value) ? max(0, (int) $value) : 0;
    }
}
