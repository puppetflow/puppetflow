import { NODE_CARD_WIDTH, NODE_PORT_Y_OFFSET, getPortHandleOffset } from './constants';
import { DEFAULT_INPUT_PORT, DEFAULT_OUTPUT_PORT, getNodeInputPorts, getNodeOutputPorts } from './constants';
import type { CanvasNode, NodePortKind, NodePortSide, Point } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';

const BACKWARD_EDGE_HORIZONTAL_CLEARANCE = 48;
const BACKWARD_EDGE_MIN_VERTICAL_SPREAD = 48;
const BACKWARD_EDGE_CORNER_RADIUS = 16;

const getPortOffset = (ports: { id: string }[], portId: string) => {
    const index = Math.max(0, ports.findIndex(port => port.id === portId));
    return getPortHandleOffset(index, ports.length);
};

// Vertical distance between the node center line and a left/right handle,
// excluding NODE_PORT_Y_OFFSET which is shared by every side handle. Returns 0
// for unknown ports and for top/bottom handles.
export const getSidePortVerticalOffset = (node: CanvasNode, port: NodePortKind, side: NodePortSide): number => {
    const ports = side === 'input' ? getNodeInputPorts(node.entry.name) : getNodeOutputPorts(node.entry.name, node.entry);
    const definition = ports.find(candidate => candidate.id === port);
    const position = definition?.position ?? (side === 'input' ? 'left' : 'right');
    if (!definition || position === 'top' || position === 'bottom') return 0;

    const positionedPorts = ports.filter(candidate => (
        (candidate.position ?? (candidate.side === 'input' ? 'left' : 'right')) === position
    ));

    return getPortOffset(positionedPorts, port);
};

const isBackwardEdge = (start: Point, end: Point) => end.x <= start.x;

export const getPointDistance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const moveToward = (from: Point, to: Point, distance: number): Point => {
    const totalDistance = getPointDistance(from, to);
    if (totalDistance === 0) return from;

    return {
        x: from.x + ((to.x - from.x) / totalDistance) * distance,
        y: from.y + ((to.y - from.y) / totalDistance) * distance,
    };
};

const getRoundedOrthogonalPath = (points: Point[], radius: number) => {
    if (points.length === 0) return '';

    const commands = [`M ${points[0].x} ${points[0].y}`];

    for (let i = 1; i < points.length - 1; i++) {
        const previous = points[i - 1];
        const current = points[i];
        const next = points[i + 1];
        const cornerRadius = Math.min(
            radius,
            getPointDistance(current, previous) * 0.5,
            getPointDistance(current, next) * 0.5,
        );

        if (cornerRadius <= 0) {
            commands.push(`L ${current.x} ${current.y}`);
            continue;
        }

        const beforeCorner = moveToward(current, previous, cornerRadius);
        const afterCorner = moveToward(current, next, cornerRadius);

        commands.push(
            `L ${beforeCorner.x} ${beforeCorner.y}`,
            `Q ${current.x} ${current.y} ${afterCorner.x} ${afterCorner.y}`,
        );
    }

    const last = points[points.length - 1];
    commands.push(`L ${last.x} ${last.y}`);

    return commands.join(' ');
};

const getBackwardEdgeOrthogonalCurve = (start: Point, end: Point) => {
    const exitX = start.x + BACKWARD_EDGE_HORIZONTAL_CLEARANCE;
    const entryX = end.x - BACKWARD_EDGE_HORIZONTAL_CLEARANCE;
    const verticalDistance = Math.abs(end.y - start.y);
    const verticalDirection = end.y >= start.y ? 1 : -1;
    const midY = verticalDistance < BACKWARD_EDGE_MIN_VERTICAL_SPREAD
        ? start.y + verticalDirection * BACKWARD_EDGE_MIN_VERTICAL_SPREAD
        : (start.y + end.y) / 2;

    return {
        entryX,
        exitX,
        midY,
        points: [
            start,
            { x: exitX, y: start.y },
            { x: exitX, y: midY },
            { x: entryX, y: midY },
            { x: entryX, y: end.y },
            end,
        ],
    };
};

const getCubicBezierPoint = (start: Point, controlA: Point, controlB: Point, end: Point, t: number): Point => {
    const inverseT = 1 - t;
    const inverseT2 = inverseT * inverseT;
    const t2 = t * t;

    return {
        x: inverseT2 * inverseT * start.x
            + 3 * inverseT2 * t * controlA.x
            + 3 * inverseT * t2 * controlB.x
            + t2 * t * end.x,
        y: inverseT2 * inverseT * start.y
            + 3 * inverseT2 * t * controlA.y
            + 3 * inverseT * t2 * controlB.y
            + t2 * t * end.y,
    };
};

export const getPortPosition = (
    node: CanvasNode,
    port: NodePortKind = DEFAULT_OUTPUT_PORT,
    side: NodePortSide = port === DEFAULT_INPUT_PORT ? 'input' : 'output',
) => {
    const ports = side === 'input' ? getNodeInputPorts(node.entry.name) : getNodeOutputPorts(node.entry.name, node.entry);
    const definition = ports.find(candidate => candidate.id === port);
    const position = definition?.position ?? (side === 'input' ? 'left' : 'right');
    const positionedPorts = ports.filter(candidate => (
        (candidate.position ?? (candidate.side === 'input' ? 'left' : 'right')) === position
    ));
    const offset = getPortOffset(positionedPorts, port);

    if (position === 'top' || position === 'bottom') {
        return {
            x: node.x + offset,
            y: node.y + (position === 'top' ? -NODE_CARD_WIDTH / 2 : NODE_CARD_WIDTH / 2),
        };
    }

    return {
        x: node.x + (side === 'input' ? -NODE_CARD_WIDTH / 2 : NODE_CARD_WIDTH / 2),
        y: node.y + NODE_PORT_Y_OFFSET + offset,
    };
};

export const getEdgePath = (start: Point, end: Point) => {
    if (isBackwardEdge(start, end)) {
        const { points } = getBackwardEdgeOrthogonalCurve(start, end);

        return getRoundedOrthogonalPath(points, BACKWARD_EDGE_CORNER_RADIUS);
    }

    const distance = Math.abs(end.x - start.x);
    const control = distance * 0.5;

    return `M ${start.x} ${start.y} C ${start.x + control} ${start.y}, ${end.x - control} ${end.y}, ${end.x} ${end.y}`;
};

export const getBranchEdgePath = (start: Point, end: Point) => {
    const distance = getPointDistance(start, end);
    if (distance < 1) return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;

    const bend = Math.min(40, distance * 0.12);
    const approach = Math.min(24, distance * 0.15);
    const startExit = { x: start.x, y: start.y - approach };
    const endEntry = { x: end.x, y: end.y + approach };
    const midpointX = (startExit.x + endEntry.x) / 2;
    const midpointY = (startExit.y + endEntry.y) / 2;

    return [
        `M ${start.x} ${start.y}`,
        `L ${startExit.x} ${startExit.y}`,
        `Q ${midpointX} ${midpointY - bend}, ${endEntry.x} ${endEntry.y}`,
        `L ${end.x} ${end.y}`,
    ].join(' ');
};

export const getPendingEdgePath = (start: Point, end: Point, fromSide: NodePortSide) => {
    const dragDistance = getPointDistance(start, end);
    if (dragDistance < 1) return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;

    const direction = fromSide === 'input' ? -1 : 1;
    const outwardDistance = direction * (end.x - start.x);
    if (outwardDistance <= 0 || dragDistance < 24) {
        return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    }

    const control = Math.min(Math.max(outwardDistance * 0.5, 24), dragDistance * 0.8);

    return `M ${start.x} ${start.y} C ${start.x + direction * control} ${start.y}, ${end.x - direction * control} ${end.y}, ${end.x} ${end.y}`;
};

export const getEdgePolyline = (start: Point, end: Point) => {
    if (isBackwardEdge(start, end)) {
        return getBackwardEdgeOrthogonalCurve(start, end).points;
    }

    const distance = Math.abs(end.x - start.x);
    const control = distance * 0.5;
    const controlA = { x: start.x + control, y: start.y };
    const controlB = { x: end.x - control, y: end.y };

    return Array.from({ length: 25 }, (_, index) => {
        return getCubicBezierPoint(start, controlA, controlB, end, index / 24);
    });
};

export const getEdgeMidpoint = (start: Point, end: Point) => {
    if (isBackwardEdge(start, end)) {
        const { entryX, exitX, midY } = getBackwardEdgeOrthogonalCurve(start, end);

        return {
            x: (exitX + entryX) / 2,
            y: midY,
        };
    }

    return {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
    };
};

export const getKnifePath = (points: Point[]): string => {
    if (points.length === 0) return '';
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
};

const crossProduct = (a: Point, b: Point, c: Point): number => {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
};

const isPointOnSegment = (point: Point, segmentStart: Point, segmentEnd: Point): boolean => {
    const minX = Math.min(segmentStart.x, segmentEnd.x);
    const maxX = Math.max(segmentStart.x, segmentEnd.x);
    const minY = Math.min(segmentStart.y, segmentEnd.y);
    const maxY = Math.max(segmentStart.y, segmentEnd.y);

    return Math.abs(crossProduct(segmentStart, segmentEnd, point)) < 0.001
        && point.x >= minX - 0.001
        && point.x <= maxX + 0.001
        && point.y >= minY - 0.001
        && point.y <= maxY + 0.001;
};

const segmentsIntersect = (a: Point, b: Point, c: Point, d: Point): boolean => {
    const abC = crossProduct(a, b, c);
    const abD = crossProduct(a, b, d);
    const cdA = crossProduct(c, d, a);
    const cdB = crossProduct(c, d, b);

    if (
        ((abC > 0 && abD < 0) || (abC < 0 && abD > 0))
        && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))
    ) {
        return true;
    }

    return (Math.abs(abC) < 0.001 && isPointOnSegment(c, a, b))
        || (Math.abs(abD) < 0.001 && isPointOnSegment(d, a, b))
        || (Math.abs(cdA) < 0.001 && isPointOnSegment(a, c, d))
        || (Math.abs(cdB) < 0.001 && isPointOnSegment(b, c, d));
};

const getPointToSegmentDistance = (point: Point, segmentStart: Point, segmentEnd: Point): number => {
    const dx = segmentEnd.x - segmentStart.x;
    const dy = segmentEnd.y - segmentStart.y;
    if (dx === 0 && dy === 0) return getPointDistance(point, segmentStart);

    const t = Math.max(0, Math.min(1, ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) / (dx * dx + dy * dy)));
    const projection = {
        x: segmentStart.x + t * dx,
        y: segmentStart.y + t * dy,
    };

    return getPointDistance(point, projection);
};

export const getPointToPolylineDistance = (point: Point, polyline: Point[]): number => {
    if (polyline.length === 0) return Number.POSITIVE_INFINITY;
    if (polyline.length === 1) return getPointDistance(point, polyline[0]);

    return Math.min(...polyline.slice(0, -1).map((segmentStart, index) => {
        return getPointToSegmentDistance(point, segmentStart, polyline[index + 1]);
    }));
};

const segmentsAreNear = (a: Point, b: Point, c: Point, d: Point, tolerance: number): boolean => {
    return getPointToSegmentDistance(a, c, d) <= tolerance
        || getPointToSegmentDistance(b, c, d) <= tolerance
        || getPointToSegmentDistance(c, a, b) <= tolerance
        || getPointToSegmentDistance(d, a, b) <= tolerance;
};

export const polylinesIntersect = (a: Point[], b: Point[], tolerance: number): boolean => {
    if (a.length < 2 || b.length < 2) return false;

    return a.slice(0, -1).some((aStart, aIndex) => {
        const aEnd = a[aIndex + 1];
        return b.slice(0, -1).some((bStart, bIndex) => {
            const bEnd = b[bIndex + 1];
            return segmentsIntersect(aStart, aEnd, bStart, bEnd)
                || segmentsAreNear(aStart, aEnd, bStart, bEnd, tolerance);
        });
    });
};
