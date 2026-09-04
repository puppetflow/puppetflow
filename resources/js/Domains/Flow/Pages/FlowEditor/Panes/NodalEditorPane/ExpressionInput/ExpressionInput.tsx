import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { EditorView } from '@codemirror/view';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { templateDecorationExtension } from '@/Shared/CodeEditor/extensions/templateDecorationExtension';
import { revealEditorPosition } from '@/Shared/CodeEditor/utils/editorActions';
import { useThemeMode } from '@/App/Hooks/useThemeMode';
import type { NodalSelectOption } from '@/Domains/Flow/Pages/FlowEditor/types';
import type { ScalarNodeParameterValue } from '../types';
import type { NodalAutocompleteContext } from '../utils/staticAnalysis';
import ExpressionEditorShell from './ExpressionEditorShell';
import FixedInputRenderer, {
    type ExpressionInputType,
} from './FixedInputRenderer';
import FullscreenEditor from './FullscreenEditor/FullscreenEditor';
import { useExpressionEditors } from './useExpressionEditors';
import { useExpressionInputOrchestration } from './useExpressionInputOrchestration';
import {
    asRecord,
    capitalizeLabel,
    DEFAULT_SELECT_SEARCH_THRESHOLD,
} from './utils';
import * as S from './styled';

interface ExpressionInputProps {
    label: string;
    labelSlot?: ReactNode;
    hint?: string | null;
    placeholder?: string;
    inputType?: ExpressionInputType;
    options?: NodalSelectOption[];
    allowCustomSelectValue?: boolean;
    customSelectValueLabel?: string;
    selectSearchThreshold?: number;
    flowId?: Id;
    value: ScalarNodeParameterValue;
    outputData: unknown;
    autocompleteContext: NodalAutocompleteContext;
    readOnly?: boolean;
    inlineLabel?: boolean;
    invalid?: boolean;
    errorMessage?: string;
    fixedInput?: ReactNode;
    onRemove?: () => void;
    onChange: (value: ScalarNodeParameterValue) => void;
}

export default function ExpressionInput({
    label,
    labelSlot,
    hint,
    placeholder,
    inputType = 'text',
    options = [],
    allowCustomSelectValue,
    customSelectValueLabel,
    selectSearchThreshold = DEFAULT_SELECT_SEARCH_THRESHOLD,
    flowId,
    value,
    outputData,
    autocompleteContext,
    readOnly,
    inlineLabel,
    invalid,
    errorMessage,
    fixedInput,
    onRemove,
    onChange,
}: ExpressionInputProps) {
    const { resolved: theme } = useThemeMode();
    const fieldRef = useRef<HTMLDivElement | null>(null);
    const variableCursorOffsetRef = useRef<number | null>(null);
    const pendingVariableCursorOffsetRef = useRef<number | null>(null);
    const pendingExpressionFocusRef = useRef(false);
    const isExpressionMode = value.mode === 'expression';
    const autocompleteOutputData = useMemo(() => asRecord(outputData), [outputData]);
    const {
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
        updateFullscreenValue,
    } = useExpressionEditors({
        autocompleteContext,
        autocompleteOutputData,
        inputType,
        flowId,
        value,
        onChange,
    });
    const {
        channelSuggestions,
        channelSuggestionsLoading,
        expanded,
        insertDraggedPath,
        onBlur,
        onClose,
        onDragOver,
        onDrop,
        onExpand,
        onFocus,
        renderedExpression,
        refreshSuggestions,
        renderVisible,
        watcherSuggestions,
        watcherSuggestionsLoading,
    } = useExpressionInputOrchestration({
        autocompleteContext,
        flowId,
        inputType,
        outputData,
        value,
        inlineEditorRef,
        fullscreenEditorRef,
        refreshInlineExpressionCompletions,
        updateExpression,
    });
    const templateExtension = useMemo(
        () => templateDecorationExtension(renderedExpression.ok),
        [renderedExpression.ok],
    );
    const decoratedExpressionExtensions = useMemo(
        () => [templateExtension, ...expressionExtensions],
        [expressionExtensions, templateExtension],
    );
    const decoratedCodeExtensions = useMemo(
        () => [templateExtension, ...codeExtensions],
        [codeExtensions, templateExtension],
    );
    const handleModeChange = (nextValue: ScalarNodeParameterValue) => {
        const modeChanged = nextValue.mode !== value.mode;
        if (modeChanged && nextValue.mode === 'expression') {
            pendingExpressionFocusRef.current = true;
        }
        onChange(nextValue);
        if (!modeChanged) return;

        if (nextValue.mode === 'expression') return;

        requestAnimationFrame(() => {
            // Skip inputs belonging to a nested ExpressionInput (e.g. an
            // object field name editor hosted in this field's header).
            const input = Array.from(fieldRef.current?.querySelectorAll<HTMLElement>(
                'input:not([type="hidden"]), textarea, select, [role="combobox"]',
            ) ?? []).find(candidate => candidate.closest('[data-expression-field]') === fieldRef.current);
            if (input) {
                input.focus();
                return;
            }

            inlineEditorRef.current?.focus();
        });
    };

    const handleFixedTextChange = (nextValue: string, cursorOffset: number) => {
        if (nextValue.slice(Math.max(0, cursorOffset - 3), cursorOffset) === '{{ ') {
            pendingExpressionFocusRef.current = true;
            onChange({ mode: 'expression', value: nextValue });
            return;
        }

        handleModeChange({ mode: 'fixed', value: nextValue });
    };

    const handleExpressionEditorMount = (currentEditor: EditorView) => {
        handleInlineEditorMount(currentEditor);
        if (!pendingExpressionFocusRef.current) return;

        revealEditorPosition(currentEditor, currentEditor.state.doc.length);
        pendingExpressionFocusRef.current = false;
    };

    const captureVariableCursor = () => {
        const currentEditor = inlineEditorRef.current;
        if (currentEditor?.hasFocus) {
            variableCursorOffsetRef.current = currentEditor.state.selection.main.head;
            return;
        }

        const activeElement = document.activeElement;
        if (
            activeElement instanceof HTMLInputElement
            && fieldRef.current?.contains(activeElement)
            && typeof activeElement.selectionStart === 'number'
        ) {
            variableCursorOffsetRef.current = activeElement.selectionStart;
            return;
        }

        if (currentEditor) {
            variableCursorOffsetRef.current = currentEditor.state.selection.main.head;
            return;
        }

        variableCursorOffsetRef.current = value.value.length;
    };

    const insertVariable = (key: string) => {
        const currentValue = value.value;
        const offset = Math.max(0, Math.min(
            variableCursorOffsetRef.current ?? currentValue.length,
            currentValue.length,
        ));
        const prefix = currentValue.slice(0, offset);
        const insideExpression = prefix.lastIndexOf('{{') > prefix.lastIndexOf('}}');
        const variableCall = `$vars(${JSON.stringify(key)})`;
        const insertion = insideExpression ? variableCall : `{{ ${variableCall} }}`;
        const nextValue = currentValue.slice(0, offset) + insertion + currentValue.slice(offset);

        pendingVariableCursorOffsetRef.current = offset + insertion.length;
        onChange({ mode: 'expression', value: nextValue });
    };

    useEffect(() => {
        const offset = pendingVariableCursorOffsetRef.current;
        if (!isExpressionMode || offset === null) return;

        const frame = requestAnimationFrame(() => {
            const currentEditor = inlineEditorRef.current;
            if (!currentEditor) return;
            revealEditorPosition(currentEditor, Math.min(offset, currentEditor.state.doc.length));
            pendingVariableCursorOffsetRef.current = null;
            variableCursorOffsetRef.current = null;
        });

        return () => cancelAnimationFrame(frame);
    }, [isExpressionMode, inlineEditorRef, value.value]);

    return (
        <S.ExpressionField
            ref={fieldRef}
            $inlineLabel={inlineLabel}
            $invalid={invalid}
            data-invalid={invalid}
            data-expression-field
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            <S.NodeFieldHeader>
                {onRemove && (
                    <S.NodeFieldRemoveButton
                        type="button"
                        disabled={readOnly}
                        title="Remove input"
                        onClick={event => {
                            event.stopPropagation();
                            onRemove();
                        }}
                    >
                        <Icon icon="lucide:trash-2" width={13} height={13} />
                        <S.NodeFieldRemoveButtonLabel>Supprimer</S.NodeFieldRemoveButtonLabel>
                    </S.NodeFieldRemoveButton>
                )}
                {labelSlot ?? <label>{capitalizeLabel(label)}</label>}
            </S.NodeFieldHeader>
            {hint && <S.NodeFieldHelp>{hint}</S.NodeFieldHelp>}
            {invalid && (
                <S.NodeFieldError>{errorMessage ?? 'This field is required.'}</S.NodeFieldError>
            )}
            {isExpressionMode ? (
                <ExpressionEditorShell
                    value={value}
                    renderedExpression={renderedExpression}
                    renderVisible={renderVisible}
                    inlineEditorHeight={inlineEditorHeight}
                    theme={theme}
                    readOnly={readOnly}
                    onExpand={onExpand}
                    onChange={handleModeChange}
                    onEditorMount={handleExpressionEditorMount}
                    onEditorUpdate={handleInlineEditorUpdate}
                    onEditorChange={nextValue => updateExpression(
                        nextValue,
                        inlineEditorRef.current,
                    )}
                    extensions={decoratedExpressionExtensions}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    onVariablePickerOpen={captureVariableCursor}
                    onVariableSelect={insertVariable}
                />
            ) : (
                <FixedInputRenderer
                    inputType={inputType}
                    value={value}
                    options={options}
                    allowCustomSelectValue={allowCustomSelectValue}
                    customSelectValueLabel={customSelectValueLabel}
                    selectSearchThreshold={selectSearchThreshold}
                    placeholder={placeholder}
                    readOnly={readOnly}
                    theme={theme}
                    inlineEditorHeight={inlineEditorHeight}
                    channelSuggestions={channelSuggestions}
                    channelSuggestionsLoading={channelSuggestionsLoading}
                    watcherSuggestions={watcherSuggestions}
                    watcherSuggestionsLoading={watcherSuggestionsLoading}
                    fixedInput={fixedInput}
                    onExpand={onExpand}
                    onChange={handleModeChange}
                    onTextChange={handleFixedTextChange}
                    onTextareaMount={handleFixedTextareaEditorMount}
                    onTextareaUpdate={handleInlineEditorUpdate}
                    extensions={inputType === 'code'
                        ? decoratedCodeExtensions
                        : decoratedExpressionExtensions}
                    onTextareaChange={nextValue => {
                        const currentEditor = inlineEditorRef.current;
                        const cursorOffset = currentEditor
                            ? currentEditor.state.selection.main.head
                            : nextValue.length;
                        handleFixedTextChange(nextValue, cursorOffset);
                    }}
                    onVariablePickerOpen={captureVariableCursor}
                    onVariableSelect={insertVariable}
                    onRefreshSuggestions={refreshSuggestions}
                />
            )}
            {expanded && (
                <FullscreenEditor
                    label={label}
                    inputType={inputType}
                    value={value}
                    placeholder={placeholder}
                    autocompleteContext={autocompleteContext}
                    theme={theme}
                    readOnly={readOnly}
                    renderedExpression={renderedExpression}
                    onClose={onClose}
                    onMount={handleFullscreenEditorMount}
                    extensions={inputType === 'code'
                        ? decoratedCodeExtensions
                        : decoratedExpressionExtensions}
                    onChange={updateFullscreenValue}
                    onDropPath={insertDraggedPath}
                />
            )}
        </S.ExpressionField>
    );
}
