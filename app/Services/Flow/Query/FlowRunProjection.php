<?php

namespace App\Services\Flow\Query;

use App\Models\Flow;
use App\Models\FlowRun;
use App\Models\User;
use App\Services\FeatureFlags\FeatureFlagService;
use App\Services\Flow\FlowRunMetadataFilter;
use Illuminate\Http\Request;

final class FlowRunProjection
{
    public function __construct(
        private readonly FlowRunMetadataFilter $metadataFilter,
        private readonly FeatureFlagService $features,
    ) {}

    /** Every run column except `internal_meta`, which is heavy and only served on demand by FlowRunController::show. */
    private const RUN_COLUMNS = [
        'id',
        'flow_id',
        'flow_version_id',
        'triggered_by',
        'trigger_id',
        'trigger_type',
        'status',
        'input',
        'output',
        'error_message',
        'console_logs',
        'action_logs',
        'code_snapshot',
        'duration_ms',
        'screenshots_count',
        'downloads_count',
        'has_recording',
        'recording_size_bytes',
        'screenshots_size_bytes',
        'downloads_size_bytes',
        'flow_data_size_bytes',
        'console_logs_size_bytes',
        'storage_size_bytes',
        'legend',
        'meta',
        'webhook_info',
        'action_results',
        'running_at',
        'cancellation_requested_at',
        'resolved_secrets',
        'runtime_wait_id',
        'runtime_validation_message',
        'runtime_waiting_at',
        'runtime_continue_requested_at',
        'runtime_consumed_wait_id',
        'runtime_consumed_at',
        'created_at',
        'updated_at',
    ];

    /** @return array{runs: mixed, stats: mixed} */
    public function get(Request $request, Flow $flow, User $user, bool $canViewRuns): array
    {
        $visibleRuns = fn () => $canViewRuns
            ? $flow->runs()
            : $flow->runs()->where('triggered_by', $user->id);

        $latestRun = $visibleRuns()->select(self::RUN_COLUMNS)
            ->with(['triggeredBy:id,name', 'trigger:id,type,label'])->latest()->first();
        $flow->setRelation('latestRun', $latestRun?->redactSecretsForClient());
        $flow->setAttribute('latest_nodal_run', $this->latestNodalRunSummary($flow, $user));

        $query = $visibleRuns()->getQuery()
            ->select(self::RUN_COLUMNS)
            ->with(['triggeredBy:id,name', 'trigger:id,type,label'])->latest();
        $from = $request->input('date_from');
        $to = $request->input('date_to');
        if ($from && $to) {
            $query->whereBetween('created_at', [$from, $to]);
        } elseif ($from) {
            $query->where('created_at', '>=', $from);
        } elseif ($to) {
            $query->where('created_at', '<=', $to);
        }
        $statuses = $request->input('statuses', []);
        if (is_array($statuses) && $statuses !== []) {
            $query->whereIn('status', array_intersect(
                $statuses,
                ['pending', 'running', 'success', 'error', 'cancelled'],
            ));
        }
        $metadataEnabled = $this->features->enabled('run_metadata_search_enabled');
        $this->metadataFilter->applyPresence($query, $metadataEnabled ? $request->input('meta_presence') : null);
        $filters = $metadataEnabled ? $request->input('meta_filters', []) : [];
        if (is_array($filters)) {
            $this->metadataFilter->applyFilters($query, $filters, $request->input('meta_predicate', 'and'));
        }
        $runs = $query->paginate(perPage: max(min($request->integer('per_page', 20), 100), 1));
        $runs->getCollection()->each(fn (FlowRun $run) => $run->redactSecretsForClient()
            ->makeVisible(['console_logs', 'action_logs', 'code_snapshot']));

        $stats = $visibleRuns()->selectRaw('count(*) as total')
            ->selectRaw("coalesce(sum(case when status = 'success' then 1 else 0 end), 0) as success")
            ->selectRaw("coalesce(sum(case when status = 'error' then 1 else 0 end), 0) as failed")
            ->selectRaw("coalesce(sum(case when status = 'cancelled' then 1 else 0 end), 0) as cancelled")
            ->selectRaw('coalesce(sum(duration_ms), 0) as total_duration_ms')->first();

        return compact('runs', 'stats');
    }

    /**
     * Latest manual run of the current user that produced nodal preview data. The nodal editor
     * only needs its identity and input/output here; `internal_meta` is fetched on demand.
     */
    private function latestNodalRunSummary(Flow $flow, User $user): ?FlowRun
    {
        $latestRun = $flow->runs()
            ->select(['id', 'flow_id', 'triggered_by', 'trigger_type', 'status', 'input', 'output', 'created_at', 'resolved_secrets'])
            ->where('trigger_type', 'manual')
            ->where('triggered_by', $user->id)
            ->whereNotNull('internal_meta')
            ->latest()
            ->first();

        return $latestRun?->redactSecretsForClient();
    }
}
