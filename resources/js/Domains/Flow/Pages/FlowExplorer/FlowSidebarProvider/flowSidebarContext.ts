import { createContext, useContext } from 'react';
import type { TreeFlow } from '@/Domains/Folder/types';

export interface FlowSidebarActions {
    duplicateFlow: (flow: TreeFlow) => void;
    moveFlow: (flow: TreeFlow) => void;
    deleteFlow: (flow: TreeFlow) => void;
    visibilityFlow: (flow: TreeFlow) => void;
    canEditFlow: (flow: TreeFlow) => boolean;
}

export const FlowSidebarContext = createContext<FlowSidebarActions | null>(null);

// Gives flow rows in the explorer tree access to flow specific actions.
export function useFlowSidebarActions(): FlowSidebarActions {
    const context = useContext(FlowSidebarContext);
    if (!context) {
        throw new Error('Flow rows must be rendered inside FlowSidebarProvider.');
    }
    return context;
}
