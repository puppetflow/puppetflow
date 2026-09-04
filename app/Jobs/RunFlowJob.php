<?php

/*
 * Explicit proprietary scope: the licensed run-cycle enforcement and replay exposure in this file implement paid
 * Puppetflow features and are licensed under the Puppetflow Proprietary License.
 * See LICENSE_PROPRIETARY.md.
 */

namespace App\Jobs;

use App\Exceptions\FeatureFlags\RunQuotaExceededException;
use App\Exceptions\Licensing\LicenseRuntimeLockedException;
use App\Models\Flow;
use App\Models\FlowRun;
use App\Services\Flow\FlowRunnerService;
use App\Services\Flow\FlowRunTerminalizer;
use App\Services\Variable\UnresolvedVariableException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class RunFlowJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries;

    public int $timeout;

    public function __construct(
        public FlowRun $run
    ) {
        $flow = $this->flowFor($run);
        $this->timeout = $flow->getEffectiveTimeoutSeconds() + 30;
        $this->tries = $flow->getEffectiveMaxRetries() + 1;
    }

    /** Run currently being processed by this worker process, if any (see shutdown guard). */
    private static mixed $activeRunId = null;

    private static bool $shutdownGuardRegistered = false;

    public function handle(FlowRunnerService $runner, FlowRunTerminalizer $terminalizer): void
    {
        $runId = $this->run->getKey();
        self::$activeRunId = $runId;
        self::registerShutdownGuard();

        try {
            $runner->process($this->run);
            $persistedStatus = $this->run->newModelQuery()
                ->whereKey($runId)
                ->value('status');
            if ($persistedStatus === 'running') {
                $terminalizer->failInterruptedRun(
                    $this->run,
                    'Run processing returned without reporting a terminal status.',
                );
            }
        } catch (
            LicenseRuntimeLockedException
            |RunQuotaExceededException
            |UnresolvedVariableException
            |AuthorizationException $e
        ) {
            $terminalizer->failQueuedRun($this->run, $e);
            $this->delete();
        } finally {
            self::$activeRunId = null;
        }
    }

    /**
     * Registered once per worker process: if the process exits while a run is still being
     * processed (timeout kill, fatal error), the run must not stay "running" forever.
     */
    private static function registerShutdownGuard(): void
    {
        if (self::$shutdownGuardRegistered) {
            return;
        }
        self::$shutdownGuardRegistered = true;

        register_shutdown_function(static function (): void {
            if (self::$activeRunId === null) {
                return;
            }

            try {
                $run = FlowRun::query()->find(self::$activeRunId);
                if ($run instanceof FlowRun && $run->status === 'running') {
                    $terminalized = app(FlowRunTerminalizer::class)->failInterruptedRun(
                        $run,
                        'Run worker stopped before reporting a terminal status.',
                    );
                    if ($terminalized) {
                        Log::error('Flow run terminalized by worker shutdown guard.', [
                            'flow_id' => $run->flow_id,
                            'run_id' => $run->id,
                        ]);
                    }
                }
            } catch (\Throwable $exception) {
                report($exception);
            }
        });
    }

    public function failed(?\Throwable $exception): void
    {
        app(FlowRunTerminalizer::class)->failQueuedRun($this->run, $exception);
    }

    private function flowFor(FlowRun $run): Flow
    {
        $flow = $run->flow;

        if (! $flow instanceof Flow) {
            throw new \LogicException('Flow run is missing its flow.');
        }

        return $flow;
    }
}
