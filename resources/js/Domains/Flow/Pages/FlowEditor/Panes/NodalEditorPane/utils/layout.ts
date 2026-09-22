import type { CanvasEdge, CanvasNode, Point } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import { edgeSourcePort, edgeTargetPort } from './edges';
import { getSidePortVerticalOffset } from './geometry';
import { CANVAS_GRID_SIZE, snapCanvasPosition } from './grid';

const SYSTEM_X = 0;
const RUN_Y = -10 * CANVAS_GRID_SIZE;
const TERMINATE_Y = 14 * CANVAS_GRID_SIZE;
const FIRST_COLUMN_X = 16 * CANVAS_GRID_SIZE;
const HORIZONTAL_GAP = 16 * CANVAS_GRID_SIZE;
const VERTICAL_GAP = 18 * CANVAS_GRID_SIZE;

export const SYSTEM_RUN_POSITION = { x: SYSTEM_X, y: RUN_Y };
export const SYSTEM_TERMINATE_POSITION = { x: SYSTEM_X, y: TERMINATE_Y };

export const getNodesCenter = (nodes: CanvasNode[]): Point => ({
    x: (Math.min(...nodes.map(node => node.x)) + Math.max(...nodes.map(node => node.x))) / 2,
    y: (Math.min(...nodes.map(node => node.y)) + Math.max(...nodes.map(node => node.y))) / 2,
});

// An original edge feeding a column item, with the number of columns it crosses.
type LayoutParent = {
    edge: CanvasEdge;
    span: number;
};

// A column slot. Real nodes carry their CanvasNode; virtual items only reserve a
// slot for an edge that spans several columns so the nodes of the crossed
// columns move out of the edge's way instead of sitting on its path.
type LayoutItem = {
    id: string;
    sortKey: string;
    node?: CanvasNode;
    parents: LayoutParent[];
    // Previous virtual item of the same long edge, so the reserved lane stays
    // straight across every crossed column.
    chainFromId?: string;
};

type LayoutColumns = Map<number, LayoutItem[]>;

// Resolves overlaps in a column while keeping the given order: items are
// placed as close as possible to their desired y and conflicting neighbours
// are spread by `gap` around their common mean, so a pair fighting for the
// same line ends up centered on it instead of being pushed downward. This is
// an isotonic regression (pool adjacent violators) on y_i - i * gap.
const spreadPositions = (desired: number[], gap: number): number[] => {
    const blocks: Array<{ sum: number; count: number; start: number }> = [];

    desired.forEach((value, index) => {
        let block = { sum: value - index * gap, count: 1, start: index };

        while (blocks.length > 0) {
            const previous = blocks[blocks.length - 1];
            if (previous.sum / previous.count <= block.sum / block.count) break;
            blocks.pop();
            block = { sum: previous.sum + block.sum, count: previous.count + block.count, start: previous.start };
        }

        blocks.push(block);
    });

    return blocks.flatMap(block => Array.from(
        { length: block.count },
        (_, offset) => Math.round(block.sum / block.count + (block.start + offset) * gap),
    ));
};

export const arrangeGraph = (nodes: CanvasNode[], edges: CanvasEdge[]): CanvasNode[] => {
    const editableNodes = nodes.filter(node => !node.system && !node.scopeId && node.kind !== 'stickyNote');
    const nodeById = new Map(nodes.map(node => [node.id, node]));
    const outgoing = new Map<string, string[]>();
    const incoming = new Map<string, string[]>();

    edges.forEach(edge => {
        outgoing.set(edge.sourceNodeId, [...(outgoing.get(edge.sourceNodeId) ?? []), edge.targetNodeId]);
        incoming.set(edge.targetNodeId, [...(incoming.get(edge.targetNodeId) ?? []), edge.sourceNodeId]);
    });

    // Groups nodes per depth and reserves a virtual item in every column crossed
    // by an edge spanning more than one column. Items keep the original edges
    // feeding them so their position can be derived from the real handles.
    const buildLayoutColumns = (columnNodes: CanvasNode[], depthById: Map<string, number>): LayoutColumns => {
        const columns: LayoutColumns = new Map();
        const itemsById = new Map<string, LayoutItem>();
        const pushItem = (depth: number, item: LayoutItem) => {
            columns.set(depth, [...(columns.get(depth) ?? []), item]);
            itemsById.set(item.id, item);
        };

        columnNodes.forEach(node => {
            const depth = depthById.get(node.id);
            if (depth === undefined) return;
            pushItem(depth, { id: node.id, sortKey: node.entry.name, node, parents: [] });
        });

        edges.forEach(edge => {
            const target = itemsById.get(edge.targetNodeId);
            if (!target) return;

            const sourceDepth = depthById.get(edge.sourceNodeId);
            const targetDepth = depthById.get(edge.targetNodeId) ?? 0;
            const span = sourceDepth === undefined ? 1 : targetDepth - sourceDepth;
            const parent = { edge, span };
            target.parents.push(parent);

            if (sourceDepth === undefined) return;
            for (let depth = sourceDepth + 1; depth < targetDepth; depth += 1) {
                pushItem(depth, {
                    id: `${edge.id}@${depth}`,
                    sortKey: '',
                    parents: [parent],
                    chainFromId: depth > sourceDepth + 1 ? `${edge.id}@${depth - 1}` : undefined,
                });
            }
        });

        return columns;
    };

    const outputHandleOffset = (edge: CanvasEdge): number => {
        const sourceNode = nodeById.get(edge.sourceNodeId);
        if (!sourceNode || sourceNode.system) return 0;
        return getSidePortVerticalOffset(sourceNode, edgeSourcePort(edge), 'output');
    };

    const inputHandleOffset = (item: LayoutItem, edge: CanvasEdge): number => (
        item.node ? getSidePortVerticalOffset(item.node, edgeTargetPort(edge), 'input') : 0
    );

    // The y at which the item's input handle sits exactly in front of its
    // parents' output handles, so the edge between them is a straight line.
    // Edges crossing several columns win over short ones: the long straight
    // line is the main path and the detour bends toward it, not the opposite.
    const desiredY = (item: LayoutItem, anchorY: number, arrangedYById: Map<string, number>): number => {
        const chainedY = item.chainFromId ? arrangedYById.get(item.chainFromId) : undefined;
        if (chainedY !== undefined) return chainedY;
        if (item.parents.length === 0) return anchorY;

        const longParents = item.parents.filter(parent => parent.span > 1);
        const parents = longParents.length > 0 ? longParents : item.parents;
        const total = parents.reduce((sum, { edge }) => (
            sum + (arrangedYById.get(edge.sourceNodeId) ?? anchorY) + outputHandleOffset(edge) - inputHandleOffset(item, edge)
        ), 0);

        return total / parents.length;
    };

    // Places every column around anchorY. Virtual items get a y like real nodes
    // (kept in arrangedYById) so the next column can align on them, but only
    // real nodes are written to arrangedNodes. Returns the vertical extent.
    const arrangeLayoutColumns = (
        columns: LayoutColumns,
        anchorY: number,
        xForDepth: (depth: number) => number,
        arrangedNodes: Map<string, CanvasNode>,
        arrangedYById: Map<string, number>,
    ) => {
        let top = anchorY;
        let bottom = anchorY;

        [...columns.entries()]
            .sort(([a], [b]) => a - b)
            .forEach(([depth, columnItems]) => {
                const desiredById = new Map(columnItems.map(item => [item.id, desiredY(item, anchorY, arrangedYById)]));
                const sortedItems = [...columnItems].sort((a, b) => (
                    (desiredById.get(a.id) ?? anchorY) - (desiredById.get(b.id) ?? anchorY)
                    || a.sortKey.localeCompare(b.sortKey)
                ));
                const positions = spreadPositions(sortedItems.map(item => desiredById.get(item.id) ?? anchorY), VERTICAL_GAP);

                sortedItems.forEach((item, index) => {
                    // Handles sit on grid steps (see getPortHandleOffset), so a
                    // straight edge target is already on the grid; snapping only
                    // rounds the means produced by spreading or multi-parent nodes.
                    const y = snapCanvasPosition(positions[index]);
                    arrangedYById.set(item.id, y);
                    top = Math.min(top, y);
                    bottom = Math.max(bottom, y);
                    if (item.node) {
                        arrangedNodes.set(item.id, { ...item.node, x: snapCanvasPosition(xForDepth(depth)), y });
                    }
                });
            });

        return { top, bottom };
    };

    const maxColumnHeight = (columns: LayoutColumns): number => Math.max(
        0,
        ...[...columns.values()].map(columnItems => (columnItems.length - 1) * VERTICAL_GAP),
    );

    const runNode = nodes.find(node => node.system === 'run')
        ?? nodes.find(node => node.system === 'function' && !node.scopeId);
    const terminateNode = nodes.find(node => node.system === 'terminate');
    const runNodeId = runNode?.id;
    const terminateNodeId = terminateNode?.id;
    const runY = runNode?.y ?? RUN_Y;
    const terminateY = terminateNode?.y ?? runY;
    // Layers nodes by their longest path from the roots so a node always lands to
    // the right of every parent feeding it. Using the shortest path instead would
    // leave a node in the same column as one of its parents (for example a node
    // fed by both an If/Else branch and by a node on the other branch), which
    // forces the edge to travel backwards and draw a serpentine. Back edges found
    // during the DFS are skipped so loops do not push depths forever.
    const collectLongestPathDepths = (rootIds: string[], canVisit: (nodeId: string) => boolean) => {
        const depthById = new Map<string, number>();
        const rootIdSet = new Set(rootIds);
        const visitable = (nodeId: string) => !rootIdSet.has(nodeId) && canVisit(nodeId);
        const state = new Map<string, 'visiting' | 'done'>();
        const backEdges = new Set<string>();
        const finishOrder: string[] = [];

        const visit = (startId: string) => {
            const stack: Array<{ id: string; children: string[]; nextIndex: number }> = [
                { id: startId, children: (outgoing.get(startId) ?? []).filter(visitable), nextIndex: 0 },
            ];
            state.set(startId, 'visiting');

            while (stack.length > 0) {
                const frame = stack[stack.length - 1];

                if (frame.nextIndex >= frame.children.length) {
                    state.set(frame.id, 'done');
                    finishOrder.push(frame.id);
                    stack.pop();
                    continue;
                }

                const childId = frame.children[frame.nextIndex];
                frame.nextIndex += 1;
                const childState = state.get(childId);

                if (childState === 'visiting') {
                    backEdges.add(`${frame.id}->${childId}`);
                } else if (childState === undefined) {
                    state.set(childId, 'visiting');
                    stack.push({ id: childId, children: (outgoing.get(childId) ?? []).filter(visitable), nextIndex: 0 });
                }
            }
        };

        rootIds.forEach(rootId => {
            if (!state.has(rootId)) visit(rootId);
        });

        rootIds.forEach(rootId => depthById.set(rootId, 0));
        finishOrder.reverse().forEach(nodeId => {
            const depth = depthById.get(nodeId);
            if (depth === undefined) return;

            (outgoing.get(nodeId) ?? []).forEach(nextId => {
                if (!visitable(nextId) || backEdges.has(`${nodeId}->${nextId}`)) return;
                const knownDepth = depthById.get(nextId);
                if (knownDepth === undefined || depth + 1 > knownDepth) depthById.set(nextId, depth + 1);
            });
        });

        return depthById;
    };

    const collectDepthsFromRoot = (rootNodeId: string | undefined, blockedNodeIds = new Set<string>()) => {
        if (!rootNodeId) return new Map<string, number>();

        return collectLongestPathDepths([rootNodeId], nextId => {
            const nextNode = nodeById.get(nextId);
            return Boolean(nextNode) && !nextNode?.system && !blockedNodeIds.has(nextId);
        });
    };

    const finallyDepthById = collectDepthsFromRoot(terminateNodeId);
    const finallyNodeIds = new Set(editableNodes.filter(node => finallyDepthById.has(node.id)).map(node => node.id));
    const depthById = collectDepthsFromRoot(runNodeId, finallyNodeIds);
    const reachableEditableNodes = editableNodes.filter(node => depthById.has(node.id));
    const finallyEditableNodes = editableNodes.filter(node => finallyDepthById.has(node.id));
    const arrangedEditableById = new Map<string, CanvasNode>();
    const arrangedEditableYById = new Map<string, number>();
    const mainColumnX = (depth: number) => FIRST_COLUMN_X + (depth - 1) * HORIZONTAL_GAP;

    arrangeLayoutColumns(buildLayoutColumns(reachableEditableNodes, depthById), runY, mainColumnX, arrangedEditableById, arrangedEditableYById);
    arrangeLayoutColumns(buildLayoutColumns(finallyEditableNodes, finallyDepthById), terminateY, mainColumnX, arrangedEditableById, arrangedEditableYById);

    const isolatedNodes = editableNodes.filter(node => !depthById.has(node.id) && !finallyDepthById.has(node.id));
    const arrangedMainNodes = [...arrangedEditableById.values()];
    const mainBottomY = Math.max(terminateY, runY, ...arrangedMainNodes.map(node => node.y));
    const isolatedNodeIds = new Set(isolatedNodes.map(node => node.id));
    const visitedIsolatedNodeIds = new Set<string>();
    const isolatedComponents: CanvasNode[][] = [];

    const connectedIsolatedNodeIds = (nodeId: string) => [
        ...(outgoing.get(nodeId) ?? []),
        ...(incoming.get(nodeId) ?? []),
    ].filter(nextId => isolatedNodeIds.has(nextId));

    isolatedNodes.forEach(node => {
        if (visitedIsolatedNodeIds.has(node.id)) return;

        const componentIds: string[] = [];
        const componentQueue = [node.id];
        visitedIsolatedNodeIds.add(node.id);

        while (componentQueue.length > 0) {
            const currentId = componentQueue.shift();
            if (!currentId) continue;
            componentIds.push(currentId);

            connectedIsolatedNodeIds(currentId).forEach(nextId => {
                if (visitedIsolatedNodeIds.has(nextId)) return;
                visitedIsolatedNodeIds.add(nextId);
                componentQueue.push(nextId);
            });
        }

        isolatedComponents.push(componentIds.flatMap(id => {
            const componentNode = nodeById.get(id);
            return componentNode && !componentNode.system ? [componentNode] : [];
        }));
    });

    let isolatedBottomY = mainBottomY;
    isolatedComponents
        .sort((a, b) => {
            const aTop = Math.min(...a.map(node => node.y));
            const bTop = Math.min(...b.map(node => node.y));
            if (aTop !== bTop) return aTop - bTop;
            return Math.min(...a.map(node => node.x)) - Math.min(...b.map(node => node.x));
        })
        .forEach(component => {
            const componentIds = new Set(component.map(node => node.id));
            const roots = component.filter(node => !(incoming.get(node.id) ?? []).some(parentId => componentIds.has(parentId)));
            const componentRootIds = (roots.length > 0 ? roots : [...component].sort((a, b) => a.x - b.x)).map(node => node.id);
            const componentDepthById = collectLongestPathDepths(componentRootIds, nextId => componentIds.has(nextId));

            component.forEach(node => {
                if (!componentDepthById.has(node.id)) componentDepthById.set(node.id, 0);
            });

            const componentLayout = buildLayoutColumns(component, componentDepthById);
            const isolatedLineY = snapCanvasPosition(isolatedBottomY + VERTICAL_GAP + maxColumnHeight(componentLayout) / 2);

            const { bottom } = arrangeLayoutColumns(
                componentLayout,
                isolatedLineY,
                depth => SYSTEM_X + depth * HORIZONTAL_GAP,
                arrangedEditableById,
                arrangedEditableYById,
            );

            isolatedBottomY = bottom;
        });

    const localArrangedById = new Map<string, CanvasNode>();
    const mainTopY = Math.min(runY, ...arrangedMainNodes.map(node => node.y));
    let localFunctionsBottomY = mainTopY - VERTICAL_GAP;
    nodes
        .filter(node => node.system === 'function' && node.scopeId)
        .sort((a, b) => b.y - a.y || a.x - b.x || a.id.localeCompare(b.id))
        .forEach(functionNode => {
            const scopeId = functionNode.scopeId!;
            const scopeNodes = nodes.filter(node => node.scopeId === scopeId);
            const scopeNodeIds = new Set(scopeNodes.map(node => node.id));
            const depthById = collectLongestPathDepths([functionNode.id], targetId => scopeNodeIds.has(targetId));
            const scopeLayout = buildLayoutColumns(
                scopeNodes.filter(node => !node.system && node.kind !== 'stickyNote'),
                depthById,
            );
            const functionY = snapCanvasPosition(localFunctionsBottomY - maxColumnHeight(scopeLayout) / 2);
            localArrangedById.set(functionNode.id, {
                ...functionNode,
                x: SYSTEM_X,
                y: functionY,
            });
            const { top } = arrangeLayoutColumns(
                scopeLayout,
                functionY,
                depth => SYSTEM_X + depth * HORIZONTAL_GAP,
                localArrangedById,
                new Map([[functionNode.id, functionY]]),
            );
            localFunctionsBottomY = top - VERTICAL_GAP;
        });

    return nodes.map(node => {
        if (node.system === 'run' || (node.system === 'function' && !node.scopeId)) {
            return { ...node, x: SYSTEM_RUN_POSITION.x, y: runY };
        }

        if (node.system === 'terminate') {
            return { ...node, x: SYSTEM_TERMINATE_POSITION.x, y: terminateY };
        }

        return localArrangedById.get(node.id) ?? arrangedEditableById.get(node.id) ?? node;
    });
};

// Nodes the selection layout can move: sticky notes and system nodes are ignored.
export const arrangeableSelection = (
    nodes: CanvasNode[],
    selectedNodeIds: Set<string>,
): CanvasNode[] => nodes.filter(node => (
    selectedNodeIds.has(node.id)
    && !node.system
    && node.kind !== 'stickyNote'
));

// Reorganizing a single node is a no-op, so the selection layout only applies from two nodes.
export const canArrangeSelection = (
    nodes: CanvasNode[],
    selectedNodeIds: Set<string>,
): boolean => selectedNodeIds.size > 1 && arrangeableSelection(nodes, selectedNodeIds).length > 1;

export const arrangeGraphSelection = (
    nodes: CanvasNode[],
    edges: CanvasEdge[],
    selectedNodeIds: Set<string>,
): CanvasNode[] => {
    const selectedNodes = arrangeableSelection(nodes, selectedNodeIds);
    if (selectedNodes.length === 0) return nodes;

    const selectedIds = new Set(selectedNodes.map(node => node.id));
    const selectedEdges = edges.filter(edge => (
        selectedIds.has(edge.sourceNodeId) && selectedIds.has(edge.targetNodeId)
    ));
    const layoutNodes = selectedNodes.map(node => ({
        ...node,
        system: undefined,
        scopeId: undefined,
    }));
    const arrangedSelection = arrangeGraph(layoutNodes, selectedEdges);
    const previousCenter = getNodesCenter(selectedNodes);
    const arrangedCenter = getNodesCenter(arrangedSelection);
    // Snap the shift, not each node, so the relative positions computed by the
    // layout survive the move back to the selection's original center.
    const offset = {
        x: snapCanvasPosition(previousCenter.x - arrangedCenter.x),
        y: snapCanvasPosition(previousCenter.y - arrangedCenter.y),
    };
    const arrangedById = new Map(arrangedSelection.map(node => [
        node.id,
        {
            x: node.x + offset.x,
            y: node.y + offset.y,
        },
    ]));

    return nodes.map(node => {
        const arrangedPosition = arrangedById.get(node.id);
        return arrangedPosition ? { ...node, ...arrangedPosition } : node;
    });
};
