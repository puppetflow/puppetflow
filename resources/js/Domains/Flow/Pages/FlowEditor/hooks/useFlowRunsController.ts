import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { router } from '@inertiajs/react';
import { useInertiaPolling } from '@/Shared/Hooks/useInertiaPolling';
import type { useToast } from '@/App/Hooks/useToast';
import type { FlowRun } from '@/Domains/Flow/types';
import type { FlowEditorProps } from '@/Domains/Flow/Pages/FlowEditor/types';
import type { NodalGraph } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import { useOptimisticRunCancellation } from '@/Domains/Flow/Hooks/Run/useOptimisticRunCancellation';
import { useFlowRunActions } from './useFlowRunActions';
import { useRunDetailUrlState } from './useRunDetailUrlState';

type ToastFn = ReturnType<typeof useToast>['toast'];

// Identifies the listed run state that the flow's latest run summary has not caught up with.
function getStaleLatestRunKey(runs: FlowRun[], latestRun: FlowRun | null): string | null {
    const staleRun = runs.find(run => !latestRun || run.id > latestRun.id)
        ?? runs.find(run => run.id === latestRun?.id && run.status !== latestRun.status);

    return staleRun ? `${staleRun.id}:${staleRun.status}` : null;
}

interface UseFlowRunsControllerOptions {
    flowId: Id;
    latestRun: FlowRun | null;
    runs: FlowEditorProps['runs'];
    myManualInput: Record<string, unknown> | null;
    saved: boolean;
    code: string;
    isNodalFlow: boolean;
    codeReadOnly: boolean;
    nodalGraphRef: MutableRefObject<NodalGraph>;
    pendingRunOpenRef: MutableRefObject<boolean>;
    toast: ToastFn;
    setRunning: (running: boolean) => void;
    flushDraft: (force?: boolean) => Promise<boolean>;
}

// Maintains the editor's run list, polling state, selection, and detail view.
export function useFlowRunsController({
    flowId,
    latestRun,
    runs,
    myManualInput,
    saved,
    code,
    isNodalFlow,
    codeReadOnly,
    nodalGraphRef,
    pendingRunOpenRef,
    toast,
    setRunning,
    flushDraft,
}: UseFlowRunsControllerOptions) {
    const {
        displayedRuns: displayedRunData,
        markRunCancelled,
        rollbackRunCancellation,
    } = useOptimisticRunCancellation(runs.data);
    const displayedRuns = {
        ...runs,
        data: displayedRunData,
    };
    const handleRunDetailLoadError = useCallback(
        () => toast('Unable to load run details'),
        [toast],
    );

    const {
        detailRun,
        handleViewRunDetails,
        handleCloseRunDetail,
    } = useRunDetailUrlState(
        flowId,
        displayedRuns.data,
        pendingRunOpenRef,
        handleRunDetailLoadError,
    );
    const hasActiveRuns = runs.data.some(
        run => run.status === 'pending' || run.status === 'running',
    );
    useInertiaPolling({
        only: hasActiveRuns ? ['runs', 'flow'] : ['runs'],
        active: hasActiveRuns,
        activeDelay: 3000,
        idleDelay: 10000,
        pauseWhenHidden: true,
        // The tab title follows the active run status from another tab.
        hiddenOnly: hasActiveRuns ? ['runs'] : null,
    });
    // Idle and hidden-tab polls only refresh `runs`, so a run that starts and ends between
    // two active polls would leave `flow.latest_run` stale.
    const staleLatestRunKey = getStaleLatestRunKey(runs.data, latestRun);
    const requestedLatestRunKeyRef = useRef<string | null>(null);
    useEffect(() => {
        if (!staleLatestRunKey || requestedLatestRunKeyRef.current === staleLatestRunKey) return;
        requestedLatestRunKeyRef.current = staleLatestRunKey;
        router.reload({ only: ['flow'], preserveUrl: true });
    }, [staleLatestRunKey]);
    const actions = useFlowRunActions({
        flowId,
        myManualInput,
        saved,
        code,
        isNodalFlow,
        codeReadOnly,
        nodalGraphRef,
        pendingRunOpenRef,
        toast,
        setRunning,
        flushDraft,
        onRunCancellationStarted: markRunCancelled,
        onRunCancellationFailed: rollbackRunCancellation,
    });

    return {
        runs: displayedRuns,
        showRunModal: actions.showRunModal,
        runInitialInput: actions.runInitialInput,
        rerunCodeSnapshot: actions.rerunCodeSnapshot,
        rerunData: actions.rerunData,
        detailRun,
        showSaveBeforeRun: actions.showSaveBeforeRun,
        clearing: actions.clearing,
        showClearModal: actions.showClearModal,
        openRunModal: actions.openRunModal,
        closeRunModal: actions.closeRunModal,
        closeSaveBeforeRun: actions.closeSaveBeforeRun,
        openClearModal: actions.openClearModal,
        closeClearModal: actions.closeClearModal,
        handleRunFromModal: actions.handleRunFromModal,
        handleSaveInput: actions.handleSaveInput,
        handleSaveAndRun: actions.handleSaveAndRun,
        handleRunWithoutSaving: actions.handleRunWithoutSaving,
        handleRerunFromDetail: actions.handleRerunFromDetail,
        handleViewRunDetails,
        handleCloseRunDetail,
        handleClearAllRuns: actions.handleClearAllRuns,
        handleDeleteSelectedRuns: actions.handleDeleteSelectedRuns,
        handleKillRun: actions.handleKillRun,
    };
}
