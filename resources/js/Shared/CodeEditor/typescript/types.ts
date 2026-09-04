export interface TypeScriptCompletion {
    label: string;
    kind: string;
    sortText: string;
    source?: string;
    insertText?: string;
    local?: boolean;
    replacementSpan?: { start: number; length: number };
}

export interface TypeScriptCompletionDetails {
    name: string;
    kind: string;
    display: string;
    documentation: string;
}

export interface TypeScriptDiagnostic {
    from: number;
    to: number;
    severity: 'error' | 'warning';
    message: string;
    code: number;
    source?: string;
}

export interface TypeScriptHover {
    from: number;
    to: number;
    display: string;
    documentation: string;
    tags: Array<{ name: string; text: string }>;
}

export interface TypeScriptTextEdit {
    from: number;
    to: number;
    insert: string;
}

export interface TypeScriptWorkerApi {
    updateCode: (code: string) => void;
    updateExtraLibs: (extraLibs: Record<string, string>) => void;
    getCompletions: (position: number) => TypeScriptCompletion[];
    getCompletionDetails: (
        position: number,
        name: string,
        source?: string,
    ) => TypeScriptCompletionDetails | null;
    getDiagnostics: () => TypeScriptDiagnostic[];
    getHover: (position: number) => TypeScriptHover | null;
    getFormattingEdits: () => TypeScriptTextEdit[];
}

export interface TypeScriptWorkerRoot {
    create: (
        code: string,
        extraLibs: Record<string, string>,
    ) => TypeScriptWorkerApi;
}
