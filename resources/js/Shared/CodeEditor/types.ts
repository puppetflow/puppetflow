import type { Extension } from '@codemirror/state';
import type { EditorView, ViewUpdate } from '@codemirror/view';

export type CodeEditorLanguage = 'javascript' | 'json' | 'html' | 'plaintext';
export type CodeEditorTheme = 'light' | 'dark' | 'vs-dark';

export interface CodeEditorOptions {
    readOnly?: boolean;
    domReadOnly?: boolean;
    fontSize?: number;
    fontFamily?: string;
    lineHeight?: number;
    lineNumbers?: 'on' | 'off';
    lineNumbersMinChars?: number;
    folding?: boolean;
    wordWrap?: 'on' | 'off';
    tabSize?: number;
    padding?: { top?: number; bottom?: number };
    contextmenu?: boolean;
    renderLineHighlight?: 'all' | 'line' | 'none';
    scrollbar?: {
        vertical?: 'auto' | 'hidden' | 'visible';
        horizontal?: 'auto' | 'hidden' | 'visible';
    };
}

export interface CodeEditorProps {
    value?: string;
    defaultValue?: string;
    language?: CodeEditorLanguage;
    defaultLanguage?: CodeEditorLanguage;
    theme?: CodeEditorTheme;
    height?: string | number;
    placeholder?: string;
    options?: CodeEditorOptions;
    extensions?: Extension[];
    className?: string;
    autoFocus?: boolean;
    basicSetup?: boolean;
    onChange?: (value: string | undefined, update?: ViewUpdate) => void;
    onMount?: (view: EditorView) => void;
    onUpdate?: (update: ViewUpdate) => void;
    gizmos?: boolean;
    selectorGizmos?: boolean;
    onGizmoClick?: (
        gizmo: import('@/Domains/Flow/Pages/FlowEditor/utils/codeGizmos').CodeGizmo,
        forceOnboarding?: boolean,
    ) => void;
}
