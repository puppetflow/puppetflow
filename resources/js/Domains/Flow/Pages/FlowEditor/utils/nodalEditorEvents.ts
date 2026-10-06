export const FOCUS_NODAL_NODE_EVENT = 'puppetflow:focus-nodal-node';

export interface FocusNodalNodeDetail {
    flowId: string;
    nodeId: string;
}

export function dispatchNodalNodeFocus(flowId: unknown, nodeId: string) {
    window.dispatchEvent(new CustomEvent<FocusNodalNodeDetail>(FOCUS_NODAL_NODE_EVENT, {
        detail: {
            flowId: String(flowId),
            nodeId,
        },
    }));
}

export function isFocusNodalNodeEvent(event: Event): event is CustomEvent<FocusNodalNodeDetail> {
    if (!(event instanceof CustomEvent)) return false;
    const detail = event.detail as Partial<FocusNodalNodeDetail> | null;

    return typeof detail?.flowId === 'string' && typeof detail.nodeId === 'string';
}
