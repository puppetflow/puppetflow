import { useEffect, useMemo, useRef } from 'react';
import { StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state';
import {
    Decoration,
    EditorView,
    WidgetType,
    type DecorationSet,
    ViewPlugin,
} from '@codemirror/view';
import { fetchAiModelSuggestions } from '@/Domains/AiModel/aiModelSuggestions';
import { fetchChannelSuggestions } from './channelSuggestions';
import { fetchDataTableSuggestions } from './dataTableSuggestions';
import { fetchMailboxWatcherSuggestions } from './mailboxWatcherSuggestions';
import { fetchSnippetSuggestions, invalidateSnippetCache } from './snippetSuggestions';
import { fetchVariableSuggestions } from './variableSuggestions';

const labelRefreshers = new Set<(force: boolean) => Promise<void>>();

export function refreshReferenceLabelDecorations(force = true) {
    for (const refresh of labelRefreshers) void refresh(force);
}

async function buildLabelMap(flowId: Id | null, force: boolean): Promise<Map<string, string>> {
    if (force) invalidateSnippetCache();
    const results = await Promise.allSettled([
        fetchVariableSuggestions(force),
        fetchChannelSuggestions(force),
        fetchAiModelSuggestions(force),
        fetchSnippetSuggestions(),
        flowId ? fetchMailboxWatcherSuggestions(flowId, force) : Promise.resolve([]),
        flowId ? fetchDataTableSuggestions(flowId, force) : Promise.resolve([]),
    ] as const);
    const labels = new Map<string, string>();
    const [variables, channels, aiModels, snippets, watchers, dataTables] = results;

    if (variables.status === 'fulfilled') {
        variables.value.forEach(item => {
            if (item.type !== 'json_path') labels.set(String(item.id), item.key);
        });
    }
    if (channels.status === 'fulfilled') {
        channels.value.forEach(item => labels.set(String(item.id), item.name));
    }
    if (aiModels.status === 'fulfilled') {
        aiModels.value.forEach(item => labels.set(String(item.id), item.name));
    }
    if (snippets.status === 'fulfilled') {
        snippets.value.forEach(item => labels.set(String(item.id), item.label));
    }
    if (watchers.status === 'fulfilled') {
        watchers.value.forEach(item => labels.set(String(item.id), item.name));
    }
    if (dataTables.status === 'fulfilled') {
        dataTables.value.forEach(item => labels.set(String(item.id), item.name));
    }
    return labels;
}

class ReferenceLabelWidget extends WidgetType {
    constructor(readonly label: string) {
        super();
    }

    eq(other: ReferenceLabelWidget) {
        return other.label === this.label;
    }

    toDOM() {
        const element = document.createElement('span');
        element.className = 'pf-ref-label';
        element.textContent = ` ${this.label} `;
        return element;
    }

    ignoreEvent() {
        return true;
    }
}

const setReferenceLabels = StateEffect.define<Map<string, string>>();

function buildDecorations(state: EditorState, labels: Map<string, string>): DecorationSet {
    const source = state.doc.toString();
    const ranges = [...labels].flatMap(([id, label]) => {
        const decorations = [];
        let start = source.indexOf(id);
        while (start !== -1) {
            const previous = source[start - 1] ?? '';
            const next = source[start + id.length] ?? '';
            if (!/[A-Za-z0-9_-]/.test(previous) && !/[A-Za-z0-9_-]/.test(next)) {
                decorations.push(
                    Decoration.mark({ class: 'pf-ref-id' }).range(start, start + id.length),
                    Decoration.widget({
                        widget: new ReferenceLabelWidget(label),
                        side: 1,
                    }).range(start + id.length),
                );
            }
            start = source.indexOf(id, start + id.length);
        }
        return decorations;
    });
    return Decoration.set(ranges, true);
}

const referenceLabelField = StateField.define<{
    labels: Map<string, string>;
    decorations: DecorationSet;
}>({
    create() {
        return { labels: new Map(), decorations: Decoration.none };
    },
    update(current, transaction) {
        const effect = transaction.effects.find(item => item.is(setReferenceLabels));
        const labels = effect?.value ?? current.labels;
        if (!effect && !transaction.docChanged) return current;
        return { labels, decorations: buildDecorations(transaction.state, labels) };
    },
    provide: field => EditorView.decorations.from(field, value => value.decorations),
});

export function useReferenceLabelDecorations(flowId?: Id | null): Extension[] {
    const viewRefs = useRef(new Set<EditorView>());
    const labelsRef = useRef(new Map<string, string>());
    const refreshRef = useRef<((force: boolean) => Promise<void>) | undefined>(undefined);
    const extension = useMemo<Extension[]>(() => [
        referenceLabelField,
        ViewPlugin.define(view => {
            viewRefs.current.add(view);
            let refreshTimer: ReturnType<typeof setTimeout> | undefined;
            queueMicrotask(() => {
                if (view.dom.isConnected && labelsRef.current.size > 0) {
                    view.dispatch({ effects: setReferenceLabels.of(labelsRef.current) });
                }
            });
            return {
                update(update) {
                    if (!update.docChanged) return;
                    if (refreshTimer) clearTimeout(refreshTimer);
                    refreshTimer = setTimeout(() => {
                        void refreshRef.current?.(false);
                    }, 250);
                },
                destroy() {
                    if (refreshTimer) clearTimeout(refreshTimer);
                    viewRefs.current.delete(view);
                },
            };
        }),
    ], []);

    useEffect(() => {
        let disposed = false;
        const refresh = async (force: boolean) => {
            const labels = await buildLabelMap(flowId ?? null, force);
            if (disposed) return;
            labelsRef.current = labels;
            viewRefs.current.forEach(view => {
                if (view.dom.isConnected) {
                    view.dispatch({ effects: setReferenceLabels.of(labels) });
                }
            });
        };
        refreshRef.current = refresh;
        labelRefreshers.add(refresh);
        void refresh(false);
        return () => {
            disposed = true;
            if (refreshRef.current === refresh) refreshRef.current = undefined;
            labelRefreshers.delete(refresh);
        };
    }, [flowId]);

    return extension;
}
