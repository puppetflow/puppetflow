import { useCallback, useState, type MutableRefObject } from 'react';
import type { Flow } from '@/Domains/Flow/types';
import type { NodalGraph } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import {
    FlowInputExportError,
    prepareFlowExport,
    SnippetExportError,
    type FlowExportPackage,
} from '@/Domains/Flow/Pages/FlowEditor/utils/flowExport';

interface UseFlowExportOptions {
    flow: Pick<Flow, 'id' | 'name' | 'description' | 'blueprint_input_definitions'>;
    isNodalFlow: boolean;
    codeRef: MutableRefObject<string>;
    nodalGraphRef: MutableRefObject<NodalGraph>;
    toast: (message: string, variant?: 'success' | 'error' | 'info') => void;
}

// Prepares the current flow definition and opens the export modal to pick bundled resources.
export function useFlowExport({
    flow,
    isNodalFlow,
    codeRef,
    nodalGraphRef,
    toast,
}: UseFlowExportOptions) {
    const [flowExportPackage, setFlowExportPackage] = useState<FlowExportPackage | null>(null);

    const handleDownloadFlow = useCallback(async () => {
        try {
            const pkg = await prepareFlowExport({
                flowId: flow.id,
                name: flow.name,
                description: flow.description,
                isNodalFlow,
                code: codeRef.current,
                nodalGraph: nodalGraphRef.current,
                inputDefinitions: flow.blueprint_input_definitions,
            });
            setFlowExportPackage(pkg);
        } catch (error) {
            if (error instanceof SnippetExportError) {
                toast('Unable to download snippets for this flow.', 'error');
                return;
            }

            if (error instanceof FlowInputExportError) {
                toast(error.message, 'error');
                return;
            }

            throw error;
        }
    }, [
        codeRef,
        flow.blueprint_input_definitions,
        flow.description,
        flow.name,
        flow.id,
        isNodalFlow,
        nodalGraphRef,
        toast,
    ]);

    const closeFlowExport = useCallback(() => setFlowExportPackage(null), []);

    return { handleDownloadFlow, flowExportPackage, closeFlowExport };
}
