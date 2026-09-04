import type { ReactNode } from 'react';
import type { Extension } from '@codemirror/state';
import type { EditorView, ViewUpdate } from '@codemirror/view';
import { CodeEditor } from '@/Shared/CodeEditor/components/CodeEditor';
import type { NodalSelectOption } from '@/Domains/Flow/Pages/FlowEditor/types';
import type { ScalarNodeParameterValue } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import EditorActions from './EditorActions/EditorActions';
import SelectInput from './SelectInput/SelectInput';
import type { ChannelSuggestion } from '@/Domains/Flow/Pages/FlowEditor/utils/channelSuggestions';
import SuggestionPicker from './SuggestionPicker';
import {
    CODE_INPUT_EDITOR_OPTIONS,
    EXPRESSION_EDITOR_OPTIONS,
    EXPRESSION_MAX_HEIGHT,
    EXPRESSION_OVERFLOW_SCROLLBAR_OPTIONS,
    PLAIN_FIXED_INPUT_EDITOR_OPTIONS,
} from './utils';
import type { WatcherSuggestion } from '@/Domains/Flow/Pages/FlowEditor/utils/mailboxWatcherSuggestions';
import * as S from './FixedInputRenderer.styled';
import * as Shared from './shared.styled';

export type ExpressionInputType =
    | 'text'
    | 'boolean'
    | 'number'
    | 'textarea'
    | 'code'
    | 'select'
    | 'channel'
    | 'mailbox-watcher';

interface FixedInputRendererProps {
    inputType: ExpressionInputType;
    value: ScalarNodeParameterValue;
    options: NodalSelectOption[];
    allowCustomSelectValue?: boolean;
    customSelectValueLabel?: string;
    selectSearchThreshold: number;
    placeholder?: string;
    readOnly?: boolean;
    theme: string;
    inlineEditorHeight: number;
    channelSuggestions: ChannelSuggestion[];
    channelSuggestionsLoading: boolean;
    watcherSuggestions: WatcherSuggestion[];
    watcherSuggestionsLoading: boolean;
    fixedInput?: ReactNode;
    onExpand: () => void;
    onChange: (value: ScalarNodeParameterValue) => void;
    onTextChange: (value: string, cursorOffset: number) => void;
    extensions: Extension[];
    onTextareaMount: (view: EditorView) => void;
    onTextareaUpdate: (update: ViewUpdate) => void;
    onTextareaChange: (value: string) => void;
    onVariablePickerOpen: () => void;
    onVariableSelect: (key: string) => void;
    onRefreshSuggestions: () => void;
}

export default function FixedInputRenderer({
    inputType,
    value,
    options,
    allowCustomSelectValue,
    customSelectValueLabel,
    selectSearchThreshold,
    placeholder,
    readOnly,
    theme,
    inlineEditorHeight,
    channelSuggestions,
    channelSuggestionsLoading,
    watcherSuggestions,
    watcherSuggestionsLoading,
    fixedInput,
    onExpand,
    onChange,
    onTextChange,
    extensions,
    onTextareaMount,
    onTextareaUpdate,
    onTextareaChange,
    onVariablePickerOpen,
    onVariableSelect,
    onRefreshSuggestions,
}: FixedInputRendererProps) {
    let input;
    const codeEditorHeight = inputType === 'code'
        ? Math.max(160, inlineEditorHeight)
        : inlineEditorHeight;

    if (fixedInput) {
        input = fixedInput;
    } else if (inputType === 'boolean') {
        input = (
            <S.BooleanSwitchLabel>
                <span>{value.value === 'true' ? 'Enabled' : 'Disabled'}</span>
                <S.BooleanSwitchInput
                    type="checkbox"
                    checked={value.value === 'true'}
                    disabled={readOnly}
                    onChange={event => onChange({
                        mode: 'fixed',
                        value: event.target.checked ? 'true' : 'false',
                    })}
                />
                <S.BooleanSwitchTrack />
            </S.BooleanSwitchLabel>
        );
    } else if (inputType === 'textarea' || inputType === 'code') {
        input = (
            <Shared.ExpressionCodeEditor
                $renderVisible={false}
                $codeInput={inputType === 'code'}
                style={{ height: codeEditorHeight }}
            >
                <CodeEditor
                    key="inline-fixed-textarea"
                    height={`${codeEditorHeight}px`}
                    language={inputType === 'code' ? 'javascript' : 'json'}
                    theme={theme === 'dark' ? 'vs-dark' : 'light'}
                    placeholder={placeholder}
                    value={value.value}
                    extensions={extensions}
                    options={{
                        ...EXPRESSION_EDITOR_OPTIONS,
                        ...(inputType === 'textarea' && codeEditorHeight >= EXPRESSION_MAX_HEIGHT
                            ? EXPRESSION_OVERFLOW_SCROLLBAR_OPTIONS
                            : {}),
                        readOnly,
                        domReadOnly: readOnly,
                        ...(inputType === 'code' ? CODE_INPUT_EDITOR_OPTIONS : PLAIN_FIXED_INPUT_EDITOR_OPTIONS),
                    }}
                    onMount={onTextareaMount}
                    onUpdate={onTextareaUpdate}
                    onChange={nextValue => onTextareaChange(nextValue ?? '')}
                />
            </Shared.ExpressionCodeEditor>
        );
    } else if (inputType === 'select') {
        input = (
            <SelectInput
                options={options}
                searchThreshold={selectSearchThreshold}
                value={value.value}
                placeholder={placeholder}
                allowCustomValue={allowCustomSelectValue}
                customValueLabel={customSelectValueLabel}
                readOnly={readOnly}
                onChange={onChange}
            />
        );
    } else if (inputType === 'channel' || inputType === 'mailbox-watcher') {
        input = (
            <SuggestionPicker
                type={inputType}
                value={value.value}
                placeholder={placeholder}
                readOnly={readOnly}
                channels={channelSuggestions}
                watchers={watcherSuggestions}
                onRefresh={onRefreshSuggestions}
                refreshing={inputType === 'channel'
                    ? channelSuggestionsLoading
                    : watcherSuggestionsLoading}
                onChange={onChange}
            />
        );
    } else {
        input = (
            <input
                type={inputType === 'number' ? 'number' : 'text'}
                value={value.value}
                placeholder={placeholder ?? 'Not configured'}
                disabled={readOnly}
                onChange={event => onTextChange(
                    event.target.value,
                    event.target.selectionStart ?? event.target.value.length,
                )}
            />
        );
    }

    return (
        <Shared.ExpressionEditorWrap>
            <EditorActions
                value={value}
                expressionFallback={inputType === 'boolean' ? '{{ true }}' : undefined}
                readOnly={readOnly}
                fullscreenTitle="Open fullscreen editor"
                onExpand={onExpand}
                onChange={onChange}
                onVariablePickerOpen={onVariablePickerOpen}
                onVariableSelect={onVariableSelect}
            />
            {input}
        </Shared.ExpressionEditorWrap>
    );
}
