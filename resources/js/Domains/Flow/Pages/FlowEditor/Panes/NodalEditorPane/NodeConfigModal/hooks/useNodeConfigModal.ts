import { useEffect, useMemo, useState } from 'react';
import type { FlowRun } from '@/Domains/Flow/types';
import type { CanvasNode } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import type { NodalAutocompleteContext } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/staticAnalysis';
import {
    formatEntryLabel,
    getEntryByName,
    getNodeCategoryColor,
    getNodeIcon,
    getSignatureArgs,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/catalog';
import {
    getLoopParameterKeysForMode,
    LOOP_NODE_NAME,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/constants';
import { normalizeScalarParameterValue } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/expression';
import {
    createEffectiveAutocompleteContext,
    createExpressionOutputData,
    createStaticNodeAfterData,
    mergeOutputContextPreview,
    nodeStateLabel,
    resolveSniffCallbackValue,
} from '../utils/preview';
import { asRecord } from '../utils/values';
import type {
    PreviewExecution,
    PreviewExecutionStatus,
} from '../components/PreviewSection/PreviewSection';

const executionLoopIndex = (value: unknown) => {
    const loop = asRecord(asRecord(value)?.$loop);
    return typeof loop?.index === 'number' ? loop.index : undefined;
};

const executionDetail = (value: unknown): { detail?: string; detailBadge?: string } => {
    const loopIndex = executionLoopIndex(value);
    if (loopIndex !== undefined) {
        return { detail: `Loop index ${loopIndex}` };
    }

    const state = asRecord(value);
    const capture = asRecord(state?.$capture);
    const request = asRecord(capture?.request);
    if (typeof request?.url === 'string') {
        return {
            detail: request.url,
            detailBadge: typeof request.method === 'string' ? request.method.toUpperCase() : undefined,
        };
    }

    return {};
};

const normalizeExecutionStatus = (
    values: unknown,
    metadata: unknown,
): PreviewExecutionStatus => {
    const retained = Array.isArray(values) ? values.length : 0;
    const meta = asRecord(metadata);
    const total = typeof meta?.total === 'number' ? meta.total : retained;
    const dropped = typeof meta?.dropped === 'number'
        ? meta.dropped
        : Math.max(0, total - retained);
    const dropReason = meta?.reason === 'count' || meta?.reason === 'size'
        ? meta.reason
        : 'history';

    return { total, dropped, dropReason };
};

const normalizeExecutions = (
    values: unknown,
    status: PreviewExecutionStatus,
): PreviewExecution[] => {
    if (!Array.isArray(values) || values.length === 0) return [];

    return values.map((value, index) => {
        const detail = executionDetail(value);

        return {
            value,
            ordinal: status.dropped + index + 1,
            ...status,
            ...detail,
            loopIndex: executionLoopIndex(value),
        };
    });
};

const withoutLoopContext = (value: unknown): unknown => {
    const state = asRecord(value);
    if (!state || !Object.prototype.hasOwnProperty.call(state, '$loop')) return value;

    const { $loop: _loop, ...rest } = state;
    return rest;
};

interface UseNodeConfigModalOptions {
    node: CanvasNode;
    previewNodes: Array<{ node: CanvasNode; distance: number }>;
    latestRun: FlowRun | null;
    autocompleteContext: NodalAutocompleteContext;
    isFinallyNode: boolean;
    readOnly?: boolean;
    onClose: () => void;
    onRenameNode: (nodeId: string, label: string) => void;
}

// Builds and validates the editable node configuration used by NodeConfigModal.
export default function useNodeConfigModal({
    node,
    previewNodes,
    latestRun,
    autocompleteContext,
    isFinallyNode,
    readOnly,
    onClose,
    onRenameNode,
}: UseNodeConfigModalOptions) {
    const catalogEntry = node.system ? node.entry : getEntryByName(node.entry.name);
    const entry = !node.system && catalogEntry.category === 'Custom' ? node.entry : catalogEntry;
    const args = getSignatureArgs(entry.signature);
    const nodalPreviewData = asRecord(latestRun?.internal_meta?.nodal_preview);
    const nodalPreviewNodes = asRecord(nodalPreviewData?.nodes);
    const nodalPreviewExecutions = asRecord(nodalPreviewData?.executions);
    const nodalPreviewExecutionMeta = asRecord(nodalPreviewData?.executionMeta);
    const staticPreviewNodes = asRecord(autocompleteContext.nodeData);
    const nodalPreviewRunData = asRecord(nodalPreviewNodes?.RUN);
    const nodalPreviewInputData = asRecord(nodalPreviewRunData?.$input);
    const nodalPreviewOutputData = asRecord(nodalPreviewRunData?.$output);
    const latestInputData = asRecord(latestRun?.input);
    const latestInputContextData = asRecord(latestInputData?.$context);
    const latestRunOutput = asRecord(latestRun?.output);
    const latestOutputContextData = asRecord(latestRunOutput?.$context);
    const latestOutputInputData = asRecord(latestRunOutput?.$input);
    const outputContextPreview = useMemo(
        () => mergeOutputContextPreview(
            latestInputContextData,
            autocompleteContext.contextData,
            latestOutputContextData,
        ),
        [autocompleteContext.contextData, latestInputContextData, latestOutputContextData],
    );
    const runPreview = useMemo(
        () => ({ ...(autocompleteContext.runData ?? {}), ...(nodalPreviewRunData ?? {}) }),
        [autocompleteContext.runData, nodalPreviewRunData],
    );
    const runNodePreview = useMemo(() => ({
        $input: runPreview.$input ?? autocompleteContext.inputData ?? {},
        $output: runPreview.$output ?? autocompleteContext.outputData ?? {},
        $context: runPreview.$context ?? outputContextPreview,
    }), [
        autocompleteContext.inputData,
        autocompleteContext.outputData,
        outputContextPreview,
        runPreview,
    ]);
    const expressionOutputData = useMemo(
        () => createExpressionOutputData(
            latestRun,
            asRecord(autocompleteContext.outputData),
            nodalPreviewOutputData,
            isFinallyNode,
        ),
        [autocompleteContext.outputData, isFinallyNode, latestRun, nodalPreviewOutputData],
    );
    const nodeDisplay = (sourceNode: CanvasNode) => {
        const sourceEntry = sourceNode.system ? sourceNode.entry : getEntryByName(sourceNode.entry.name);
        return {
            label: nodeStateLabel(sourceNode),
            icon: getNodeIcon(sourceEntry),
            iconColor: getNodeCategoryColor(sourceEntry),
        };
    };
    const captureContextPreview = asRecord(autocompleteContext.runData?.$capture);
    const currentNodeCapturePreview = asRecord(asRecord(nodalPreviewNodes?.[node.id])?.$capture);
    const [beforeExecutionIndexBySourceId, setBeforeExecutionIndexBySourceId] = useState<Record<string, number>>({});
    const [afterExecutionIndex, setAfterExecutionIndex] = useState<number | null>(null);

    useEffect(() => {
        setBeforeExecutionIndexBySourceId({});
        setAfterExecutionIndex(null);
    }, [latestRun?.id, node.id]);

    const previewSources = useMemo(() => previewNodes.map(({ node: sourceNode, distance }) => {
        const display = nodeDisplay(sourceNode);
        const isRun = sourceNode.system === 'run';
        const hasRuntimeValue = Boolean(
            nodalPreviewNodes
            && Object.prototype.hasOwnProperty.call(nodalPreviewNodes, sourceNode.id),
        );
        const staticValue = staticPreviewNodes?.[sourceNode.id];
        const runtimeValue = nodalPreviewNodes?.[sourceNode.id];
        const executionStatus = normalizeExecutionStatus(
            nodalPreviewExecutions?.[sourceNode.id],
            nodalPreviewExecutionMeta?.[sourceNode.id],
        );
        const executions = normalizeExecutions(
            nodalPreviewExecutions?.[sourceNode.id],
            executionStatus,
        );
        const exposesLoopContext = distance === 1 && sourceNode.entry.name === LOOP_NODE_NAME;
        const callbackValue = resolveSniffCallbackValue({
            sourceNode,
            staticValue,
            runtimeValue,
            fallbackBase: runNodePreview,
            captureContextPreview,
            currentNodeCapture: currentNodeCapturePreview,
        });
        const fallbackValue = isRun
            ? runNodePreview
            : callbackValue ?? (hasRuntimeValue ? runtimeValue : staticValue);
        const visible = (state: unknown) => (exposesLoopContext ? state : withoutLoopContext(state));
        const executionIndex = executions.length > 1
            ? Math.min(
                Math.max(0, beforeExecutionIndexBySourceId[sourceNode.id] ?? executions.length - 1),
                executions.length - 1,
            )
            : 0;
        const value = visible(executions[executionIndex]?.value ?? fallbackValue);
        const latestValue = visible(executions.at(-1)?.value ?? fallbackValue);

        return {
            id: sourceNode.id,
            ...display,
            detail: `${distance} node${distance === 1 ? '' : 's'} back`,
            rootPath: distance === 1 ? '$run' : `$(${JSON.stringify(display.label)})`,
            value,
            latestValue,
            executions,
            executionStatus,
            executionIndex,
        };
    }), [
        beforeExecutionIndexBySourceId,
        captureContextPreview,
        currentNodeCapturePreview,
        nodalPreviewExecutionMeta,
        nodalPreviewExecutions,
        nodalPreviewNodes,
        previewNodes,
        runNodePreview,
        staticPreviewNodes,
    ]);
    const [selectedPreviewSourceId, setSelectedPreviewSourceId] = useState('');
    const defaultPreviewSourceId = previewSources[0]?.id ?? '';
    useEffect(() => {
        setSelectedPreviewSourceId(defaultPreviewSourceId);
    }, [defaultPreviewSourceId, node.id]);
    const selectedPreviewSource = previewSources.find(source => source.id === selectedPreviewSourceId)
        ?? previewSources[0];
    const currentNodeDisplay = nodeDisplay(node);
    const currentNodePreviewSource = {
        id: node.id,
        ...currentNodeDisplay,
        rootPath: `$(${JSON.stringify(currentNodeDisplay.label)})`,
    };
    const staticCurrentNodeAfterData = useMemo(() => createStaticNodeAfterData({
        node,
        entry,
        inputPreview: asRecord(runNodePreview.$input) ?? {},
        outputPreview: runNodePreview.$output,
        contextPreview: asRecord(runNodePreview.$context) ?? {},
        nodeData: autocompleteContext.nodeData,
    }), [autocompleteContext.nodeData, entry, node, runNodePreview]);
    const hasCurrentNodeRuntimeValue = Boolean(
        nodalPreviewNodes
        && Object.prototype.hasOwnProperty.call(nodalPreviewNodes, node.id),
    );
    const currentNodeExecutionStatus = normalizeExecutionStatus(
        nodalPreviewExecutions?.[node.id],
        nodalPreviewExecutionMeta?.[node.id],
    );
    const currentNodeExecutions = normalizeExecutions(
        nodalPreviewExecutions?.[node.id],
        currentNodeExecutionStatus,
    );
    const selectedAfterExecutionIndex = currentNodeExecutions.length > 1
        ? Math.min(
            Math.max(0, afterExecutionIndex ?? currentNodeExecutions.length - 1),
            currentNodeExecutions.length - 1,
        )
        : 0;
    const selectBeforeExecution = (index: number) => {
        if (!selectedPreviewSource) return;
        setBeforeExecutionIndexBySourceId(current => ({
            ...current,
            [selectedPreviewSource.id]: index,
        }));

        const loopIndex = selectedPreviewSource.executions[index]?.loopIndex;
        if (loopIndex === undefined) return;
        const matchingAfterIndex = currentNodeExecutions.findIndex(execution => execution.loopIndex === loopIndex);
        if (matchingAfterIndex >= 0) setAfterExecutionIndex(matchingAfterIndex);
    };
    const selectAfterExecution = (index: number) => {
        setAfterExecutionIndex(index);
        if (!selectedPreviewSource) return;

        const loopIndex = currentNodeExecutions[index]?.loopIndex;
        if (loopIndex === undefined) return;
        const matchingBeforeIndex = selectedPreviewSource.executions.findIndex(
            execution => execution.loopIndex === loopIndex,
        );
        if (matchingBeforeIndex < 0) return;
        setBeforeExecutionIndexBySourceId(current => ({
            ...current,
            [selectedPreviewSource.id]: matchingBeforeIndex,
        }));
    };
    const rawCurrentNodeAfterData = node.system === 'run'
        ? runNodePreview
        : currentNodeExecutions[selectedAfterExecutionIndex]?.value
            ?? (hasCurrentNodeRuntimeValue ? nodalPreviewNodes?.[node.id] : staticCurrentNodeAfterData);
    // Memoized so the "After" inspector keeps its expand/collapse state across re-renders.
    const currentNodeAfterData = useMemo(
        () => entry.name === LOOP_NODE_NAME
            ? rawCurrentNodeAfterData
            : withoutLoopContext(rawCurrentNodeAfterData),
        [entry.name, rawCurrentNodeAfterData],
    );
    const targetedRunPreview = asRecord(previewSources[0]?.value) ?? runPreview;
    const targetedNodePreviewData = useMemo(() => ({
        ...(nodalPreviewNodes ?? {}),
        ...Object.fromEntries(previewSources.map(source => [source.id, source.value])),
    }), [nodalPreviewNodes, previewSources]);
    const targetedCapturePreview = asRecord(targetedRunPreview.$capture) ?? currentNodeCapturePreview;
    const loopMode = entry.name === LOOP_NODE_NAME
        ? normalizeScalarParameterValue(node.values.mode).value || 'items'
        : null;
    const effectiveAutocompleteContext = useMemo(
        () => createEffectiveAutocompleteContext({
            autocompleteContext,
            latestInput: latestInputData,
            latestOutputInput: latestOutputInputData,
            nodalPreviewInput: nodalPreviewInputData,
            runPreview: targetedRunPreview,
            outputContextPreview,
            nodePreviewData: targetedNodePreviewData,
            currentNodeCapture: targetedCapturePreview,
            previewNodes,
            entryName: entry.name,
            loopMode,
        }),
        [
            autocompleteContext,
            entry.name,
            latestInputData,
            latestOutputInputData,
            loopMode,
            nodalPreviewInputData,
            outputContextPreview,
            previewNodes,
            targetedCapturePreview,
            targetedNodePreviewData,
            targetedRunPreview,
        ],
    );
    const defaultNodeLabel = formatEntryLabel(entry);
    const [labelDraft, setLabelDraft] = useState(node.label?.trim() || defaultNodeLabel);
    const visibleArgs = entry.name === LOOP_NODE_NAME
        ? args.filter(arg => getLoopParameterKeysForMode(loopMode ?? 'items').includes(
            arg.replace(/\?$/, '').replace(/^\.\.\./, ''),
        ))
        : args;

    useEffect(() => {
        setLabelDraft(node.label?.trim() || defaultNodeLabel);
    }, [defaultNodeLabel, node.id, node.label]);

    const commitLabel = () => {
        onRenameNode(node.id, labelDraft);
        setLabelDraft(labelDraft.trim() || defaultNodeLabel);
    };
    const handleClose = () => {
        const currentLabel = node.label?.trim() || defaultNodeLabel;
        if (!readOnly && labelDraft.trim() !== currentLabel) {
            onRenameNode(node.id, labelDraft);
        }
        onClose();
    };

    return {
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
    };
}
