import { useCallback, useEffect, useMemo, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { runLineDecorationExtension } from '@/Shared/CodeEditor/extensions/runLineDecorationExtension';
import { getDisplayCodeSnapshotWithLineMap } from '@/Domains/Flow/Pages/FlowEditor/Modals/RunDetailModal/runProgress';
import { getExpandedStatementLines } from '../utils';

interface UseCanvasCodePreviewEditorOptions {
    generatedCode: string;
    codeSnapshot?: string | null;
    activeLine?: number | null;
    passedLines?: Set<number> | number[];
    errorLine?: number | null;
}

// Prepares the read-only canvas code preview and its execution-line decorations.
export const useCanvasCodePreviewEditor = ({
    generatedCode,
    codeSnapshot,
    activeLine = null,
    passedLines = [],
    errorLine = null,
}: UseCanvasCodePreviewEditorOptions) => {
    const displaySnapshot = useMemo(() => {
        if (codeSnapshot) return getDisplayCodeSnapshotWithLineMap(codeSnapshot);

        return {
            code: generatedCode,
            lineMap: new Map(generatedCode.split('\n').map((_, index) => [index + 1, index + 1])),
        };
    }, [codeSnapshot, generatedCode]);
    const passedLineValues = useMemo(() => Array.from(passedLines), [passedLines]);
    const displayActiveLine = activeLine != null ? displaySnapshot.lineMap.get(activeLine) ?? null : null;
    const displayErrorLine = errorLine != null ? displaySnapshot.lineMap.get(errorLine) ?? null : null;
    const displayActiveLines = useMemo(
        () => displayActiveLine != null ? getExpandedStatementLines(displaySnapshot.code, [displayActiveLine]) : [],
        [displayActiveLine, displaySnapshot.code],
    );
    const displayErrorLines = useMemo(
        () => displayErrorLine != null ? getExpandedStatementLines(displaySnapshot.code, [displayErrorLine]) : [],
        [displayErrorLine, displaySnapshot.code],
    );
    const displayPassedLines = useMemo(
        () => getExpandedStatementLines(displaySnapshot.code, passedLineValues
            .map(line => displaySnapshot.lineMap.get(line))
            .filter((line): line is number => typeof line === 'number' && line !== displayErrorLine)),
        [displayErrorLine, displaySnapshot.code, displaySnapshot.lineMap, passedLineValues],
    );
    const extensions = useMemo(() => [runLineDecorationExtension(displaySnapshot.code, {
        passed: displayPassedLines,
        active: displayActiveLines,
        error: displayErrorLines,
    })], [displayActiveLines, displayErrorLines, displayPassedLines, displaySnapshot.code]);
    const viewRef = useRef<EditorView | null>(null);
    const revealCurrentLine = useCallback((view: EditorView) => {
        const line = displayErrorLine ?? displayActiveLine;
        if (!line || line > view.state.doc.lines) return;
        view.dispatch({
            effects: EditorView.scrollIntoView(view.state.doc.line(line).from, { y: 'center' }),
        });
    }, [displayActiveLine, displayErrorLine]);
    const handleCodeMount = useCallback((view: EditorView) => {
        viewRef.current = view;
        revealCurrentLine(view);
    }, [revealCurrentLine]);

    useEffect(() => {
        if (viewRef.current) revealCurrentLine(viewRef.current);
    }, [revealCurrentLine]);

    return {
        displayCode: displaySnapshot.code,
        extensions,
        handleCodeMount,
    };
};
