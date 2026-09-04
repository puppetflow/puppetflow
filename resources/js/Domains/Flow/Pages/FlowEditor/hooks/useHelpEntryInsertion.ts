import { useCallback } from 'react';
import type { EditorView } from '@codemirror/view';
import type { HelpEntryDef } from '@/Domains/Flow/Pages/FlowEditor/types';
import { buildHelpInsertText } from '@/Domains/Flow/Pages/FlowEditor/utils/helpToolbox';
import { replaceEditorSelection } from '@/Shared/CodeEditor/utils/editorActions';

interface UseHelpEntryInsertionOptions {
    editorRef: React.MutableRefObject<EditorView | null>;
    readOnly?: boolean;
}

// Inserts a help entry snippet at the current selection and places the caret
// inside the first pair of parentheses.
export function useHelpEntryInsertion({ editorRef, readOnly }: UseHelpEntryInsertionOptions) {
    return useCallback((entry: HelpEntryDef): boolean => {
        if (readOnly) return false;

        const editorInstance = editorRef.current;
        if (!editorInstance) return false;

        const text = buildHelpInsertText(entry);
        const openParenIndex = text.indexOf('(');
        replaceEditorSelection(
            editorInstance,
            text,
            openParenIndex === -1 ? text.length : openParenIndex + 1,
        );
        return true;
    }, [editorRef, readOnly]);
}
