import { useCallback } from 'react';
import type { EditorView } from '@codemirror/view';
import { useCodeHelpPanel } from '@/Shared/CodeEditor/hooks/useCodeHelpPanel';
import type { HelpEntryDef } from '@/Domains/Flow/Pages/FlowEditor/types';
import { buildHelpInsertText } from '@/Domains/Flow/Pages/FlowEditor/utils/helpToolbox';
import { replaceEditorSelection } from '@/Shared/CodeEditor/utils/editorActions';

export function useSnippetHelp(
    editorRef: React.MutableRefObject<EditorView | null>,
    readOnly: boolean,
) {
    const insertEntry = useCallback((entry: HelpEntryDef) => {
        const editor = editorRef.current;
        if (!editor) return false;

        const text = buildHelpInsertText(entry);
        const openParenIndex = text.indexOf('(');
        replaceEditorSelection(editor, text, openParenIndex === -1 ? text.length : openParenIndex + 1);
        return true;
    }, [editorRef]);

    return useCodeHelpPanel({ readOnly, insertEntry });
}
