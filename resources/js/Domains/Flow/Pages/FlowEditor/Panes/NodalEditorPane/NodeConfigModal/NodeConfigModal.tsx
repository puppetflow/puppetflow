import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { FlowRun } from '@/Domains/Flow/types';
import { formatRunStorage } from '@/Domains/Flow/Pages/FlowEditor/utils/format';
import type { CanvasNode, NodeParameterValue } from '../types';
import type { NodalAutocompleteContext } from '../utils/staticAnalysis';
import { EMPTY_OUTPUT_PORT_SET } from '../utils/node';
import ConnectedNodesRail from './components/ConnectedNodesRail/ConnectedNodesRail';
import NodeConfigHeader from './components/NodeConfigHeader/NodeConfigHeader';
import NodeParameters from './components/NodeParameters/NodeParameters';
import PreviewSection from './components/PreviewSection/PreviewSection';
import useHydratedSniffValue from './hooks/useHydratedSniffValue';
import useNodeConfigModal, { resolveNodeConfigEntry } from './hooks/useNodeConfigModal';
import useNodeLabelDraft from './hooks/useNodeLabelDraft';
import * as S from './styled';

// Last settled run loaded with its nodal preview, so reopening the modal on the same run does not
// refetch it. Active runs are never cached: their preview only exists once they finish.
let cachedPreviewRun: FlowRun | null = null;
const isSettled = (run: FlowRun) => run.status !== 'pending' && run.status !== 'running';

// Whether Before/After show the latest run's data or the static preview built from the flow
// inputs; remembered across nodes and sessions so editing inputs does not require re-toggling.
const RUN_PREVIEW_STORAGE_KEY = 'puppetflow:node-config:use-run-preview';
const readRunPreviewPreference = () => (
    typeof window === 'undefined' || window.localStorage.getItem(RUN_PREVIEW_STORAGE_KEY) !== 'false'
);

interface NodeConfigModalProps {
    node: CanvasNode;
    inputNodes?: CanvasNode[];
    outputNodes?: CanvasNode[];
    previewNodes?: Array<{ node: CanvasNode; distance: number }>;
    connectedOutputPorts?: ReadonlySet<string>;
    currentSiteUrl?: string | null;
    flowId?: Id;
    latestRun: FlowRun | null;
    autocompleteContext: NodalAutocompleteContext;
    isFinallyNode?: boolean;
    readOnly?: boolean;
    onClose: () => void;
    onUpdateValue: (nodeId: string, key: string, value: NodeParameterValue) => void;
    onRenameNode: (nodeId: string, label: string) => void;
    onNavigateNode?: (node: CanvasNode) => void;
}

function useNodalPreviewRun(flowId: Id | undefined, latestRun: FlowRun | null) {
    const [loadedRun, setLoadedRun] = useState<FlowRun | null>(() => {
        if (!latestRun) return null;
        if (latestRun.internal_meta) return latestRun;
        return cachedPreviewRun?.id === latestRun.id ? cachedPreviewRun : null;
    });
    // Run whose preview fetch failed: the static preview is shown instead of spinning forever.
    const [failedRunId, setFailedRunId] = useState<Id | null>(null);
    // Polling replaces the run object every few seconds; only a new run id, or the run settling
    // (the run detail modal shows runs while they execute), must trigger a preview fetch.
    const latestRunRef = useRef(latestRun);
    latestRunRef.current = latestRun;
    const latestRunId = latestRun?.id;
    const latestRunSettled = latestRun ? isSettled(latestRun) : false;

    useEffect(() => {
        const latestRun = latestRunRef.current;
        if (!flowId || !latestRun) {
            setLoadedRun(null);
            return;
        }
        if (latestRun.internal_meta) {
            if (isSettled(latestRun)) cachedPreviewRun = latestRun;
            setLoadedRun(latestRun);
            return;
        }
        if (cachedPreviewRun?.id === latestRun.id) {
            setLoadedRun(cachedPreviewRun);
            return;
        }

        setLoadedRun(null);
        setFailedRunId(null);
        const controller = new AbortController();
        void fetch(
            `/flows/${encodeURIComponent(String(flowId))}/runs/${latestRun.id}?include_nodal_preview=1`,
            { signal: controller.signal },
        )
            .then(response => {
                if (!response.ok) throw new Error('Nodal preview could not be loaded.');
                return response.json() as Promise<FlowRun>;
            })
            .then(run => {
                if (isSettled(run)) cachedPreviewRun = run;
                setLoadedRun(run);
            })
            .catch(error => {
                if (!(error instanceof DOMException && error.name === 'AbortError')) {
                    setLoadedRun(null);
                    setFailedRunId(latestRun.id);
                }
            });

        return () => controller.abort();
    }, [flowId, latestRunId, latestRunSettled]);

    const hasLoadedRun = loadedRun?.id === latestRun?.id;
    const loading = Boolean(
        flowId && latestRun && !hasLoadedRun && !latestRun.internal_meta && failedRunId !== latestRun.id,
    );

    return { run: hasLoadedRun ? loadedRun : latestRun, loading };
}

interface PreviewInputs {
    node: CanvasNode;
    previewNodes: Array<{ node: CanvasNode; distance: number }>;
    latestRun: FlowRun | null;
    autocompleteContext: NodalAutocompleteContext;
    isFinallyNode: boolean;
}

// Advancing to another node runs the expensive preview computation, which is a single synchronous
// pass React cannot interrupt. Debouncing the node change means a burst of Next/Previous clicks only
// commits the last target, so intermediate nodes never start that pass and each click stays snappy.
// Edits on the same node are reflected immediately, so typing keeps its previous responsiveness.
const NAVIGATION_SETTLE_MS = 180;
function useNavigationSettledPreviewInputs(inputs: PreviewInputs): PreviewInputs {
    const [settled, setSettled] = useState(inputs);
    const settledNodeId = settled.node.id;

    useEffect(() => {
        if (inputs.node.id === settledNodeId) {
            setSettled(inputs);
            return;
        }
        const timeout = setTimeout(() => setSettled(inputs), NAVIGATION_SETTLE_MS);
        return () => clearTimeout(timeout);
    }, [inputs, settledNodeId]);

    return settled;
}

export default function NodeConfigModal({
    node,
    inputNodes = [],
    outputNodes = [],
    previewNodes = [],
    connectedOutputPorts = EMPTY_OUTPUT_PORT_SET,
    currentSiteUrl = null,
    flowId,
    latestRun,
    autocompleteContext,
    isFinallyNode = false,
    readOnly,
    onClose,
    onUpdateValue,
    onRenameNode,
    onNavigateNode,
}: NodeConfigModalProps) {
    const pointerStartedOnBackdropRef = useRef(false);
    const [runPreviewPreferred, setRunPreviewPreferred] = useState(readRunPreviewPreference);
    // Read-only viewers (run details, locked flows) cannot edit inputs, so they always show the run.
    const useRunPreview = readOnly || runPreviewPreferred;
    const toggleRunPreview = () => {
        const next = !useRunPreview;
        setRunPreviewPreferred(next);
        if (typeof window !== 'undefined') window.localStorage.setItem(RUN_PREVIEW_STORAGE_KEY, String(next));
    };
    const { run: previewRun, loading: runPreviewLoading } = useNodalPreviewRun(flowId, useRunPreview ? latestRun : null);
    // Header, parameters and rails follow the edited node immediately (cheap). The preview data
    // is derived from a deferred copy of the inputs: React renders it in the background and drops
    // that render when the user navigates again, so rapid Next/Previous clicks never pile up and
    // each click moves exactly one node.
    const { entry, visibleArgs } = resolveNodeConfigEntry(node);
    const previewInputs = useMemo(
        (): PreviewInputs => ({ node, previewNodes, latestRun: previewRun, autocompleteContext, isFinallyNode }),
        [autocompleteContext, isFinallyNode, node, previewNodes, previewRun],
    );
    // Debounce coalesces rapid Next/Previous clicks; useDeferredValue then keeps the eventual heavy
    // render (tree building) at low priority so it never blocks closing or a further navigation.
    const settledPreviewInputs = useNavigationSettledPreviewInputs(previewInputs);
    const deferredPreviewInputs = useDeferredValue(settledPreviewInputs);
    // Only navigation shows spinners; edits on the same node keep the previous preview visible
    // until the recomputation lands, exactly as before.
    const previewLoading = deferredPreviewInputs.node.id !== node.id || runPreviewLoading;
    const {
        expressionOutputData,
        effectiveAutocompleteContext,
        previewSources,
        selectedPreviewSourceId,
        setSelectedPreviewSourceId,
        selectedPreviewSource,
        selectBeforeExecution,
        currentNodeAfterData,
        currentNodePreviewSource,
        currentNodeExecutions,
        currentNodeExecutionStatus,
        selectedAfterExecutionIndex,
        selectAfterExecution,
    } = useNodeConfigModal(deferredPreviewInputs);
    const { labelDraft, setLabelDraft, commitLabel, handleClose } = useNodeLabelDraft({
        node,
        entry,
        readOnly,
        onClose,
        onRenameNode,
    });
    // Network capture bodies are stored apart from the run and fetched per capture, so only
    // the displayed values are hydrated (not every execution kept in the run).
    const displayed = useMemo(() => ({
        before: selectedPreviewSource?.value,
        after: currentNodeAfterData,
        context: effectiveAutocompleteContext,
    }), [selectedPreviewSource?.value, currentNodeAfterData, effectiveAutocompleteContext]);
    const hydrated = useHydratedSniffValue(displayed, flowId, deferredPreviewInputs.latestRun?.id);
    // While the preview lags behind the edited node, expression previews that fail are reported
    // as loading rather than as errors: the context they evaluate against is not theirs yet.
    const hydratedContext = useMemo(
        (): NodalAutocompleteContext => ({
            ...hydrated.value.context,
            capturesLoading: hydrated.loading || previewLoading,
        }),
        [hydrated, previewLoading],
    );
    const previewOmitted = previewRun?.internal_meta?.nodal_preview?.omitted;

    return (
        <S.NodeConfigBackdrop
            data-modal-overlay
            data-modal-kind="node-config"
            onClick={event => {
                if (pointerStartedOnBackdropRef.current && event.target === event.currentTarget) {
                    handleClose();
                }
                pointerStartedOnBackdropRef.current = false;
            }}
            onWheel={event => event.stopPropagation()}
            onPointerDownCapture={event => {
                pointerStartedOnBackdropRef.current = event.target === event.currentTarget;
            }}
            onPointerDown={event => event.stopPropagation()}
        >
            <S.NodeConfigShell>
                <ConnectedNodesRail
                    nodes={inputNodes}
                    side="left"
                    onNavigate={onNavigateNode}
                />
                <ConnectedNodesRail
                    nodes={outputNodes}
                    side="right"
                    onNavigate={onNavigateNode}
                />
                <S.NodeConfigPanel
                    onClick={event => event.stopPropagation()}
                    onWheel={event => event.stopPropagation()}
                    onPointerDown={event => event.stopPropagation()}
                >
                    <NodeConfigHeader
                        entry={entry}
                        label={labelDraft}
                        currentSiteUrl={currentSiteUrl}
                        readOnly={readOnly}
                        onLabelChange={setLabelDraft}
                        onCommitLabel={commitLabel}
                        onClose={handleClose}
                    />
                    <S.NodeConfigBody>
                        <S.NodeConfigLayout>
                            <PreviewSection
                                title="Before"
                                loading={previewLoading}
                                value={hydrated.value.before}
                                copyValue={hydrated.value.before}
                                rootPath={selectedPreviewSource?.rootPath ?? '$run'}
                                sources={previewSources}
                                selectedSourceId={selectedPreviewSourceId}
                                onSelectSource={setSelectedPreviewSourceId}
                                executions={selectedPreviewSource?.executions}
                                executionStatus={selectedPreviewSource?.executionStatus}
                                selectedExecutionIndex={selectedPreviewSource?.executionIndex}
                                onSelectExecution={selectBeforeExecution}
                                emptyText="No static output is available. Run the flow to capture runtime data."
                                flowId={flowId}
                            />
                            <NodeParameters
                                node={node}
                                entry={entry}
                                args={visibleArgs}
                                expressionOutputData={expressionOutputData}
                                autocompleteContext={hydratedContext}
                                connectedOutputPorts={connectedOutputPorts}
                                currentSiteUrl={currentSiteUrl}
                                flowId={flowId}
                                readOnly={readOnly}
                                onUpdateValue={onUpdateValue}
                            />
                            <PreviewSection
                                title="After"
                                loading={previewLoading}
                                value={hydrated.value.after}
                                copyValue={hydrated.value.after}
                                rootPath={currentNodePreviewSource.rootPath}
                                draggable={false}
                                executions={currentNodeExecutions}
                                executionStatus={currentNodeExecutionStatus}
                                selectedExecutionIndex={selectedAfterExecutionIndex}
                                onSelectExecution={selectAfterExecution}
                                emptyText="No static output is available. Run the flow to capture runtime data."
                                flowId={flowId}
                            />
                        </S.NodeConfigLayout>
                    </S.NodeConfigBody>
                    <S.NodeConfigFooter>
                        {latestRun ? (
                            <S.PreviewSourceBanner $active={useRunPreview}>
                                <span>
                                    {previewOmitted
                                        ? `Run #${latestRun.id} produced more preview data than the ${formatRunStorage(previewOmitted.limit)} limit; showing a static preview.`
                                        : runPreviewLoading
                                            ? `Loading run #${latestRun.id} preview data…`
                                            : useRunPreview
                                                ? `Using run #${latestRun.id} as preview data.`
                                                : 'Showing a static preview built from the flow inputs.'}
                                </span>
                                {!readOnly && (
                                    <S.PreviewSourceToggle type="button" onClick={toggleRunPreview}>
                                        {useRunPreview ? 'Use static preview' : `Use run #${latestRun.id}`}
                                    </S.PreviewSourceToggle>
                                )}
                            </S.PreviewSourceBanner>
                        ) : (
                            <S.NodeConfigMeta>Showing a static preview. Run the flow to capture runtime values.</S.NodeConfigMeta>
                        )}
                        <S.NodeConfigDone type="button" onClick={handleClose}>Done</S.NodeConfigDone>
                    </S.NodeConfigFooter>
                </S.NodeConfigPanel>
            </S.NodeConfigShell>
        </S.NodeConfigBackdrop>
    );
}
