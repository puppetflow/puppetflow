import { useCallback, useMemo } from 'react';
import { useThemeMode } from '@/App/Hooks/useThemeMode';
import type { Flow } from '@/Domains/Flow/types';
import { normalizeNodalGraph } from '@/Domains/Flow/Pages/FlowEditor/nodalCompiler';
import NodalEditorPane from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodalEditorPane';
import type { NodalGraph, NodalGraphContext } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import CodeSnapshotEditor from '@/Domains/Flow/Pages/FlowEditor/Modals/RunDetailModal/CodePane/components/CodeSnapshotEditor/CodeSnapshotEditor';
import NodalSnapshotFrame from '@/Domains/Flow/Pages/FlowEditor/Modals/RunDetailModal/CodePane/components/NodalSnapshotFrame/NodalSnapshotFrame';
import { Icon } from '@/Shared/UI/Icon/Icon';
import type { ParsedFlowFile } from '@/Domains/Flow/Pages/FlowImportModal/utils';
import * as S from './styled';

export interface FlowPreviewSource {
    flowType: 'code' | 'nodal';
    code: string;
    nodalGraph: NodalGraph | null;
    graphContext?: NodalGraphContext;
    documentExtension?: string;
    dataTables?: ParsedFlowFile['dataTables'];
    mailboxWatchers?: ParsedFlowFile['mailboxWatchers'];
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
    const dataTables = preview.dataTables ?? [];
    const mailboxWatchers = preview.mailboxWatchers ?? [];
    const graph = useMemo(
        () => preview.nodalGraph
            ? normalizeNodalGraph(preview.nodalGraph)
            : null,
        [preview.nodalGraph],
    );
    const previewFlow = useMemo(() => ({
        id: 'flow-import-preview',
        name: 'Imported Flow',
        default_inputs: null,
        latest_run: null,
        flow_type: 'nodal',
        nodal_graph: graph,
        is_published: false,
    } as Flow), [graph]);
    const ignoreGraphChange = useCallback(() => {}, []);

    return (
        <S.Preview>
            <S.PreviewHeader>
                <S.PreviewHeading>
                    <Icon icon={preview.flowType === 'nodal' ? 'lucide:workflow' : 'lucide:code-2'} />
                    {preview.flowType === 'nodal' ? 'Visual graph' : 'Code preview'}
                </S.PreviewHeading>
                <S.ReadOnlyBadge>Read only</S.ReadOnlyBadge>
            </S.PreviewHeader>
            {(dataTables.length > 0 || mailboxWatchers.length > 0) && (
                <S.ResourceBar>
                    {dataTables.length > 0 && (
                        <S.ResourceSummary>
                            <S.ResourceSummaryTitle>Data Tables</S.ResourceSummaryTitle>
                            <S.ResourceList>
                                {dataTables.map(dataTable => (
                                    <S.ResourceItem key={dataTable.source_id}>
                                        {dataTable.name} - {dataTable.columns.length} column
                                        {dataTable.columns.length === 1 ? '' : 's'}
                                    </S.ResourceItem>
                                ))}
                            </S.ResourceList>
                        </S.ResourceSummary>
                    )}
                    {mailboxWatchers.length > 0 && (
                        <S.ResourceSummary>
                            <S.ResourceSummaryTitle>Mailbox Watchers</S.ResourceSummaryTitle>
                            <S.ResourceList>
                                {mailboxWatchers.map(watcher => (
                                    <S.ResourceItem key={watcher.source_id}>
                                        {watcher.name} - {watcher.mailbox.address}
                                    </S.ResourceItem>
                                ))}
                            </S.ResourceList>
                        </S.ResourceSummary>
                    )}
                </S.ResourceBar>
            )}
            <S.PreviewContent>
                {preview.flowType === 'nodal' && graph ? (
                    <NodalSnapshotFrame>
                        <NodalEditorPane
                            flow={previewFlow}
                            graph={graph}
                            saved
                            readOnly
                            allowShortcutsInModal
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
