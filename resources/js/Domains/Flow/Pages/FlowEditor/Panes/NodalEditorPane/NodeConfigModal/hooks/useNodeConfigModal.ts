import { useEffect, useMemo, useState } from 'react';
import type { FlowRun } from '@/Domains/Flow/types';
import type { CanvasNode } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import type { NodalAutocompleteContext } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/staticAnalysis';
import {
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
    expandNodalPreview,
    mergeOutputContextPreview,
    nodeStateLabel,
    previewParameterValue,
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
            // The runtime keeps the first executions, so retained snapshots are always a prefix.
            ordinal: index + 1,
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

/** Catalog entry and visible parameters of a node; cheap, so both the header and the preview data can derive it. */
export const resolveNodeConfigEntry = (node: CanvasNode) => {
    const catalogEntry = node.system ? node.entry : getEntryByName(node.entry.name);
    const entry = !node.system && catalogEntry.category === 'Custom' ? node.entry : catalogEntry;
    const args = getSignatureArgs(entry.signature);
    const loopMode = entry.name === LOOP_NODE_NAME
        ? normalizeScalarParameterValue(node.values.mode).value || 'items'
        : null;
    const visibleArgs = entry.name === LOOP_NODE_NAME
        ? args.filter(arg => getLoopParameterKeysForMode(loopMode ?? 'items').includes(
            arg.replace(/\?$/, '').replace(/^\.\.\./, ''),
        ))
        : args;

    return { entry, loopMode, visibleArgs };
};

interface UseNodeConfigModalOptions {
    node: CanvasNode;
    previewNodes: Array<{ node: CanvasNode; distance: number }>;
    latestRun: FlowRun | null;
    autocompleteContext: NodalAutocompleteContext;
    isFinallyNode: boolean;
}

/**
 * Builds the Before/After preview data and the effective autocomplete context of a node.
 * This is the expensive part of the modal: NodeConfigModal feeds it deferred inputs so the
 * work runs in an interruptible background render instead of blocking the navigation click.
 */
export default function useNodeConfigModal({
    node,
    previewNodes,
    latestRun,
    autocompleteContext,
    isFinallyNode,
}: UseNodeConfigModalOptions) {
    const { entry, loopMode } = resolveNodeConfigEntry(node);
    const rawNodalPreview = latestRun?.internal_meta?.nodal_preview;
    const nodalPreviewData = useMemo(() => expandNodalPreview(rawNodalPreview), [rawNodalPreview]);
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
    const insideLoopBody = autocompleteContext.runData?.$loop !== undefined;
    const currentNodeCapturePreview = asRecord(asRecord(nodalPreviewNodes?.[node.id])?.$capture);
    const [beforeExecutionIndexBySourceId, setBeforeExecutionIndexBySourceId] = useState<Record<string, number>>({});
    const [afterExecutionIndex, setAfterExecutionIndex] = useState<number | null>(null);

    useEffect(() => {
        setBeforeExecutionIndexBySourceId({});
        setAfterExecutionIndex(null);
    }, [latestRun?.id, node.id]);

    const previewSources = useMemo(() => {
        const runtimeSources = previewNodes.map(({ node: sourceNode }) => {
            const executionStatus = normalizeExecutionStatus(
                nodalPreviewExecutions?.[sourceNode.id],
                nodalPreviewExecutionMeta?.[sourceNode.id],
            );
            const executions = normalizeExecutions(
                nodalPreviewExecutions?.[sourceNode.id],
                executionStatus,
            );
            const executionIndex = executions.length > 1
                ? Math.min(Math.max(0, beforeExecutionIndexBySourceId[sourceNode.id] ?? 0), executions.length - 1)
                : 0;
            const runtimeValue = nodalPreviewNodes?.[sourceNode.id];

            return {
                executions,
                executionStatus,
                executionIndex,
                runtimeValue,
                hasRuntimeValue: Boolean(
                    nodalPreviewNodes
                    && Object.prototype.hasOwnProperty.call(nodalPreviewNodes, sourceNode.id),
                ),
            };
        });
        const resolvedRuntimeValue = (index: number) => {
            const source = runtimeSources[index];
            if (!source?.hasRuntimeValue) return undefined;
            return asRecord(source.executions[source.executionIndex]?.value ?? source.runtimeValue);
        };
        // Nodes added since the last run have no runtime snapshot, and their static state was
        // computed without run data. Once an upstream node with a runtime snapshot is found
        // (previewNodes are sorted by distance, so walk from the farthest), each following node
        // is replayed on top of the previous state: Set variables, Meta, Code assignments and
        // the like are re-evaluated with the real upstream values instead of showing undefined.
        const staticValues: unknown[] = new Array<unknown>(previewNodes.length);
        const replayNodeData: Record<string, unknown> = { ...(autocompleteContext.nodeData ?? {}) };
        let runtimeSeen = false;
        for (let index = previewNodes.length - 1; index >= 0; index--) {
            const sourceNode = previewNodes[index].node;
            const staticValue = staticPreviewNodes?.[sourceNode.id];
            const runtime = resolvedRuntimeValue(index);
            const previous = index + 1 < previewNodes.length ? asRecord(staticValues[index + 1]) : undefined;
            let resolved: unknown = staticValue;
            if (runtime) {
                runtimeSeen = true;
                resolved = runtime;
            } else if (sourceNode.system === 'run') {
                resolved = runNodePreview;
            } else if (runtimeSeen && previous) {
                const replayed = asRecord(createStaticNodeAfterData({
                    node: sourceNode,
                    entry: resolveNodeConfigEntry(sourceNode).entry,
                    inputPreview: asRecord(previous.$input) ?? {},
                    outputPreview: previous.$output,
                    contextPreview: asRecord(previous.$context) ?? {},
                    nodeData: { ...replayNodeData, last: previous },
                }));
                const staticLoop = asRecord(staticValue)?.$loop;
                resolved = replayed && staticLoop !== undefined ? { ...replayed, $loop: staticLoop } : replayed ?? staticValue;
            }
            staticValues[index] = resolved;
            if (resolved !== undefined) replayNodeData[nodeStateLabel(sourceNode)] = resolved;
        }
        // Inside a loop body the static fallback carries a placeholder $loop. It is replaced by the
        // $loop of the closest upstream node that did run, or, when the loop never ran, by the first
        // item of its Items expression evaluated against the inherited state, so $loop.item stays real.
        const runtimeLoopContext = insideLoopBody
            ? runtimeSources
                .map((_, index) => resolvedRuntimeValue(index)?.$loop)
                .find(loop => loop !== undefined)
            : undefined;
        const evaluatedLoopContext = (() => {
            if (!insideLoopBody || runtimeLoopContext !== undefined) return undefined;
            const loopIndex = previewNodes.findIndex(({ node: sourceNode }) => (
                sourceNode.entry.name === LOOP_NODE_NAME
                && asRecord(staticPreviewNodes?.[sourceNode.id])?.$loop !== undefined
            ));
            const loopNode = previewNodes[loopIndex]?.node;
            if (!loopNode || (normalizeScalarParameterValue(loopNode.values.mode).value || 'items') !== 'items') {
                return undefined;
            }
            const { $loop: _loop, ...loopBase } = asRecord(staticValues[loopIndex]) ?? {};
            const items = previewParameterValue(loopNode.values.items, {
                inputData: loopBase.$input,
                outputData: loopBase.$output,
                contextData: loopBase.$context,
                runData: loopBase,
                nodeData: { ...replayNodeData, last: loopBase },
            });
            return Array.isArray(items) && items.length > 0 ? { index: 0, item: items[0] } : undefined;
        })();
        const previewLoopContext = runtimeLoopContext ?? evaluatedLoopContext;
        const withPreviewLoopContext = (state: unknown) => {
            const record = asRecord(state);
            if (!record || previewLoopContext === undefined || !Object.prototype.hasOwnProperty.call(record, '$loop')) {
                return state;
            }
            return { ...record, $loop: previewLoopContext };
        };

        return previewNodes.map(({ node: sourceNode, distance }, index) => {
            const display = nodeDisplay(sourceNode);
            const isRun = sourceNode.system === 'run';
            const { executions, executionStatus, executionIndex, runtimeValue, hasRuntimeValue } = runtimeSources[index];
            const staticValue = withPreviewLoopContext(staticValues[index]);
            const exposesLoopContext = insideLoopBody
                || (distance === 1 && sourceNode.entry.name === LOOP_NODE_NAME);
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
            const value = visible(executions[executionIndex]?.value ?? fallbackValue);
            // Retained executions are the first ones; the node snapshot holds the final state.
            const latestValue = visible(fallbackValue);

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
        });
    }, [
        autocompleteContext.nodeData,
        beforeExecutionIndexBySourceId,
        captureContextPreview,
        currentNodeCapturePreview,
        insideLoopBody,
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
        // The static "After" state starts from the "Before" state shown for $run, so runtime keys
        // inherited from upstream nodes stay visible when this node has no snapshot yet.
        nodeData: {
            ...(autocompleteContext.nodeData ?? {}),
            ...(previewSources[0] ? { last: previewSources[0].value } : {}),
        },
    }), [autocompleteContext.nodeData, entry, node, previewSources, runNodePreview]);
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
        ? Math.min(Math.max(0, afterExecutionIndex ?? 0), currentNodeExecutions.length - 1)
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
    // Without a runtime snapshot, the static "After" state inherits the $loop shown for $run.
    const staticCurrentNodeAfterDataWithLoop = useMemo(() => {
        const runLoop = asRecord(previewSources[0]?.value)?.$loop;
        const state = asRecord(staticCurrentNodeAfterData);
        if (!insideLoopBody || runLoop === undefined || !state) return staticCurrentNodeAfterData;
        return { ...state, $loop: runLoop };
    }, [insideLoopBody, previewSources, staticCurrentNodeAfterData]);
    const rawCurrentNodeAfterData = node.system === 'run'
        ? runNodePreview
        : currentNodeExecutions[selectedAfterExecutionIndex]?.value
            ?? (hasCurrentNodeRuntimeValue ? nodalPreviewNodes?.[node.id] : staticCurrentNodeAfterDataWithLoop);
    // Memoized so the "After" inspector keeps its expand/collapse state across re-renders.
    const currentNodeAfterData = useMemo(
        () => insideLoopBody || entry.name === LOOP_NODE_NAME
            ? rawCurrentNodeAfterData
            : withoutLoopContext(rawCurrentNodeAfterData),
        [entry.name, insideLoopBody, rawCurrentNodeAfterData],
    );
    const targetedRunPreview = asRecord(previewSources[0]?.value) ?? runPreview;
    const targetedNodePreviewData = useMemo(() => ({
        ...(nodalPreviewNodes ?? {}),
        ...Object.fromEntries(previewSources.map(source => [source.id, source.value])),
    }), [nodalPreviewNodes, previewSources]);
    const targetedCapturePreview = asRecord(targetedRunPreview.$capture) ?? currentNodeCapturePreview;
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
    return {
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
    };
}
