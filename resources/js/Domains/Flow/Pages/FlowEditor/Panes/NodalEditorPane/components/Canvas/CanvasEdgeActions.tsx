import { useState } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import {
    DEFAULT_INPUT_PORT,
    DEFAULT_OUTPUT_PORT,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/constants';
import {
    getBranchEdgePath,
    getEdgeMidpoint,
    getEdgePath,
    getPortPosition,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/geometry';
import { isExecutionEdge } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/edges';
import type {
    CanvasEdge,
    CanvasNode,
    PendingEdgeInsertion,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import * as S from './CanvasEdgeActions.styled';

interface CanvasEdgeActionsProps {
    edges: CanvasEdge[];
    nodes: CanvasNode[];
    readOnly?: boolean;
    onInsertNode: (insertion: PendingEdgeInsertion) => void;
    onRemoveEdge: (edgeId: string) => void;
}

export default function CanvasEdgeActions({
    edges,
    nodes,
    readOnly,
    onInsertNode,
    onRemoveEdge,
}: CanvasEdgeActionsProps) {
    const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

    if (readOnly) return null;

    const geometries = edges.flatMap(edge => {
        const sourceNode = nodes.find(node => node.id === edge.sourceNodeId);
        const targetNode = nodes.find(node => node.id === edge.targetNodeId);
        if (!sourceNode || !targetNode) return [];

        const start = getPortPosition(sourceNode, edge.sourcePort ?? DEFAULT_OUTPUT_PORT, 'output');
        const end = getPortPosition(targetNode, edge.targetPort ?? DEFAULT_INPUT_PORT, 'input');
        const executionEdge = isExecutionEdge(edge);

        return [{
            edge,
            executionEdge,
            midpoint: getEdgeMidpoint(start, end),
            path: executionEdge ? getEdgePath(start, end) : getBranchEdgePath(start, end),
        }];
    });

    return (
        <>
            <S.EdgeHitLayer>
                {geometries.map(({ edge, path }) => (
                    <S.EdgeHitPath
                        key={`hit-${edge.id}`}
                        d={path}
                        onPointerEnter={() => setHoveredEdgeId(edge.id)}
                        onPointerLeave={() => setHoveredEdgeId(current => (current === edge.id ? null : current))}
                    />
                ))}
            </S.EdgeHitLayer>
            {geometries.map(({ edge, executionEdge, midpoint }) => (
                <S.EdgeActionZone
                    key={`actions-${edge.id}`}
                    style={{ left: midpoint.x, top: midpoint.y }}
                    data-edge-hovered={hoveredEdgeId === edge.id ? 'true' : undefined}
                    onPointerDown={event => event.stopPropagation()}
                >
                    <S.EdgeActionGroup>
                        {executionEdge && (
                            <S.EdgeActionButton
                                type="button"
                                title="Insert node here"
                                onClick={event => {
                                    event.stopPropagation();
                                    onInsertNode({
                                        edgeId: edge.id,
                                        sourceNodeId: edge.sourceNodeId,
                                        targetNodeId: edge.targetNodeId,
                                        sourcePort: edge.sourcePort ?? DEFAULT_OUTPUT_PORT,
                                        targetPort: edge.targetPort ?? DEFAULT_INPUT_PORT,
                                        x: midpoint.x,
                                        y: midpoint.y,
                                    });
                                }}
                            >
                                <Icon icon="lucide:plus" width={12} height={12} />
                            </S.EdgeActionButton>
                        )}
                        <S.EdgeActionButton
                            type="button"
                            $danger
                            title="Remove connection"
                            onClick={event => {
                                event.stopPropagation();
                                onRemoveEdge(edge.id);
                            }}
                        >
                            <Icon icon="lucide:trash-2" width={12} height={12} />
                        </S.EdgeActionButton>
                    </S.EdgeActionGroup>
                </S.EdgeActionZone>
            ))}
        </>
    );
}
