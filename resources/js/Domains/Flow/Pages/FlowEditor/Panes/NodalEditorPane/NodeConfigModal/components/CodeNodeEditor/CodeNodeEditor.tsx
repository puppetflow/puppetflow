import { useCallback, useEffect, useRef, type DragEvent } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useSyncMonacoValue } from '@/Shared/CodeEditor/hooks/useSyncMonacoValue';
import { useThemeMode } from '@/App/Hooks/useThemeMode';
import { registerAiModelCompletions } from '@/Domains/Flow/Pages/FlowEditor/utils/aiModelSuggestions';
import { registerChannelCompletions } from '@/Domains/Flow/Pages/FlowEditor/utils/channelSuggestions';
import { registerCookieProfileCompletions } from '@/Domains/Flow/Pages/FlowEditor/utils/cookieJarSuggestions';
import { registerDataTableCompletions } from '@/Domains/Flow/Pages/FlowEditor/utils/dataTableSuggestions';
import { registerMediaAssetCompletions } from '@/Domains/Flow/Pages/FlowEditor/utils/mediaAssetSuggestions';
import { registerCompletions } from '@/Domains/Flow/Pages/FlowEditor/utils/monacoBase';
import { registerNodalAutocompleteCompletions } from '@/Domains/Flow/Pages/FlowEditor/utils/inputCompletions';
import { registerReferenceLabelDecorations } from '@/Domains/Flow/Pages/FlowEditor/utils/referenceLabelDecorations';
import { registerSnippetCompletions } from '@/Domains/Flow/Pages/FlowEditor/utils/snippetSuggestions';
import { registerSniffProfileCompletions } from '@/Domains/Flow/Pages/FlowEditor/utils/sniffProfileSuggestions';
import { registerStopwatchNameCompletions } from '@/Domains/Flow/Pages/FlowEditor/utils/stopwatchNameSuggestions';
import { registerVarsCompletions } from '@/Domains/Flow/Pages/FlowEditor/utils/variableSuggestions';
import { registerTabNameCompletions } from '@/Domains/Flow/Pages/FlowEditor/utils/tabNameSuggestions';
import type { NodalAutocompleteContext } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/staticAnalysis';
import type { NodeValidationIssue } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/validation';
import * as S from './styled';

const CODE_SYNTAX_MARKER_OWNER = 'puppetflow-code-node-syntax';

const CODE_NODE_EDITOR_OPTIONS = {
    minimap: { enabled: false },
    fontSize: 12,
    lineHeight: 19,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    scrollBeyondLastLine: false,
    automaticLayout: true,
    wordWrap: 'on' as const,
    padding: { top: 10, bottom: 10 },
    fixedOverflowWidgets: true,
    contextmenu: false,
    // Monaco's drop handler runs dropped text through its snippet escaper ("\$run...$0").
    // Drops from the data inspector are inserted verbatim by the wrapper below instead.
    dropIntoEditor: { enabled: false },
    bracketPairColorization: { enabled: true },
    wordBasedSuggestions: 'off' as const,
    quickSuggestions: { strings: true, other: true, comments: false },
    suggestOnTriggerCharacters: true,
    suggest: {
        showFiles: false,
        showWords: false,
    },
};

interface CodeNodeEditorProps {
    value: string;
    outputData: unknown;
    autocompleteContext: NodalAutocompleteContext;
    validationIssue?: NodeValidationIssue;
    flowId?: Id;
    readOnly?: boolean;
    onChange: (value: string) => void;
}

export default function CodeNodeEditor({
    value,
    outputData,
    autocompleteContext,
    validationIssue,
    flowId,
    readOnly,
    onChange,
}: CodeNodeEditorProps) {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
    const completionDisposablesRef = useRef<{ dispose: () => void }[]>([]);
    const isInternalChangeRef = useRef(false);
    const { resolved: theme } = useThemeMode();
    useSyncMonacoValue(editorRef, value, { isInternalChange: isInternalChangeRef });

    useEffect(() => () => {
        completionDisposablesRef.current.forEach(item => item.dispose());
        completionDisposablesRef.current = [];
        const model = editorRef.current?.getModel();
        if (model && monacoRef.current) {
            monacoRef.current.editor.setModelMarkers(model, CODE_SYNTAX_MARKER_OWNER, []);
        }
    }, []);

    const updateSyntaxMarker = useCallback((
        editorInstance: editor.IStandaloneCodeEditor,
        monaco: Parameters<OnMount>[1],
    ) => {
        const model = editorInstance.getModel();
        if (!model) return;
        if (!validationIssue?.line || !validationIssue.column) {
            monaco.editor.setModelMarkers(model, CODE_SYNTAX_MARKER_OWNER, []);
            return;
        }

        const line = Math.min(validationIssue.line, model.getLineCount());
        const maxColumn = model.getLineMaxColumn(line);
        const column = Math.min(validationIssue.column, maxColumn);
        monaco.editor.setModelMarkers(model, CODE_SYNTAX_MARKER_OWNER, [{
            severity: monaco.MarkerSeverity.Error,
            message: validationIssue.message,
            startLineNumber: line,
            startColumn: column,
            endLineNumber: line,
            endColumn: Math.min(column + 1, maxColumn),
        }]);
    }, [validationIssue]);

    const registerEditorCompletions = useCallback((monaco: Parameters<OnMount>[1]) => {
        const modelUri = editorRef.current?.getModel()?.uri.toString() ?? null;
        completionDisposablesRef.current.forEach(item => item.dispose());
        completionDisposablesRef.current = [
            registerCompletions(monaco),
            registerVarsCompletions(monaco, modelUri),
            registerNodalAutocompleteCompletions(monaco, { ...autocompleteContext, outputData }, modelUri),
            registerAiModelCompletions(monaco, modelUri),
            registerChannelCompletions(monaco, modelUri),
            ...(flowId ? [registerDataTableCompletions(monaco, flowId, modelUri)] : []),
            registerMediaAssetCompletions(monaco, modelUri),
            registerSnippetCompletions(monaco, modelUri),
            registerTabNameCompletions(monaco, modelUri, autocompleteContext.tabNames),
            registerStopwatchNameCompletions(monaco, modelUri, autocompleteContext.stopwatchNames),
            registerSniffProfileCompletions(monaco, modelUri, autocompleteContext.sniffProfileNames),
            registerCookieProfileCompletions(monaco, modelUri, autocompleteContext.cookieProfileNames),
        ];
    }, [autocompleteContext, flowId, outputData]);

    useEffect(() => {
        if (!monacoRef.current) return;
        registerEditorCompletions(monacoRef.current);
    }, [registerEditorCompletions]);

    useEffect(() => {
        if (!editorRef.current || !monacoRef.current) return;
        updateSyntaxMarker(editorRef.current, monacoRef.current);
    }, [updateSyntaxMarker]);

    const handleMount: OnMount = (editorInstance, monaco) => {
        editorRef.current = editorInstance;
        monacoRef.current = monaco;
        registerEditorCompletions(monaco);
        registerReferenceLabelDecorations(editorInstance, monaco, { flowId });
        updateSyntaxMarker(editorInstance, monaco);
    };

    const handleChange = useCallback((nextValue: string | undefined) => {
        isInternalChangeRef.current = true;
        onChange(nextValue ?? '');
    }, [onChange]);

    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
        if (readOnly) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const text = event.dataTransfer.getData('text/plain');
        const editorInstance = editorRef.current;
        const model = editorInstance?.getModel();
        if (readOnly || !text || !editorInstance || !model) return;

        const position = editorInstance.getTargetAtClientPoint(event.clientX, event.clientY)?.position
            ?? editorInstance.getPosition()
            ?? model.getFullModelRange().getEndPosition();
        editorInstance.pushUndoStop();
        editorInstance.executeEdits('drop-path', [{
            range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
            },
            text,
        }]);
        editorInstance.pushUndoStop();
        editorInstance.focus();
    };

    return (
        <S.CodeNodeField>
            <S.CodeNodeEditor
                data-invalid={Boolean(validationIssue)}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <Editor
                    height="100%"
                    defaultLanguage="javascript"
                    defaultValue={value}
                    theme={theme === 'dark' ? 'vs-dark' : 'light'}
                    options={{ ...CODE_NODE_EDITOR_OPTIONS, readOnly }}
                    onMount={handleMount}
                    onChange={handleChange}
                />
            </S.CodeNodeEditor>
            {validationIssue && (
                <S.SyntaxError role="alert">{validationIssue.message}</S.SyntaxError>
            )}
            <S.ExpressionHint>
                This code is inserted directly in the generated run function. Use $run for the current input snapshot, $('RUN') for initial run data, $nodes for named snapshots, $vars(…) for workspace variables, and $totp(…) for a fresh TOTP code.
            </S.ExpressionHint>
        </S.CodeNodeField>
    );
}
