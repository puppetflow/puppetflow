import { createContext, useContext, type ReactNode } from 'react';
import type { PreviewSectionProps } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodeConfigModal/components/PreviewSection/PreviewSection';

export interface NodePreviewPanels {
    before: PreviewSectionProps;
    after: PreviewSectionProps;
}

interface NodePreviewProviderProps {
    value: NodePreviewPanels;
    children: ReactNode;
}

const NodePreviewContext = createContext<NodePreviewPanels | null>(null);

export function NodePreviewProvider({ value, children }: NodePreviewProviderProps) {
    return (
        <NodePreviewContext.Provider value={value}>
            {children}
        </NodePreviewContext.Provider>
    );
}

export function useNodePreviewPanels() {
    return useContext(NodePreviewContext);
}
