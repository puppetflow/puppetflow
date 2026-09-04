import { useEffect, useMemo, useRef } from 'react';
import * as Comlink from 'comlink';
import type { Completion, CompletionSource } from '@codemirror/autocomplete';
import { javascriptLanguage } from '@codemirror/lang-javascript';
import { setDiagnostics, type Diagnostic } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import { EditorView, hoverTooltip, keymap, ViewPlugin } from '@codemirror/view';
import { ALL_HELP_ENTRIES } from '@/Domains/Flow/Pages/FlowEditor/utils/helpCatalog';
import { LOCAL_COMPLETION_SECTION } from '@/Shared/CodeEditor/completion/sections';
import typeScriptWorkerUrl from './typescript.worker?worker&url';
import type {
    TypeScriptCompletionDetails,
    TypeScriptWorkerApi,
    TypeScriptWorkerRoot,
} from './types';

interface TypeScriptSupportOptions {
    code: string;
    enabled?: boolean;
    extraLibs?: Record<string, string>;
}

const PUPPETFLOW_COMPLETION_NAMES = new Set([
    '$',
    '$input',
    '$output',
    '$nodes',
    '$run',
    '$loop',
    '$capture',
    ...ALL_HELP_ENTRIES.map(entry => entry.name),
]);

const completionType = (kind: string): string => {
    if (kind.includes('method')) return 'method';
    if (kind.includes('function')) return 'function';
    if (kind.includes('class')) return 'class';
    if (kind.includes('property') || kind.includes('member')) return 'property';
    if (kind.includes('const')) return 'constant';
    if (kind.includes('var') || kind.includes('let')) return 'variable';
    if (kind.includes('keyword')) return 'keyword';
    return 'text';
};

const renderCompletionInfo = (details: TypeScriptCompletionDetails) => {
    const container = document.createElement('div');
    container.className = 'cm-puppetflow-completion-info';
    const signature = document.createElement('code');
    signature.textContent = details.display || details.name;
    container.appendChild(signature);
    if (details.documentation) {
        const description = document.createElement('p');
        description.textContent = details.documentation;
        container.appendChild(description);
    }
    return container;
};

const refreshDiagnostics = async (
    worker: Comlink.Remote<TypeScriptWorkerApi>,
    view: EditorView,
) => {
    const code = view.state.doc.toString();
    await worker.updateCode(code);
    const workerDiagnostics = await worker.getDiagnostics();
    if (!view.dom.isConnected || view.state.doc.toString() !== code) return;

    const diagnostics: Diagnostic[] = workerDiagnostics.map(diagnostic => ({
        from: Math.min(diagnostic.from, view.state.doc.length),
        to: Math.min(diagnostic.to, view.state.doc.length),
        severity: diagnostic.severity,
        message: diagnostic.message,
        source: diagnostic.source ?? `TypeScript ${diagnostic.code}`,
        markClass: diagnostic.severity === 'error' ? 'cm-pf-error-mark' : undefined,
    }));
    view.dispatch(setDiagnostics(view.state, diagnostics));
};

const createExtensions = (
    getWorker: () => Comlink.Remote<TypeScriptWorkerApi> | null,
    registerView: (view: EditorView) => void,
): Extension[] => {
    const completionSource: CompletionSource = async context => {
        const worker = getWorker();
        if (!worker) return null;

        const token = context.matchBefore(/[\w$]+/);
        if (token?.text === '$') return null;
        const line = context.state.doc.lineAt(context.pos);
        const linePrefix = line.text.slice(0, context.pos - line.from);
        const isMemberCompletion = /\.[\w$]*$/.test(linePrefix);
        if (!context.explicit && !token && !isMemberCompletion) return null;

        await worker.updateCode(context.state.doc.toString());
        const entries = await worker.getCompletions(context.pos);
        if (context.aborted || entries.length === 0) return null;

        const visibleEntries = entries.filter(entry => (
            !PUPPETFLOW_COMPLETION_NAMES.has(entry.label)
            && !entry.label.startsWith('$$')
            && (isMemberCompletion || entry.local === true)
        ));
        if (visibleEntries.length === 0) return null;

        const options: Completion[] = visibleEntries.map(entry => ({
            label: entry.label,
            type: completionType(entry.kind),
            detail: entry.kind,
            sortText: entry.sortText,
            apply: entry.insertText,
            section: entry.local ? LOCAL_COMPLETION_SECTION : undefined,
            info: async () => {
                const details = await worker.getCompletionDetails(
                    context.pos,
                    entry.label,
                    entry.source,
                );
                return details ? renderCompletionInfo(details) : null;
            },
        }));
        const replacement = visibleEntries.find(entry => entry.replacementSpan)?.replacementSpan;

        return {
            from: replacement?.start ?? token?.from ?? context.pos,
            options,
            validFor: /^[\w$]*$/,
        };
    };

    return [
        ViewPlugin.define(view => {
            registerView(view);
            let diagnosticsTimer: ReturnType<typeof setTimeout> | undefined;
            const scheduleDiagnostics = () => {
                if (diagnosticsTimer) clearTimeout(diagnosticsTimer);
                diagnosticsTimer = setTimeout(() => {
                    const worker = getWorker();
                    if (worker) {
                        void refreshDiagnostics(worker, view).catch(error => {
                            console.error('Unable to refresh TypeScript diagnostics.', error);
                        });
                    }
                }, 300);
            };
            scheduleDiagnostics();

            return {
                update(update) {
                    registerView(update.view);
                    if (update.docChanged) scheduleDiagnostics();
                },
                destroy() {
                    if (diagnosticsTimer) clearTimeout(diagnosticsTimer);
                },
            };
        }),
        javascriptLanguage.data.of({ autocomplete: completionSource }),
        keymap.of([{
            key: 'Shift-Alt-f',
            run(view) {
                const worker = getWorker();
                if (!worker || view.state.readOnly) return false;
                const source = view.state.doc.toString();
                void worker.updateCode(source);
                void worker.getFormattingEdits().then(changes => {
                    if (
                        changes.length > 0
                        && view.dom.isConnected
                        && view.state.doc.toString() === source
                    ) {
                        view.dispatch({
                            changes,
                            userEvent: 'input.format',
                        });
                    }
                }).catch(error => {
                    console.error('Unable to format the document.', error);
                });
                return true;
            },
        }]),
        EditorView.updateListener.of(update => {
            registerView(update.view);
            const worker = getWorker();
            if (worker && update.docChanged) void worker.updateCode(update.state.doc.toString());
        }),
        hoverTooltip(async (view, position) => {
            const worker = getWorker();
            if (!worker) return null;

            await worker.updateCode(view.state.doc.toString());
            const info = await worker.getHover(position);
            if (!info) return null;

            return {
                pos: info.from,
                end: info.to,
                above: true,
                create() {
                    const dom = document.createElement('div');
                    dom.className = 'cm-puppetflow-hover';
                    const signature = document.createElement('code');
                    signature.textContent = info.display;
                    dom.appendChild(signature);
                    if (info.documentation) {
                        const description = document.createElement('p');
                        description.textContent = info.documentation;
                        dom.appendChild(description);
                    }
                    info.tags.forEach(tag => {
                        const detail = document.createElement('p');
                        const name = document.createElement('code');
                        name.textContent = `@${tag.name}`;
                        detail.append(name, ` ${tag.text}`);
                        dom.appendChild(detail);
                    });
                    return { dom };
                },
            };
        }, { hoverTime: 450 }),
    ];
};

export function useTypeScriptSupport({
    code,
    enabled = true,
    extraLibs = {},
}: TypeScriptSupportOptions): Extension[] {
    const workerApiRef = useRef<Comlink.Remote<TypeScriptWorkerApi> | null>(null);
    const editorViewRef = useRef<EditorView | null>(null);
    const extraLibKey = useMemo(() => JSON.stringify(extraLibs), [extraLibs]);
    const extensions = useMemo(
        () => createExtensions(
            () => workerApiRef.current,
            view => {
                editorViewRef.current = view;
            },
        ),
        [],
    );

    useEffect(() => {
        if (!enabled) {
            workerApiRef.current = null;
            if (editorViewRef.current) {
                editorViewRef.current.dispatch(setDiagnostics(editorViewRef.current.state, []));
            }
            return;
        }

        const resolvedWorkerUrl = new URL(typeScriptWorkerUrl, window.location.href);
        let bootstrapUrl: string | null = null;
        const webWorker = resolvedWorkerUrl.origin === window.location.origin
            ? new Worker(resolvedWorkerUrl, {
                name: 'puppetflow-typescript',
                type: 'module',
            })
            : (() => {
                const bootstrap = new Blob(
                    [`import ${JSON.stringify(resolvedWorkerUrl.href)};`],
                    { type: 'text/javascript' },
                );
                bootstrapUrl = URL.createObjectURL(bootstrap);
                return new Worker(bootstrapUrl, {
                    name: 'puppetflow-typescript',
                    type: 'module',
                });
            })();
        const root = Comlink.wrap<TypeScriptWorkerRoot>(webWorker);
        let disposed = false;

        void root.create(code, extraLibs).then(api => {
            if (disposed) return;
            workerApiRef.current = api as unknown as Comlink.Remote<TypeScriptWorkerApi>;
            if (editorViewRef.current) {
                void refreshDiagnostics(workerApiRef.current, editorViewRef.current).catch(error => {
                    console.error('Unable to refresh TypeScript diagnostics.', error);
                });
            }
        }).catch(error => {
            if (!disposed) {
                console.error('Unable to initialize TypeScript editor support.', error);
            }
        });

        return () => {
            disposed = true;
            workerApiRef.current = null;
            webWorker.terminate();
            if (bootstrapUrl) URL.revokeObjectURL(bootstrapUrl);
        };
        // The worker receives subsequent code updates through EditorView transactions.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, extraLibKey]);

    return extensions;
}
