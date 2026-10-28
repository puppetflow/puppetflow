export interface CodeSnapshotEditorProps {
    runId?: number;
    flowId?: Id;
    code: string;
    resolvedTheme: string;
    activeLine: number | null;
    passedLines: number[];
    errorLine?: number | null;
    flatBottom?: boolean;
}
