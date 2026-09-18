// Snap step. Half the visual dot spacing so that side handles, spread by two
// steps (see getPortHandleOffset), always land on a snap position: a node can
// then face any handle of its neighbour exactly, by hand or via auto layout.
export const CANVAS_GRID_SIZE = 12;

export const snapCanvasPosition = (value: number) => Math.round(value / CANVAS_GRID_SIZE) * CANVAS_GRID_SIZE;

export const snapCanvasPoint = <T extends { x: number; y: number }>(point: T): T => ({
    ...point,
    x: snapCanvasPosition(point.x),
    y: snapCanvasPosition(point.y),
});
