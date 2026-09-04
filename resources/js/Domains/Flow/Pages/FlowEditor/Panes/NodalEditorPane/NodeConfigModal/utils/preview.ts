import type { FlowRun } from '@/Domains/Flow/types';
import type { HelpEntryDef } from '@/Domains/Flow/Pages/FlowEditor/types';
import type { CanvasNode, NodeParameterValue } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import type { NodalAutocompleteContext } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/staticAnalysis';
import { collectCodeRunAssignments } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/staticAnalysis';
import { evaluateExpressionPreview, normalizeScalarParameterValue } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/expression';
import {
    CODE_NODE_NAME,
    CODE_NODE_VALUE_KEY,
    LOOP_NODE_NAME,
    META_NODE_NAME,
    SET_NODE_NAME,
    SET_OUTPUT_NODE_NAME,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/constants';
import { formatEntryLabel, getEntryByName } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/catalog';
import {
    coerceJsonPreviewValue,
    parseFixedPreviewValue,
    parseLiteralPreviewValue,
    setPreviewPathValue,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/previewValues';
import { createNodalOutputPreview } from '@/Domains/Flow/Pages/FlowEditor/utils/outputPreview';
import { asRecord, withoutContext } from './values';

export interface PreviewScope {
    inputData: unknown;
    outputData: unknown;
    nodeData: unknown;
    runData: unknown;
    contextData: unknown;
}

/** Key under which a node's state is exposed in `$nodes`; must match the compiler and static analysis. */
export const nodeStateLabel = (node: CanvasNode) => (
    node.label?.trim() || formatEntryLabel(node.system ? node.entry : getEntryByName(node.entry.name))
);

const previewTypedFieldValue = (value: unknown, valueType: string | undefined) => {
    switch (valueType) {
        case 'number':
            return Number(value);
        case 'boolean':
            return value === true || value === 'true' || value === 1 || value === '1';
        case 'array': {
            const parsed = typeof value === 'string' ? parseLiteralPreviewValue(value) : value;
            return Array.isArray(parsed) ? parsed : [];
        }
        case 'object': {
            const parsed = typeof value === 'string' ? parseLiteralPreviewValue(value) : value;
            return asRecord(parsed) ?? {};
        }
        case 'string':
            return String(value ?? '');
        default:
            return value;
    }
};

// Field names may hold {{ }} templates; render them like expression values.
const previewFieldKey = (key: string, scope: PreviewScope): string => {
    if (!key.includes('{{')) return key;

    const rendered = evaluateExpressionPreview(key, scope);
    return rendered.ok && rendered.value !== null && rendered.value !== undefined
        ? String(rendered.value)
        : '';
};

export const previewParameterValue = (
    value: NodeParameterValue | undefined,
    scope: PreviewScope,
): unknown => {
    if (!value) return undefined;
    if (value.mode === 'fixed') return parseFixedPreviewValue(value.value);

    if (value.mode === 'expression') {
        const rendered = evaluateExpressionPreview(value.value, scope);
        return rendered.ok ? rendered.value : undefined;
    }

    if (value.mode !== 'object') return undefined;
    if (value.inputMode === 'json') {
        if (value.jsonMode === 'expression') {
            const rendered = evaluateExpressionPreview(value.value, scope);
            if (!rendered.ok) return undefined;

            try {
                const parsed = typeof rendered.value === 'string'
                    ? JSON.parse(rendered.value || '{}')
                    : rendered.value;
                return coerceJsonPreviewValue(parsed);
            } catch {
                return undefined;
            }
        }

        try {
            return JSON.parse(value.value || '{}');
        } catch {
            return undefined;
        }
    }

    return Object.fromEntries(
        value.fields
            .map(field => [previewFieldKey(field.key.trim(), scope), field.value, field.valueType] as const)
            .filter(([key]) => Boolean(key))
            .map(([key, fieldValue, valueType]) => [
                key,
                previewTypedFieldValue(previewParameterValue(fieldValue, scope), valueType),
            ]),
    );
};

export const unresolvedNodeResultPreview = (node: CanvasNode) => {
    const label = node.label?.trim() || formatEntryLabel(node.entry);
    const entry = node.system ? null : getEntryByName(node.entry.name);
    if (entry && (entry.name === '$extractAttribute' || entry.name === '$extractAttributes')) {
        const getters = node.values.getters;
        let keys: string[] = [];
        if (getters?.mode === 'object' && getters.inputMode === 'form') {
            keys = getters.fields.map(field => field.key.trim()).filter(Boolean);
        } else if (getters?.mode === 'object' && getters.inputMode === 'json' && getters.jsonMode !== 'expression') {
            try {
                const parsed = JSON.parse(getters.value || '{}');
                if (asRecord(parsed)) keys = Object.keys(parsed);
            } catch {
                keys = [];
            }
        }
        if (keys.length > 0) {
            const objectPreview = Object.fromEntries(keys.map(key => [key, `[Needs run: ${label}]`]));
            return entry.name === '$extractAttributes' ? [objectPreview] : objectPreview;
        }
    }
    return createNodalOutputPreview(entry, label);
};

const withoutRuntimeInputs = (context: Record<string, unknown> | null) => {
    if (!context) return null;

    const {
        viewportWidth: _viewportWidth,
        viewportHeight: _viewportHeight,
        $viewportWidth: _$viewportWidth,
        $viewportHeight: _$viewportHeight,
        $keyboardSpeed: _$keyboardSpeed,
        ...rest
    } = context;
    return rest;
};

export const mergeOutputContextPreview = (
    latestInputContext: Record<string, unknown> | null,
    autocompleteContext: Record<string, unknown> | null,
    latestOutputContext: Record<string, unknown> | null,
) => ({
    ...(withoutRuntimeInputs(latestInputContext) ?? {}),
    ...(withoutRuntimeInputs(autocompleteContext) ?? {}),
    ...(withoutRuntimeInputs(latestOutputContext) ?? {}),
});

const mergeOutputInputPreview = (
    latestInput: Record<string, unknown> | null,
    autocompleteInput: Record<string, unknown> | null,
    latestOutputInput: Record<string, unknown> | null,
    nodalPreviewInput: Record<string, unknown> | null,
) => ({
    ...(withoutContext(latestInput) ?? {}),
    ...(withoutContext(autocompleteInput) ?? {}),
    ...(withoutContext(latestOutputInput) ?? {}),
    ...(withoutContext(nodalPreviewInput) ?? {}),
});

export const createExpressionOutputData = (
    latestRun: FlowRun | null,
    staticOutput: Record<string, unknown> | null,
    nodalPreviewOutput: Record<string, unknown> | null,
    isFinallyNode: boolean,
) => {
    const baseOutput = latestRun?.output ?? null;
    const outputRecord = asRecord(baseOutput);

    if (!isFinallyNode) {
        return staticOutput || nodalPreviewOutput
            ? { ...(staticOutput ?? {}), ...(nodalPreviewOutput ?? {}) }
            : outputRecord ? null : baseOutput;
    }

    return {
        ...(staticOutput ?? {}),
        ...(nodalPreviewOutput ?? {}),
        ...(outputRecord ?? {}),
        status: latestRun?.status ?? outputRecord?.status,
    };
};

/**
 * When the edited node sits inside a `$sniffNetwork` sniffing callback (static analysis exposes a
 * `$capture` placeholder in that case), the sniff node is shown with the most relevant captured
 * payload as `$capture`: the one recorded on the edited node, else the last runtime capture, else the placeholder.
 */
export const resolveSniffCallbackValue = ({
    sourceNode,
    staticValue,
    runtimeValue,
    fallbackBase,
    captureContextPreview,
    currentNodeCapture,
}: {
    sourceNode: CanvasNode;
    staticValue: unknown;
    runtimeValue: unknown;
    fallbackBase: Record<string, unknown>;
    captureContextPreview: Record<string, unknown> | null;
    currentNodeCapture: Record<string, unknown> | null;
}): Record<string, unknown> | undefined => {
    if (sourceNode.entry.name !== '$sniffNetwork' || !captureContextPreview) return undefined;

    const runtimeCaptures = asRecord(runtimeValue)?.captures;
    const latestRuntimeCapture = Array.isArray(runtimeCaptures)
        ? [...runtimeCaptures].reverse().find(item => asRecord(item))
        : undefined;

    return {
        ...(asRecord(staticValue) ?? fallbackBase),
        $capture: currentNodeCapture ?? asRecord(latestRuntimeCapture) ?? captureContextPreview,
    };
};

export const createEffectiveAutocompleteContext = ({
    autocompleteContext,
    latestInput,
    latestOutputInput,
    nodalPreviewInput,
    runPreview,
    outputContextPreview,
    nodePreviewData,
    currentNodeCapture,
    previewNodes,
    entryName,
    loopMode,
}: {
    autocompleteContext: NodalAutocompleteContext;
    latestInput: Record<string, unknown> | null;
    latestOutputInput: Record<string, unknown> | null;
    nodalPreviewInput: Record<string, unknown> | null;
    runPreview: Record<string, unknown>;
    outputContextPreview: Record<string, unknown>;
    nodePreviewData: Record<string, unknown> | null;
    currentNodeCapture: Record<string, unknown> | null;
    previewNodes: Array<{ node: CanvasNode; distance: number }>;
    entryName: string;
    loopMode: string | null;
}): NodalAutocompleteContext => {
    const nodeData = { ...(autocompleteContext.nodeData ?? {}) };
    const captureContextPreview = asRecord(autocompleteContext.runData?.$capture);
    previewNodes.forEach(({ node }) => {
        const label = nodeStateLabel(node);
        const staticValue = autocompleteContext.nodeData?.[label];
        const runtimeValue = nodePreviewData?.[node.id];
        const captureValue = resolveSniffCallbackValue({
            sourceNode: node,
            staticValue,
            runtimeValue,
            fallbackBase: runPreview,
            captureContextPreview,
            currentNodeCapture,
        });
        const value = node.system === 'run'
            ? runPreview
            : captureValue ?? runtimeValue ?? staticValue;
        if (value === undefined) return;
        nodeData[label] = value;
    });
    const immediateNode = previewNodes[0]?.node;
    if (immediateNode) {
        const immediateValue = immediateNode.system === 'run'
            ? runPreview
            : nodeData[nodeStateLabel(immediateNode)];
        if (immediateValue !== undefined) nodeData.last = immediateValue;
    }

    return {
        ...autocompleteContext,
        inputData: mergeOutputInputPreview(
            latestInput,
            autocompleteContext.inputData,
            latestOutputInput,
            nodalPreviewInput,
        ),
        runData: {
            ...runPreview,
            ...(entryName === LOOP_NODE_NAME && loopMode === 'condition'
                ? { $loop: { index: 0 } }
                : {}),
        },
        nodeData,
        contextData: outputContextPreview,
    };
};

export const createStaticNodeAfterData = ({
    node,
    entry,
    inputPreview,
    outputPreview,
    contextPreview,
    nodeData,
}: {
    node: CanvasNode;
    entry: HelpEntryDef;
    inputPreview: Record<string, unknown>;
    outputPreview: unknown;
    contextPreview: Record<string, unknown>;
    nodeData: unknown;
}) => {
    const nextInput = { ...inputPreview };
    const nextOutput = { ...(asRecord(outputPreview) ?? {}) };
    const nextContext = { ...contextPreview };
    const nodes = asRecord(nodeData);
    const previous = asRecord(nodes?.last) ?? {
        $input: inputPreview,
        $output: outputPreview,
        $context: contextPreview,
    };
    const { $result: _previousResult, ...base } = previous;
    const scope: PreviewScope = {
        inputData: inputPreview,
        outputData: outputPreview,
        nodeData,
        runData: {
            $input: inputPreview,
            $output: outputPreview,
            $context: contextPreview,
        },
        contextData: contextPreview,
    };
    let result: unknown = unresolvedNodeResultPreview(node);

    if (entry.name === '$keyboardSpeed') {
        const speed = Number(previewParameterValue(node.values.keyboardSpeedValue, scope));
        if (Number.isFinite(speed) && speed >= 0) nextInput.$keyboardSpeed = speed;
    } else if (entry.name === '$setViewport') {
        const width = Number(previewParameterValue(node.values.width, scope));
        const height = Number(previewParameterValue(node.values.height, scope));
        if (Number.isFinite(width) && width > 0) nextInput.$viewportWidth = width;
        if (Number.isFinite(height) && height > 0) nextInput.$viewportHeight = height;
    } else if (entry.name === SET_NODE_NAME || entry.name === SET_OUTPUT_NODE_NAME) {
        const variables = asRecord(previewParameterValue(node.values.variables, scope));
        if (variables) {
            if (entry.name === SET_OUTPUT_NODE_NAME) {
                Object.entries(variables).forEach(([key, value]) => setPreviewPathValue(nextOutput, key, value));
                result = {};
            } else {
                result = variables;
            }
        }
    } else if (entry.name === META_NODE_NAME) {
        const metadata = asRecord(previewParameterValue(node.values.metadata, scope));
        if (metadata) {
            nextContext.meta = { ...(asRecord(nextContext.meta) ?? {}), ...metadata };
            result = metadata;
        }
    } else if (entry.name === CODE_NODE_NAME) {
        const codeRunData: Record<string, unknown> = {};
        collectCodeRunAssignments(
            normalizeScalarParameterValue(node.values[CODE_NODE_VALUE_KEY]).value,
            codeRunData,
        );
        result = {
            ...(asRecord(result) ?? {}),
            ...codeRunData,
        };
    }

    return {
        ...base,
        ...(asRecord(result) ?? (result === undefined ? {} : { $result: result })),
        $input: nextInput,
        $output: nextOutput,
        $context: nextContext,
    };
};
