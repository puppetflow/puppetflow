import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { startCompletion } from '@codemirror/autocomplete';
import type { EditorView, ViewUpdate } from '@codemirror/view';
import { usePuppetflowCompletions } from '@/Shared/CodeEditor/completion/usePuppetflowCompletions';
import {
    buildNodalTypeLibrary,
    usePuppetflowTypeLibraries,
} from '@/Shared/CodeEditor/typescript/puppetflowTypeLibraries';
import { useTypeScriptSupport } from '@/Shared/CodeEditor/typescript/useTypeScriptSupport';
import { setEditorValue } from '@/Shared/CodeEditor/utils/editorActions';
import { useReferenceLabelDecorations } from '@/Domains/Flow/Pages/FlowEditor/utils/referenceLabelDecorations';
import type { ScalarNodeParameterValue } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import type { NodalAutocompleteContext } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/staticAnalysis';
import {
    EXPRESSION_MAX_HEIGHT,
    EXPRESSION_MIN_HEIGHT,
} from './utils';

interface UseExpressionEditorsOptions {
    autocompleteContext: NodalAutocompleteContext;
    autocompleteOutputData: Record<string, unknown> | null;
    inputType: string;
    flowId?: Id;
    value: ScalarNodeParameterValue;
    onChange: (value: ScalarNodeParameterValue) => void;
}

// Keeps the inline and fullscreen CodeMirror expression editors synchronized.
export function useExpressionEditors({
    autocompleteContext,
    autocompleteOutputData,
    inputType,
    flowId,
    value,
    onChange,
}: UseExpressionEditorsOptions) {
    const [inlineEditorHeight, setInlineEditorHeight] = useState(EXPRESSION_MIN_HEIGHT);
    const inlineEditorRef = useRef<EditorView | null>(null);
    const fullscreenEditorRef = useRef<EditorView | null>(null);
    const lastChangedEditorRef = useRef<EditorView | null>(null);
    const isInternalChangeRef = useRef(false);
    const completionOptions = useMemo(() => ({
        mode: inputType === 'code' ? 'nodal-code' as const : 'nodal-expression' as const,
        flowId,
        nodalContext: {
            ...autocompleteContext,
            outputData: autocompleteOutputData,
        },
    }), [autocompleteContext, autocompleteOutputData, flowId, inputType]);
    const completionExtensions = usePuppetflowCompletions(completionOptions);
    const baseTypeLibraries = usePuppetflowTypeLibraries('nodal');
    const typeLibraries = useMemo(() => ({
        ...baseTypeLibraries,
        '/puppetflow-nodal-context.d.ts': buildNodalTypeLibrary(completionOptions.nodalContext),
    }), [baseTypeLibraries, completionOptions.nodalContext]);
    const typeScriptExtensions = useTypeScriptSupport({
        code: value.value,
        enabled: inputType === 'code',
        extraLibs: typeLibraries,
    });
    const referenceExtensions = useReferenceLabelDecorations(flowId);
    const expressionExtensions = useMemo(
        () => [...completionExtensions, ...referenceExtensions],
        [completionExtensions, referenceExtensions],
    );
    const codeExtensions = useMemo(
        () => [...expressionExtensions, ...typeScriptExtensions],
        [expressionExtensions, typeScriptExtensions],
    );

    const syncInlineEditorHeight = useCallback((
        currentEditor: EditorView,
    ) => {
        setInlineEditorHeight(Math.min(
            EXPRESSION_MAX_HEIGHT,
            Math.max(EXPRESSION_MIN_HEIGHT, currentEditor.contentDOM.scrollHeight),
        ));
    }, []);

    const handleInlineEditorMount = useCallback((currentEditor: EditorView) => {
        inlineEditorRef.current = currentEditor;
        syncInlineEditorHeight(currentEditor);
    }, [syncInlineEditorHeight]);
    const handleInlineEditorUpdate = useCallback((update: ViewUpdate) => {
        if (update.docChanged || update.geometryChanged) {
            syncInlineEditorHeight(update.view);
        }
    }, [syncInlineEditorHeight]);

    const handleFixedTextareaEditorMount = useCallback((currentEditor: EditorView) => {
        inlineEditorRef.current = currentEditor;
        syncInlineEditorHeight(currentEditor);
    }, [syncInlineEditorHeight]);

    const handleFullscreenEditorMount = useCallback((currentEditor: EditorView) => {
        fullscreenEditorRef.current = currentEditor;
    }, []);

    const updateValue = useCallback((
        mode: ScalarNodeParameterValue['mode'],
        nextValue: string,
        sourceEditor: EditorView | null = null,
    ) => {
        isInternalChangeRef.current = Boolean(sourceEditor);
        lastChangedEditorRef.current = sourceEditor;
        onChange({ mode, value: nextValue });
    }, [onChange]);

    const updateExpression = useCallback((
        nextValue: string,
        sourceEditor: EditorView | null = null,
    ) => updateValue('expression', nextValue, sourceEditor), [updateValue]);

    const updateFixedValue = useCallback((
        nextValue: string,
        sourceEditor: EditorView | null = null,
    ) => updateValue('fixed', nextValue, sourceEditor), [updateValue]);

    const updateFullscreenValue = useCallback((nextValue: string) => {
        if (value.mode === 'expression') {
            updateExpression(nextValue, fullscreenEditorRef.current);
            return;
        }
        updateFixedValue(nextValue, fullscreenEditorRef.current);
    }, [updateExpression, updateFixedValue, value.mode]);

    const refreshInlineExpressionCompletions = useCallback(() => {
        if (inlineEditorRef.current) startCompletion(inlineEditorRef.current);
    }, []);

    useEffect(() => {
        const editors = [inlineEditorRef.current, fullscreenEditorRef.current]
            .filter(Boolean) as EditorView[];

        if (isInternalChangeRef.current) {
            isInternalChangeRef.current = false;
            editors.forEach(item => {
                if (item === lastChangedEditorRef.current) return;
                if (item.state.doc.toString() !== value.value) setEditorValue(item, value.value);
            });
            lastChangedEditorRef.current = null;
            return;
        }

        editors.forEach(item => {
            if (item.state.doc.toString() !== value.value) setEditorValue(item, value.value);
        });
    }, [value.value]);

    return {
        codeExtensions,
        expressionExtensions,
        fullscreenEditorRef,
        handleFixedTextareaEditorMount,
        handleFullscreenEditorMount,
        handleInlineEditorMount,
        handleInlineEditorUpdate,
        inlineEditorHeight,
        inlineEditorRef,
        refreshInlineExpressionCompletions,
        updateExpression,
        updateFixedValue,
        updateFullscreenValue,
    };
}
