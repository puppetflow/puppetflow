import { useEffect, useState } from 'react';
import type { FlowRun } from '@/Domains/Flow/types';
import type { CanvasNode, NodeParameterValue } from '../types';
import type { NodalAutocompleteContext } from '../utils/staticAnalysis';
import { EMPTY_OUTPUT_PORT_SET } from '../utils/node';
import ConnectedNodesRail from './components/ConnectedNodesRail/ConnectedNodesRail';
import NodeConfigHeader from './components/NodeConfigHeader/NodeConfigHeader';
import NodeParameters from './components/NodeParameters/NodeParameters';
import PreviewSection from './components/PreviewSection/PreviewSection';
import useNodeConfigModal from './hooks/useNodeConfigModal';
import * as S from './styled';

// Last run loaded with its nodal preview, so reopening the modal on the same run does not refetch it.
let cachedPreviewRun: FlowRun | null = null;

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

    useEffect(() => {
        if (!flowId || !latestRun) {
            setLoadedRun(null);
            return;
        }
        if (latestRun.internal_meta) {
            cachedPreviewRun = latestRun;
            setLoadedRun(latestRun);
            return;
        }
        if (cachedPreviewRun?.id === latestRun.id) {
            setLoadedRun(cachedPreviewRun);
            return;
        }

        setLoadedRun(null);
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
                cachedPreviewRun = run;
                setLoadedRun(run);
            })
            .catch(error => {
                if (!(error instanceof DOMException && error.name === 'AbortError')) {
                    setLoadedRun(null);
                }
            });

        return () => controller.abort();
    }, [flowId, latestRun]);

    return loadedRun?.id === latestRun?.id ? loadedRun : latestRun;
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
    const previewRun = useNodalPreviewRun(flowId, latestRun);
    const {
        entry,
        visibleArgs,
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
        labelDraft,
        setLabelDraft,
        commitLabel,
        handleClose,
    } = useNodeConfigModal({
        node,
        previewNodes,
        latestRun: previewRun,
        autocompleteContext,
        isFinallyNode,
        readOnly,
        onClose,
        onRenameNode,
    });

    return (
        <S.NodeConfigBackdrop
            data-modal-overlay
            data-modal-kind="node-config"
            onClick={handleClose}
            onWheel={event => event.stopPropagation()}
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
                                value={selectedPreviewSource?.value}
                                copyValue={selectedPreviewSource?.value}
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
                                autocompleteContext={effectiveAutocompleteContext}
                                connectedOutputPorts={connectedOutputPorts}
                                currentSiteUrl={currentSiteUrl}
                                flowId={flowId}
                                readOnly={readOnly}
                                onUpdateValue={onUpdateValue}
                            />
                            <PreviewSection
                                title="After"
                                value={currentNodeAfterData}
                                copyValue={currentNodeAfterData}
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
                        <S.NodeConfigMeta>
                            {latestRun
                                ? `Using run #${latestRun.id} as preview data.`
                                : 'Showing a static preview. Run the flow to capture runtime values.'}
                        </S.NodeConfigMeta>
                        <S.NodeConfigDone type="button" onClick={handleClose}>Done</S.NodeConfigDone>
                    </S.NodeConfigFooter>
                </S.NodeConfigPanel>
            </S.NodeConfigShell>
        </S.NodeConfigBackdrop>
    );
}
