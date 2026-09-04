import {
    useEffect,
    useMemo,
    useState,
    type DragEvent,
    type MutableRefObject,
} from 'react';
import type { editor } from 'monaco-editor';
import { fetchChannelSuggestions, type ChannelSuggestion } from '@/Domains/Flow/Pages/FlowEditor/utils/channelSuggestions';
import { fetchMailboxWatcherSuggestions, type WatcherSuggestion } from '@/Domains/Flow/Pages/FlowEditor/utils/mailboxWatcherSuggestions';
import { fetchVariableSuggestions, type VariableSuggestion } from '@/Domains/Flow/Pages/FlowEditor/utils/variableSuggestions';
import type { ScalarNodeParameterValue } from '../types';
import { evaluateExpressionPreview, expressionForPath } from '../utils/expression';
import type { NodalAutocompleteContext } from '../utils/staticAnalysis';
import type { ExpressionInputType } from './FixedInputRenderer';
import { hasOpenEditorAutocomplete, insertPathExpression } from './utils';
import {
    useNodeValidationResourceRevision,
    useRefreshNodeValidationResources,
} from '../contexts/NodeValidationContext';

interface UseExpressionInputOrchestrationOptions {
    autocompleteContext: NodalAutocompleteContext;
    flowId?: Id;
    inputType: ExpressionInputType;
    outputData: unknown;
    value: ScalarNodeParameterValue;
    inlineEditorRef: MutableRefObject<editor.IStandaloneCodeEditor | null>;
    fullscreenEditorRef: MutableRefObject<editor.IStandaloneCodeEditor | null>;
    refreshInlineExpressionCompletions: () => void;
    updateExpression: (value: string) => void;
}

interface UseAsyncResourceOptions<TResource, TActive> {
    active: TActive | false | null | undefined;
    loader: (active: TActive, force: boolean) => Promise<TResource>;
    fallback: TResource;
    revision?: number;
}

// Loads an autocomplete resource only while its matching input mode is active.
function useAsyncResource<TResource, TActive>({
    active,
    loader,
    fallback,
    revision = 0,
}: UseAsyncResourceOptions<TResource, TActive>) {
    const [resource, setResource] = useState<TResource>(() => fallback);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!active) return;

        let stale = false;
        setLoading(true);
        loader(active, revision > 0)
            .then(value => {
                if (!stale) setResource(value);
            })
            .finally(() => {
                if (!stale) setLoading(false);
            });
        return () => {
            stale = true;
        };
    }, [active, loader, revision]);

    return { loading, resource };
}

function fetchExpressionVariableSuggestions(_expression: string) {
    return fetchVariableSuggestions();
}

function fetchChannelSuggestionResource(_active: true, force: boolean) {
    return fetchChannelSuggestions(force);
}

// Coordinates expression mode, suggestions, previews, and expanded-editor visibility.
export function useExpressionInputOrchestration({
    autocompleteContext,
    flowId,
    inputType,
    outputData,
    value,
    inlineEditorRef,
    fullscreenEditorRef,
    refreshInlineExpressionCompletions,
    updateExpression,
}: UseExpressionInputOrchestrationOptions) {
    const [expanded, setExpanded] = useState(false);
    const [renderVisible, setRenderVisible] = useState(false);
    const resourceRevision = useNodeValidationResourceRevision();
    const refreshResources = useRefreshNodeValidationResources();
    const channelResource = useAsyncResource<ChannelSuggestion[], true>({
        active: inputType === 'channel',
        loader: fetchChannelSuggestionResource,
        fallback: [],
        revision: resourceRevision,
    });
    const watcherResource = useAsyncResource<WatcherSuggestion[], Id>({
        active: inputType === 'mailbox-watcher' ? flowId : undefined,
        loader: fetchMailboxWatcherSuggestions,
        fallback: [],
        revision: resourceRevision,
    });
    const variableResource = useAsyncResource<VariableSuggestion[], string>({
        active: value.value.includes('$vars(') ? value.value : false,
        loader: fetchExpressionVariableSuggestions,
        fallback: [],
        revision: resourceRevision,
    });
    const channelSuggestions = channelResource.resource;
    const watcherSuggestions = watcherResource.resource;
    const variableSuggestions = variableResource.resource;
    const renderedExpression = useMemo(() => {
        const variableData = Object.fromEntries(
            variableSuggestions
                .filter(variable => Object.prototype.hasOwnProperty.call(variable, 'preview_value'))
                .map(variable => [variable.id, variable.preview_value]),
        );
        return evaluateExpressionPreview(value.value, {
            inputData: autocompleteContext.inputData,
            pageData: autocompleteContext.pageData,
            outputData,
            nodeData: autocompleteContext.nodeData,
            runData: autocompleteContext.runData,
            contextData: autocompleteContext.contextData,
            variableData,
        });
    }, [
        autocompleteContext.contextData,
        autocompleteContext.inputData,
        autocompleteContext.nodeData,
        autocompleteContext.pageData,
        autocompleteContext.runData,
        outputData,
        value.value,
        variableSuggestions,
    ]);

    useEffect(() => {
        if (!expanded) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;

            const overlays = document.querySelectorAll<HTMLElement>('[data-modal-overlay]');
            const topOverlay = overlays[overlays.length - 1];
            if (topOverlay?.dataset.modalKind !== 'expression-fullscreen') return;
            if (hasOpenEditorAutocomplete()) return;

            event.preventDefault();
            event.stopImmediatePropagation();
            setExpanded(false);
        };

        window.addEventListener('keydown', handleEscape, true);
        return () => window.removeEventListener('keydown', handleEscape, true);
    }, [expanded]);

    const insertDraggedPath = (path: string, event?: DragEvent<HTMLElement>) => {
        if (!path) return;

        const focusExpressionAt = (offset: number) => {
            requestAnimationFrame(() => {
                const expressionEditor = expanded
                    ? fullscreenEditorRef.current
                    : inlineEditorRef.current;
                const expressionModel = expressionEditor?.getModel();
                if (!expressionEditor || !expressionModel) return;

                const position = expressionModel.getPositionAt(offset);
                expressionEditor.setPosition(position);
                expressionEditor.focus();
            });
        };
        const targetEditor = expanded ? fullscreenEditorRef.current : inlineEditorRef.current;
        if (targetEditor?.getDomNode()?.isConnected) {
            const dropTarget = event
                ? targetEditor.getTargetAtClientPoint(event.clientX, event.clientY)
                : null;
            const model = targetEditor.getModel();
            const position = dropTarget?.position
                ?? targetEditor.getPosition()
                ?? model?.getFullModelRange().getEndPosition();
            if (model && position) {
                if (value.mode === 'fixed') {
                    const expression = expressionForPath(path);
                    const offset = model.getOffsetAt(position);
                    const nextValue = insertPathExpression(model.getValue(), path, offset);
                    updateExpression(nextValue);
                    focusExpressionAt(offset + expression.length);
                    return;
                }

                targetEditor.pushUndoStop();
                targetEditor.executeEdits('drop-path', [{
                    range: {
                        startLineNumber: position.lineNumber,
                        startColumn: position.column,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column,
                    },
                    text: expressionForPath(path),
                }]);
                targetEditor.pushUndoStop();
                targetEditor.focus();
                return;
            }
        }

        const nativeInput = event?.nativeEvent.composedPath().find(
            target => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement,
        );
        const offset = nativeInput instanceof HTMLInputElement || nativeInput instanceof HTMLTextAreaElement
            ? nativeInput.selectionStart ?? value.value.length
            : value.value.length;
        const expression = expressionForPath(path);
        updateExpression(insertPathExpression(value.value, path, offset));
        focusExpressionAt(offset + expression.length);
    };

    return {
        channelSuggestions,
        channelSuggestionsLoading: channelResource.loading,
        expanded,
        insertDraggedPath,
        onBlur: () => setRenderVisible(false),
        onClose: () => setExpanded(false),
        onDragOver: (event: DragEvent<HTMLElement>) => {
            event.preventDefault();
            // Fields can nest (e.g. an object field name editor inside the
            // value field header); the innermost field owns the drag.
            event.stopPropagation();
            event.dataTransfer.dropEffect = 'copy';
        },
        onDrop: (event: DragEvent<HTMLElement>) => {
            event.preventDefault();
            event.stopPropagation();
            insertDraggedPath(event.dataTransfer.getData('text/plain'), event);
        },
        onExpand: () => setExpanded(true),
        onFocus: () => {
            setRenderVisible(true);
            refreshInlineExpressionCompletions();
        },
        renderedExpression,
        refreshSuggestions: refreshResources,
        renderVisible,
        watcherSuggestions,
        watcherSuggestionsLoading: watcherResource.loading,
    };
}
