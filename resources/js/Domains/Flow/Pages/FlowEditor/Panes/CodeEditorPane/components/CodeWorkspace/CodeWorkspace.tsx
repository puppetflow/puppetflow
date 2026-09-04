import {
    forwardRef,
    useCallback,
    useImperativeHandle,
    useMemo,
    useRef,
} from 'react';
import { keymap, type EditorView } from '@codemirror/view';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { CodeEditor } from '@/Shared/CodeEditor/components/CodeEditor';
import { usePuppetflowCompletions } from '@/Shared/CodeEditor/completion/usePuppetflowCompletions';
import { missingAwaitLineDecorationExtension } from '@/Shared/CodeEditor/extensions/missingAwaitLineDecorationExtension';
import { FloatingHelpButton } from '@/Shared/CodeEditor/shared/editor-layout.styled';
import { usePuppetflowTypeLibraries } from '@/Shared/CodeEditor/typescript/puppetflowTypeLibraries';
import { useTypeScriptSupport } from '@/Shared/CodeEditor/typescript/useTypeScriptSupport';
import { replaceEditorRange } from '@/Shared/CodeEditor/utils/editorActions';
import { useThemeMode } from '@/App/Hooks/useThemeMode';
import { useToast } from '@/App/Hooks/useToast';
import { useGrabber } from '@/Domains/Flow/Pages/FlowEditor/Grabber/GrabberContext';
import { useHelpEntryInsertion } from '@/Domains/Flow/Pages/FlowEditor/hooks/useHelpEntryInsertion';
import type { HelpEntryDef } from '@/Domains/Flow/Pages/FlowEditor/types';
import type { CodeGizmo } from '@/Domains/Flow/Pages/FlowEditor/utils/codeGizmos';
import { getMissingAwaitCalls } from '@/Domains/Flow/Pages/FlowEditor/utils/missingAwaits';
import { useReferenceLabelDecorations } from '@/Domains/Flow/Pages/FlowEditor/utils/referenceLabelDecorations';
import * as S from './styled';

interface CodeWorkspaceProps {
    code: string;
    defaultInputs: Record<string, unknown> | null;
    flowId: Id;
    readOnly: boolean;
    onCodeChange: (value: string | undefined) => void;
    onGizmoClick: (name: string) => void;
    onOpenHelp: () => void;
    onRun?: () => void;
}

export interface CodeWorkspaceHandle {
    insertHelpEntry: (entry: HelpEntryDef) => boolean;
    fixMissingAwaits: () => number;
}

export const CodeWorkspace = forwardRef<CodeWorkspaceHandle, CodeWorkspaceProps>(
    function CodeWorkspace({
        code,
        defaultInputs,
        flowId,
        readOnly,
        onCodeChange,
        onGizmoClick,
        onOpenHelp,
        onRun,
    }, ref) {
        const editorRef = useRef<EditorView | null>(null);
        const { resolved: resolvedTheme } = useThemeMode();
        const { toast } = useToast();
        const { grabSelector } = useGrabber();
        const completionOptions = useMemo(() => ({
            mode: 'code-flow' as const,
            flowId,
            defaultInputs,
        }), [defaultInputs, flowId]);
        const completionExtensions = usePuppetflowCompletions(completionOptions);
        const typeLibraries = usePuppetflowTypeLibraries();
        const typeScriptExtensions = useTypeScriptSupport({ code, extraLibs: typeLibraries });
        const referenceExtensions = useReferenceLabelDecorations(flowId);
        const runExtension = useMemo(() => keymap.of([{
            key: 'Mod-Enter',
            run(view) {
                view.contentDOM.blur();
                onRun?.();
                return Boolean(onRun);
            },
        }]), [onRun]);
        const editorExtensions = useMemo(
            () => [
                ...completionExtensions,
                ...typeScriptExtensions,
                ...referenceExtensions,
                missingAwaitLineDecorationExtension,
                runExtension,
            ],
            [completionExtensions, referenceExtensions, runExtension, typeScriptExtensions],
        );
        const insertHelpEntry = useHelpEntryInsertion({ editorRef, readOnly });

        const handleCodeGizmoClick = useCallback(async (
            gizmo: CodeGizmo,
            forceOnboarding = false,
        ) => {
            if (gizmo.kind === 'helper') {
                onGizmoClick(gizmo.name);
                return;
            }
            const editor = editorRef.current;
            if (readOnly || !editor || gizmo.argumentStart == null || gizmo.argumentEnd == null) {
                return;
            }

            const version = editor.state.doc;
            const originalValue = editor.state.sliceDoc(gizmo.argumentStart, gizmo.argumentEnd);
            try {
                const result = await grabSelector(gizmo.targetUrl, { forceOnboarding });
                if (
                    editor.state.doc !== version
                    || editor.state.sliceDoc(gizmo.argumentStart, gizmo.argumentEnd) !== originalValue
                ) {
                    toast('The code changed while Grabber was active. The selector was not inserted.', 'error');
                    return;
                }
                replaceEditorRange(
                    editor,
                    gizmo.argumentStart,
                    gizmo.argumentEnd,
                    JSON.stringify(result.selector),
                );
            } catch {
                // GrabberContext owns cancellation and error feedback.
            }
        }, [grabSelector, onGizmoClick, readOnly, toast]);

        const fixMissingAwaits = useCallback(() => {
            const editor = editorRef.current;
            if (readOnly || !editor) return 0;
            const calls = getMissingAwaitCalls(editor.state.doc.toString());
            if (calls.length === 0) return 0;
            editor.dispatch({
                changes: calls.map(call => ({ from: call.start, insert: 'await ' })),
                userEvent: 'input.fixMissingAwaits',
            });
            editor.focus();
            return calls.length;
        }, [readOnly]);

        useImperativeHandle(
            ref,
            () => ({ insertHelpEntry, fixMissingAwaits }),
            [fixMissingAwaits, insertHelpEntry],
        );

        const editorOptions = useMemo(() => ({
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            lineNumbers: 'on' as const,
            lineNumbersMinChars: 4,
            tabSize: 4,
            wordWrap: 'off' as const,
            padding: { top: 12 },
            readOnly,
        }), [readOnly]);

        return (
            <S.CodePane $readOnly={readOnly}>
                <CodeEditor
                    gizmos
                    onGizmoClick={handleCodeGizmoClick}
                    height="100%"
                    language="javascript"
                    theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                    value={code}
                    onChange={onCodeChange}
                    options={editorOptions}
                    onMount={editor => {
                        editorRef.current = editor;
                    }}
                    extensions={editorExtensions}
                />
                <FloatingHelpButton
                    type="button"
                    data-code-help-trigger
                    onClick={onOpenHelp}
                    title="Open function help"
                >
                    <Icon icon="lucide:life-buoy" />
                </FloatingHelpButton>
            </S.CodePane>
        );
    },
);
