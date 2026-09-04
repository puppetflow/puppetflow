import { useCallback, useMemo } from 'react';
import { useThemeMode } from '@/App/Hooks/useThemeMode';
import type { Flow } from '@/Domains/Flow/types';
import {
    normalizeNodalFunctionGraph,
    normalizeNodalGraph,
} from '@/Domains/Flow/Pages/FlowEditor/nodalCompiler';
import NodalEditorPane from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodalEditorPane';
import type { NodalGraph, NodalGraphContext } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import CodeSnapshotEditor from '@/Domains/Flow/Pages/FlowEditor/Modals/RunDetailModal/CodePane/components/CodeSnapshotEditor/CodeSnapshotEditor';
import NodalSnapshotFrame from '@/Domains/Flow/Pages/FlowEditor/Modals/RunDetailModal/CodePane/components/NodalSnapshotFrame/NodalSnapshotFrame';
import type { ParsedFlowFile } from '@/Domains/Flow/Pages/FlowImportModal/utils';
import * as S from './styled';

export interface FlowPreviewSource {
    flowType: 'code' | 'nodal';
    code: string;
    nodalGraph: NodalGraph | null;
    graphContext?: NodalGraphContext;
    documentExtension?: string;
}

type Props =
    | { parsedFile: ParsedFlowFile; source?: never }
    | { parsedFile?: never; source: FlowPreviewSource };

export default function FlowPreview({ parsedFile, source }: Props) {
    const { resolved } = useThemeMode();
    const preview = source ?? {
        ...parsedFile,
        nodalGraph: parsedFile.nodalGraph as unknown as NodalGraph | null,
    };
    const graph = useMemo(
        () => preview.nodalGraph
            ? preview.graphContext === 'function'
                ? normalizeNodalFunctionGraph(preview.nodalGraph)
                : normalizeNodalGraph(preview.nodalGraph)
            : null,
        [preview.graphContext, preview.nodalGraph],
    );
    const previewFlow = useMemo(() => ({
        id: 'flow-import-preview',
        name: 'Imported Flow',
        default_inputs: null,
        latest_run: null,
        flow_type: 'nodal',
        nodal_graph: graph,
        is_published: false,
        // Previews have no flow setting: show the whole imported graph, FINALLY included.
        finally_enabled: true,
    } as Flow), [graph]);
    const ignoreGraphChange = useCallback(() => {}, []);

    return (
        <S.Preview>
            <S.PreviewContent>
                {preview.flowType === 'nodal' && graph ? (
                    <NodalSnapshotFrame>
                        <NodalEditorPane
                            flow={previewFlow}
                            graph={graph}
                            saved
                            readOnly
                            hideToolbar
                            graphContext={preview.graphContext}
                            documentExtension={preview.documentExtension}
                            onGraphChange={ignoreGraphChange}
                        />
                    </NodalSnapshotFrame>
                ) : (
                    <CodeSnapshotEditor
                        code={preview.code}
                        resolvedTheme={resolved}
                        activeLine={null}
                        passedLines={[]}
                    />
                )}
            </S.PreviewContent>
        </S.Preview>
    );
}
