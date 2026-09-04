import { useCallback, useEffect, useMemo, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { runLineDecorationExtension } from '@/Shared/CodeEditor/extensions/runLineDecorationExtension';
import { getDisplayCodeSnapshotWithLineMap } from '@/Domains/Flow/Pages/FlowEditor/Modals/RunDetailModal/runProgress';
import type { CodeSnapshotEditorProps } from './types';
import { getExpandedStatementLines } from './utils';

// Configures the run snapshot editor and decorates active, passed, and failed lines.
export function useCodeSnapshotEditor({
    runId,
    code,
    activeLine,
    passedLines,
    errorLine = null,
}: Pick<
    CodeSnapshotEditorProps,
    'runId' | 'code' | 'activeLine' | 'passedLines' | 'errorLine'
>) {
    const displaySnapshot = useMemo(
        () => getDisplayCodeSnapshotWithLineMap(code),
        [code],
    );
    const displayActiveLine = activeLine != null
        ? displaySnapshot.lineMap.get(activeLine) ?? null
        : null;
    const displayErrorLine = errorLine != null
        ? displaySnapshot.lineMap.get(errorLine) ?? null
        : null;
    const activeLines = useMemo(
        () => displayActiveLine != null
            ? getExpandedStatementLines(displaySnapshot.code, [displayActiveLine])
            : [],
        [displayActiveLine, displaySnapshot.code],
    );
    const errorLines = useMemo(
        () => displayErrorLine != null
            ? getExpandedStatementLines(displaySnapshot.code, [displayErrorLine])
            : [],
        [displayErrorLine, displaySnapshot.code],
    );
    const completedLines = useMemo(
        () => getExpandedStatementLines(
            displaySnapshot.code,
            passedLines
                .map(line => displaySnapshot.lineMap.get(line))
                .filter((line): line is number =>
                    line != null && line !== displayErrorLine),
        ),
        [
            displayErrorLine,
            displaySnapshot.code,
            displaySnapshot.lineMap,
            passedLines,
        ],
    );
    const extensions = useMemo(() => [runLineDecorationExtension(displaySnapshot.code, {
        passed: completedLines,
        active: activeLines,
        error: errorLines,
    })], [
        activeLines,
        completedLines,
        displaySnapshot.code,
        errorLines,
    ]);
    const viewRef = useRef<EditorView | null>(null);
    const revealedRunRef = useRef<number | undefined>(undefined);
    const revealCurrentLine = useCallback((view: EditorView) => {
        const line = displayErrorLine ?? displayActiveLine;
        if (!line || line > view.state.doc.lines) return false;
        view.dispatch({
            effects: EditorView.scrollIntoView(view.state.doc.line(line).from, { y: 'center' }),
        });
        return true;
    }, [displayActiveLine, displayErrorLine]);
    const handleMount = useCallback((view: EditorView) => {
        viewRef.current = view;
        if (revealCurrentLine(view)) revealedRunRef.current = runId;
    }, [revealCurrentLine, runId]);

    useEffect(() => {
        const view = viewRef.current;
        if (!view || (runId !== undefined && revealedRunRef.current === runId)) return;
        if (revealCurrentLine(view)) revealedRunRef.current = runId;
    }, [revealCurrentLine, runId]);

    return {
        displayCode: displaySnapshot.code,
        extensions,
        handleMount,
    };
}
