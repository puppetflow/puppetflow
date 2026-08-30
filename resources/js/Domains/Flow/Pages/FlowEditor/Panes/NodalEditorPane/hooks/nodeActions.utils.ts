import {
    connectEdgeWithStructuredJoins,
    edgeSourcePort,
    edgeTargetPort,
    normalizeStructuredEdges,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/edges';
import { parse } from 'acorn';
import type {
    CanvasEdge,
    CanvasNode,
    NodeParameterValue,
    StickyNoteData,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';

const FREE_ADD_RANDOM_OFFSET = 120;

export type StickyNoteUpdate = Partial<StickyNoteData> & { x?: number; y?: number };

export const DEFAULT_STICKY_NOTE: StickyNoteData = {
    content: '### Sticky note\n\nWrite markdown here.',
    color: 'yellow',
    width: 260,
    height: 180,
};

export function randomCanvasOffset() {
    return (Math.random() - 0.5) * FREE_ADD_RANDOM_OFFSET * 2;
}

export function reconnectDeletedLinearNodes(nodes: CanvasNode[], edges: CanvasEdge[], removableIds: Set<string>) {
    const nextEdges = edges.filter(edge => !removableIds.has(edge.sourceNodeId) && !removableIds.has(edge.targetNodeId));
    const remainingNodes = nodes.filter(node => !removableIds.has(node.id));

    const incomingBoundaryEdges = edges.filter(edge => (
        !removableIds.has(edge.sourceNodeId) && removableIds.has(edge.targetNodeId)
    ));

    incomingBoundaryEdges.forEach(incomingEdge => {
        const queue = [incomingEdge.targetNodeId];
        const visited = new Set<string>();
        const outgoingBoundaryEdges: CanvasEdge[] = [];

        while (queue.length > 0) {
            const nodeId = queue.shift();
            if (!nodeId || visited.has(nodeId)) continue;
            visited.add(nodeId);

            edges.filter(edge => edge.sourceNodeId === nodeId).forEach(edge => {
                if (removableIds.has(edge.targetNodeId)) {
                    queue.push(edge.targetNodeId);
                } else {
                    outgoingBoundaryEdges.push(edge);
                }
            });
        }

        if (outgoingBoundaryEdges.length !== 1) return;
        const [outgoingEdge] = outgoingBoundaryEdges;
        if (!outgoingEdge || incomingEdge.sourceNodeId === outgoingEdge.targetNodeId) return;

        const sourcePort = edgeSourcePort(incomingEdge);
        const targetPort = edgeTargetPort(outgoingEdge);
        const candidateEdge = {
            id: `${incomingEdge.sourceNodeId}:${sourcePort}->${outgoingEdge.targetNodeId}:${targetPort}`,
            sourceNodeId: incomingEdge.sourceNodeId,
            targetNodeId: outgoingEdge.targetNodeId,
            sourcePort,
            targetPort,
        };
        const connectedEdges = connectEdgeWithStructuredJoins(
            remainingNodes,
            nextEdges,
            candidateEdge,
        );
        if (connectedEdges === nextEdges) return;
        nextEdges.splice(0, nextEdges.length, ...connectedEdges);
    });

    // Deleting a split node (e.g. an IF) can leave its former join with orphaned
    // multi-input edges; drop the edges that no longer form a structured graph.
    return normalizeStructuredEdges(remainingNodes, nextEdges);
}

interface ReferenceSyntaxNode {
    type: string;
    start: number;
    end: number;
    name?: string;
    value?: unknown;
    computed?: boolean;
    object?: ReferenceSyntaxNode;
    property?: ReferenceSyntaxNode;
    callee?: ReferenceSyntaxNode;
    arguments?: ReferenceSyntaxNode[];
    [key: string]: unknown;
}

function collectReferenceReplacements(
    source: string,
    referenceMap: Map<string, string>,
    includeLegacyOutput: boolean,
    offset = 0,
) {
    let ast: ReferenceSyntaxNode;
    try {
        ast = parse(source, {
            ecmaVersion: 'latest',
            sourceType: 'script',
            allowAwaitOutsideFunction: true,
            allowReturnOutsideFunction: true,
        }) as unknown as ReferenceSyntaxNode;
    } catch {
        return [] as { start: number; end: number; value: string }[];
    }

    const replacements: { start: number; end: number; value: string }[] = [];
    const visit = (value: unknown) => {
        if (!value || typeof value !== 'object') return;
        const node = value as Partial<ReferenceSyntaxNode>;
        if (typeof node.type !== 'string' || typeof node.start !== 'number' || typeof node.end !== 'number') return;

        if (
            node.type === 'CallExpression'
            && node.callee?.type === 'Identifier'
            && node.callee.name === '$'
        ) {
            const argument = node.arguments?.[0];
            const nextName = typeof argument?.value === 'string'
                ? referenceMap.get(argument.value)
                : undefined;
            if (argument && nextName) {
                replacements.push({
                    start: offset + argument.start,
                    end: offset + argument.end,
                    value: JSON.stringify(nextName),
                });
            }
        }

        if (
            node.type === 'MemberExpression'
            && node.object?.type === 'Identifier'
            && (
                node.object.name === '$nodes'
                || (includeLegacyOutput && node.object.name === '$output')
            )
        ) {
            const previousName = node.computed
                ? node.property?.value
                : node.property?.name;
            const nextName = typeof previousName === 'string'
                ? referenceMap.get(previousName)
                : undefined;
            if (node.property && nextName) {
                if (node.object.name === '$output') {
                    replacements.push({
                        start: offset + node.start,
                        end: offset + node.end,
                        value: `$nodes[${JSON.stringify(nextName)}]`,
                    });
                } else {
                    replacements.push(node.computed ? {
                        start: offset + node.property.start,
                        end: offset + node.property.end,
                        value: JSON.stringify(nextName),
                    } : {
                        start: offset + node.object.end,
                        end: offset + node.end,
                        value: `[${JSON.stringify(nextName)}]`,
                    });
                }
            }
        }

        Object.entries(node).forEach(([key, child]) => {
            if (['start', 'end'].includes(key)) return;
            if (Array.isArray(child)) child.forEach(visit);
            else visit(child);
        });
    };
    visit(ast);
    return replacements;
}

function remapNodeReferences(
    source: string,
    referenceMap: Map<string, string>,
    expressionTemplate = false,
    includeLegacyOutput = true,
) {
    const replacements = collectReferenceReplacements(source, referenceMap, includeLegacyOutput);
    if (replacements.length === 0 && expressionTemplate && source.includes('{{')) {
        for (const match of source.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
            if (match.index === undefined) continue;
            const expression = match[1] ?? '';
            replacements.push(...collectReferenceReplacements(
                expression,
                referenceMap,
                includeLegacyOutput,
                match.index + 2,
            ));
        }
    }

    return replacements
        .sort((left, right) => right.start - left.start)
        .reduce(
            (result, replacement) => (
                result.slice(0, replacement.start)
                + replacement.value
                + result.slice(replacement.end)
            ),
            source,
        );
}

function remapNodeValueReferences(
    value: NodeParameterValue,
    referenceMap: Map<string, string>,
    includeLegacyOutput = true,
): NodeParameterValue {
    if (value.mode === 'if-condition') {
        return {
            ...value,
            rules: value.rules.map(rule => ({
                ...rule,
                left: remapNodeValueReferences(rule.left, referenceMap, includeLegacyOutput) as typeof rule.left,
                right: rule.right
                    ? remapNodeValueReferences(rule.right, referenceMap, includeLegacyOutput) as typeof rule.right
                    : undefined,
            })),
        };
    }

    if (value.mode === 'object') {
        return {
            ...value,
            value: remapNodeReferences(
                value.value,
                referenceMap,
                value.jsonMode === 'expression',
                includeLegacyOutput,
            ),
            fields: value.fields.map(field => ({
                ...field,
                value: remapNodeValueReferences(field.value, referenceMap, includeLegacyOutput),
            })),
        };
    }

    return {
        ...value,
        value: remapNodeReferences(
            value.value,
            referenceMap,
            value.mode === 'expression',
            includeLegacyOutput,
        ),
    };
}

function remapNodeValues(
    values: Record<string, NodeParameterValue>,
    referenceMap: Map<string, string>,
    includeLegacyOutput = true,
) {
    return Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
            key,
            remapNodeValueReferences(value, referenceMap, includeLegacyOutput),
        ]),
    );
}

export function remapNodeValuesReferences(
    values: Record<string, NodeParameterValue>,
    idMap: Map<string, string>,
    labelMap?: Map<string, string>,
) {
    const remappedIds = remapNodeValues(values, idMap);
    return labelMap ? remapNodeValues(remappedIds, labelMap, false) : remappedIds;
}

export function renameNodeValuesReferences(
    values: Record<string, NodeParameterValue>,
    previousLabel: string,
    nextLabel: string,
) {
    return remapNodeValues(values, new Map([[previousLabel, nextLabel]]), false);
}
