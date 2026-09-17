<?php

/*
 * Explicit proprietary scope: licensed run retention limits implement paid Puppetflow features and are licensed
 * under the Puppetflow Proprietary License. See LICENSE_PROPRIETARY.md.
 */

namespace App\Services\Flow;

use App\Models\Flow;
use App\Models\FlowRun;
use Illuminate\Support\Facades\Log;

final class FlowRunRetentionService
{
    public function __construct(
        private readonly ArtifactCleanupService $artifactCleanup,
    ) {}

    public function enforce(Flow $flow): void
    {
        try {
            $limit = $flow->getEffectiveRetentionLimit();
            if ($limit <= 0) {
                return;
            }

            $completedRuns = $flow->runs()->whereNotIn('status', ['pending', 'running']);
            $totalRuns = (clone $completedRuns)->count();
            if ($totalRuns <= $limit) {
                return;
            }

            /** @var \Illuminate\Database\Eloquent\Collection<int, FlowRun> $runsToDelete */
            $runsToDelete = $completedRuns
                ->select(['id', 'flow_id', 'status'])
                ->orderByDesc('created_at')
                ->skip($limit)
                ->take($totalRuns - $limit)
                ->get();

            $this->artifactCleanup->deleteRuns($runsToDelete);
            if ($runsToDelete->isNotEmpty()) {
                Log::info(
                    "Retention cleanup: deleted {$runsToDelete->count()} run(s) for flow \"{$flow->name}\" (limit: {$limit})"
                );
            }
        } catch (\Throwable $exception) {
            Log::warning("Retention cleanup failed for flow {$flow->id}: {$exception->getMessage()}");
        }
    }
}
