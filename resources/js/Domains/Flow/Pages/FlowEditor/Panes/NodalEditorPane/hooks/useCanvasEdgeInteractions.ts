import type React from 'react';
import { useCallback } from 'react';
import {
    DEFAULT_INPUT_PORT,
    getNodeInputPorts,
    getNodeOutputPorts,
    getNodePortDefinition,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/constants';
import {
    applyConnectionScope,
    collectReplacedEdgeIds,
    connectEdgeWithStructuredJoins,
    connectsSeparateSystemFlows,
    edgeSourcePort,
    resolveConnectionScope,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/edges';
import { getPortPosition } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/geometry';
import type {
    CanvasNode,
    NodePortKind,
    NodePortSide,
    Point,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import type { UseCanvasInteractionsOptions } from './useCanvasInteractions.types';

type UseCanvasEdgeInteractionsOptions = Pick<
    UseCanvasInteractionsOptions,
    | 'activatePane'
    | 'connectionDragRef'
    | 'edges'
    | 'nodes'
    | 'readOnly'
    | 'recordHistory'
    | 'setConnectionDrag'
    | 'setEdgeDropTarget'
    | 'setEdges'
    | 'setNodes'
    | 'setPendingConnectionTarget'
    | 'setPendingEdgeInsertion'
    | 'setPickerOpen'
    | 'setSearch'
>;

// Manages connection dragging, edge insertion, reconnection, and deletion gestures.
export function useCanvasEdgeInteractions({
    activatePane,
    connectionDragRef,
    edges,
    nodes,
    readOnly,
    recordHistory,
    setConnectionDrag,
    setEdgeDropTarget,
    setEdges,
    setNodes,
    setPendingConnectionTarget,
    setPendingEdgeInsertion,
    setPickerOpen,
    setSearch,
}: UseCanvasEdgeInteractionsOptions) {
    const handleConnectionPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>, pointerWorld: Point | null) => {
        const connectionDragState = connectionDragRef.current;
        if (!connectionDragState || connectionDragState.pointerId !== event.pointerId) return false;
        if (!pointerWorld) return true;

        const nextDrag = {
            ...connectionDragState,
            currentX: pointerWorld.x,
            currentY: pointerWorld.y,
        };
        connectionDragRef.current = nextDrag;
        setConnectionDrag(nextDrag);
        return true;
    }, [connectionDragRef, setConnectionDrag]);

    const handleConnectionPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const connectionDragState = connectionDragRef.current;
        if (!connectionDragState || connectionDragState.pointerId !== event.pointerId) return false;

        const targetElement = document.elementFromPoint(event.clientX, event.clientY);
        const targetPortElement = targetElement?.closest<HTMLElement>('[data-node-port]');
        const targetNodeElement = targetElement?.closest<HTMLElement>('[data-node-card]');
        const targetNodeId = targetPortElement?.dataset.nodeId ?? targetNodeElement?.dataset.nodeId;
        const hoveredNode = nodes.find(node => node.id === targetNodeId);
        const compatibleToolPort = connectionDragState.connectionType === 'ai_tool' && hoveredNode
            ? (connectionDragState.fromSide === 'output'
                ? getNodeInputPorts(hoveredNode.entry.name)
                : getNodeOutputPorts(hoveredNode.entry.name, hoveredNode.entry)
            ).find(port => port.connectionType === 'ai_tool')
            : undefined;
        // Dropped on the card rather than on a handle: the wire lands on the
        // side opposite to where it started. Dragged from an input, it takes
        // a flow output of the hovered node, an unused one first so a node
        // with several handles (If / Else, Loop) keeps its other branches.
        const bodyDropPort = hoveredNode && hoveredNode.id !== connectionDragState.fromNodeId && !targetPortElement
            ? (connectionDragState.fromSide === 'output'
                ? getNodeInputPorts(hoveredNode.entry.name).find(port => port.id === DEFAULT_INPUT_PORT)
                : (() => {
                    const outputs = getNodeOutputPorts(hoveredNode.entry.name, hoveredNode.entry)
                        .filter(port => (port.connectionType ?? 'flow') === 'flow');
                    return outputs.find(port => !edges.some(edge => (
                        edge.sourceNodeId === hoveredNode.id && edgeSourcePort(edge) === port.id
                    ))) ?? outputs[0];
                })())
            : undefined;
        const targetPort = compatibleToolPort?.id
            ?? (targetPortElement?.dataset.portKind as NodePortKind | undefined)
            ?? bodyDropPort?.id;
        const targetSide = compatibleToolPort?.side
            ?? (targetPortElement?.dataset.portSide as NodePortSide | undefined)
            ?? bodyDropPort?.side;
        const draggedFromNode = nodes.find(node => node.id === connectionDragState.fromNodeId);
        const draggedFromPort = draggedFromNode
            ? getNodePortDefinition(
                draggedFromNode.entry.name,
                draggedFromNode.entry,
                connectionDragState.fromPort,
                connectionDragState.fromSide,
            )
            : undefined;

        if (
            targetNodeId
            && targetPort
            && targetSide
            && targetNodeId !== connectionDragState.fromNodeId
            && targetSide !== connectionDragState.fromSide
        ) {
            const sourceNodeId = connectionDragState.fromSide === 'output' ? connectionDragState.fromNodeId : targetNodeId;
            const finalTargetNodeId = connectionDragState.fromSide === 'output' ? targetNodeId : connectionDragState.fromNodeId;
            const sourcePort = connectionDragState.fromSide === 'output' ? connectionDragState.fromPort : targetPort;
            const targetPortId = connectionDragState.fromSide === 'output' ? targetPort : connectionDragState.fromPort;
            const sourceNode = nodes.find(node => node.id === sourceNodeId);
            const targetNode = nodes.find(node => node.id === finalTargetNodeId);
            const sourceDefinition = sourceNode
                ? getNodePortDefinition(sourceNode.entry.name, sourceNode.entry, sourcePort, 'output')
                : undefined;
            const targetDefinition = targetNode
                ? getNodePortDefinition(targetNode.entry.name, targetNode.entry, targetPortId, 'input')
                : undefined;
            if (
                !sourceDefinition
                || !targetDefinition
                || (sourceDefinition.connectionType ?? 'flow') !== (targetDefinition.connectionType ?? 'flow')
            ) {
                connectionDragRef.current = null;
                setConnectionDrag(null);
                return true;
            }
            const nextEdge = {
                    id: `${sourceNodeId}:${sourcePort}->${finalTargetNodeId}:${targetPortId}`,
                    sourceNodeId,
                    targetNodeId: finalTargetNodeId,
                    sourcePort,
                    targetPort: targetPortId,
                    connectionType: sourceDefinition.connectionType ?? 'flow',
            };
            const scopeResolution = resolveConnectionScope(
                nodes,
                edges,
                sourceNodeId,
                finalTargetNodeId,
                collectReplacedEdgeIds(edges, nextEdge),
            );
            if (!scopeResolution) {
                connectionDragRef.current = null;
                setConnectionDrag(null);
                return true;
            }
            const scopedNodes = applyConnectionScope(nodes, scopeResolution);
            if (
                sourceDefinition.connectionType !== 'ai_tool'
                && connectsSeparateSystemFlows(scopedNodes, edges, sourceNodeId, finalTargetNodeId)
            ) {
                connectionDragRef.current = null;
                setConnectionDrag(null);
                return true;
            }

            const nextEdges = sourceDefinition.connectionType === 'ai_tool'
                ? [...edges.filter(edge => edge.id !== nextEdge.id), nextEdge]
                : connectEdgeWithStructuredJoins(scopedNodes, edges, nextEdge);
            if (nextEdges !== edges) {
                recordHistory();
                if (scopedNodes !== nodes) {
                    setNodes(current => applyConnectionScope(current, scopeResolution));
                }
                setEdges(nextEdges);
            }
        } else if (!targetNodeId || targetNodeId === connectionDragState.fromNodeId) {
            setPendingConnectionTarget({
                fromNodeId: connectionDragState.fromNodeId,
                fromPort: connectionDragState.fromPort,
                fromSide: connectionDragState.fromSide,
                connectionType: draggedFromPort?.connectionType ?? 'flow',
                x: connectionDragState.currentX,
                y: connectionDragState.currentY,
            });
            setPendingEdgeInsertion(null);
            setSearch('');
            setPickerOpen(false);
            window.requestAnimationFrame(() => setPickerOpen(true));
        }

        connectionDragRef.current = null;
        setConnectionDrag(null);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        return true;
    }, [connectionDragRef, edges, nodes, recordHistory, setConnectionDrag, setEdges, setNodes, setPendingConnectionTarget, setPendingEdgeInsertion, setPickerOpen, setSearch]);

    const handlePortPointerDown = useCallback((
        event: React.PointerEvent<HTMLDivElement>,
        node: CanvasNode,
        port: NodePortKind,
        side: NodePortSide,
    ) => {
        activatePane();
        if (readOnly || event.button !== 0) return;

        event.stopPropagation();
        const start = getPortPosition(node, port, side);
        const portDefinition = getNodePortDefinition(node.entry.name, node.entry, port, side);
        const nextDrag = {
            pointerId: event.pointerId,
            fromNodeId: node.id,
            fromPort: port,
            fromSide: side,
            connectionType: portDefinition?.connectionType ?? 'flow',
            startX: start.x,
            startY: start.y,
            currentX: start.x,
            currentY: start.y,
        };

        connectionDragRef.current = nextDrag;
        setConnectionDrag(nextDrag);
        setEdgeDropTarget(null);
        event.currentTarget.setPointerCapture(event.pointerId);
    }, [activatePane, connectionDragRef, readOnly, setConnectionDrag, setEdgeDropTarget]);

    return {
        handleConnectionPointerMove,
        handleConnectionPointerUp,
        handlePortPointerDown,
    };
}
