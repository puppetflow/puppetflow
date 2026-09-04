import { useCallback, useEffect, useMemo, useRef } from 'react';
import ReactCodeMirror from '@uiw/react-codemirror';
import {
    autocompletion,
    completionStatus,
    selectedCompletionIndex,
    setSelectedCompletion,
} from '@codemirror/autocomplete';
import { indentWithTab } from '@codemirror/commands';
import { html } from '@codemirror/lang-html';
import { javascriptLanguage } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { indentUnit, syntaxTree } from '@codemirror/language';
import { linter, lintGutter } from '@codemirror/lint';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, tooltips, ViewPlugin } from '@codemirror/view';
import type {
    CodeEditorLanguage,
    CodeEditorProps,
} from '@/Shared/CodeEditor/types';
import { getLocalIconUrl } from '@/Shared/UI/Icon/Icon';
import { codeEditorTheme } from '@/Shared/CodeEditor/themes';
import { codeGizmoExtension } from '@/Shared/CodeEditor/extensions/codeGizmoExtension';
import { errorLineDecorationExtension } from '@/Shared/CodeEditor/extensions/errorLineDecorationExtension';
import { setEditorValue } from '@/Shared/CodeEditor/utils/editorActions';
import * as S from './CodeEditor/styled';

const languageExtension = (language: CodeEditorLanguage): Extension => {
    if (language === 'json') return [
        json(),
        linter(view => {
            const diagnostics: {
                from: number;
                to: number;
                severity: 'error';
                message: string;
                markClass: string;
            }[] = [];
            syntaxTree(view.state).iterate({
                enter(node) {
                    if (!node.type.isError) return;
                    diagnostics.push({
                        from: node.from,
                        to: Math.max(node.from + 1, node.to),
                        severity: 'error',
                        message: 'Invalid JSON syntax.',
                        markClass: 'cm-pf-error-mark',
                    });
                },
            });
            return diagnostics;
        }),
    ];
    if (language === 'html') return html();
    if (language === 'plaintext') return [];
    return javascriptLanguage;
};

const normalizeHeight = (height: string | number | undefined) => (
    typeof height === 'number' ? `${height}px` : height ?? '100%'
);

const COMPLETION_KIND_ICONS: Record<string, string> = {
    function: 'lucide:square-function',
    method: 'lucide:square-function',
    variable: 'lucide:variable',
    property: 'lucide:key-round',
    namespace: 'lucide:layers',
    constant: 'lucide:hash',
    class: 'lucide:box',
    keyword: 'lucide:code-2',
    text: 'lucide:type',
};

const completionMouseSelection = ViewPlugin.define(view => {
    const ownerDocument = view.dom.ownerDocument;
    const handleMouseMove = (event: MouseEvent) => {
        if (completionStatus(view.state) !== 'active') return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        const option = target.closest<HTMLLIElement>(
            '.cm-tooltip-autocomplete > ul > li[role="option"]',
        );
        if (!option) return;
        const list = option.parentElement;
        if (!list) return;
        const options = [...list.querySelectorAll<HTMLLIElement>(':scope > li[role="option"]')];
        const index = options.indexOf(option);
        if (index >= 0 && selectedCompletionIndex(view.state) !== index) {
            view.dispatch({ effects: setSelectedCompletion(index) });
        }
    };

    ownerDocument.addEventListener('mousemove', handleMouseMove);
    return {
        destroy() {
            ownerDocument.removeEventListener('mousemove', handleMouseMove);
        },
    };
});

export function CodeEditor({
    value,
    defaultValue,
    language,
    defaultLanguage,
    theme = 'light',
    height,
    placeholder,
    options = {},
    extensions = [],
    className,
    autoFocus,
    basicSetup = true,
    onChange,
    onMount,
    onUpdate,
    gizmos = false,
    selectorGizmos = true,
    onGizmoClick,
}: CodeEditorProps) {
    const editorLanguage = language ?? defaultLanguage ?? 'javascript';
    const readOnly = Boolean(options.readOnly || options.domReadOnly);
    const initialValueRef = useRef(value ?? defaultValue ?? '');
    const editorViewRef = useRef<EditorView | null>(null);
    const resolvedEditorTheme = useMemo(() => codeEditorTheme(theme), [theme]);
    const editorExtensions = useMemo<Extension[]>(() => [
        languageExtension(editorLanguage),
        errorLineDecorationExtension,
        EditorState.readOnly.of(readOnly),
        EditorState.tabSize.of(options.tabSize ?? 4),
        indentUnit.of(' '.repeat(options.tabSize ?? 4)),
        keymap.of([indentWithTab]),
        lintGutter({
            markerFilter: diagnostics => diagnostics.filter(
                diagnostic => diagnostic.severity === 'error',
            ),
        }),
        completionMouseSelection,
        autocompletion({
            activateOnTyping: true,
            activateOnTypingDelay: 75,
            defaultKeymap: true,
            icons: false,
            maxRenderedOptions: 100,
            positionInfo(view, list, _option, info, space) {
                const tooltip = view.dom.ownerDocument.querySelector<HTMLElement>(
                    '.cm-tooltip-autocomplete:has(> .cm-completionInfo)',
                );
                const previousShift = Number(tooltip?.dataset.pfCompletionShift ?? 0);
                const unshiftedLeft = list.left + previousShift;
                const unshiftedRight = list.right + previousShift;
                const overflow = Math.max(
                    0,
                    unshiftedRight + info.right - info.left - space.right,
                );
                const shift = Math.min(overflow, Math.max(0, unshiftedLeft - space.left));
                if (tooltip) {
                    tooltip.dataset.pfCompletionShift = String(shift);
                    tooltip.style.marginLeft = shift ? `-${shift}px` : '';
                }
                return {
                    style: 'top: 0; left: 100%',
                    class: 'cm-completionInfo-right',
                };
            },
            addToOptions: [{
                position: 20,
                render(completion) {
                    const kind = completion.type?.split(/\s+/)[0] ?? 'text';
                    const element = document.createElement('span');
                    element.className = `cm-pf-completion-kind cm-pf-completion-kind-${kind}`;
                    const icon = COMPLETION_KIND_ICONS[kind] ?? 'lucide:circle-help';
                    element.style.setProperty(
                        '--pf-completion-kind-icon',
                        `url("${getLocalIconUrl(icon)}")`,
                    );
                    element.title = kind;
                    element.setAttribute('aria-hidden', 'true');
                    return element;
                },
            }],
        }),
        tooltips({
            parent: typeof document === 'undefined' ? undefined : document.body,
            tooltipSpace: view => {
                const root = view.dom.ownerDocument.documentElement;
                return {
                    left: 8,
                    top: 8,
                    right: root.clientWidth - 8,
                    bottom: root.clientHeight - 8,
                };
            },
        }),
        ...(options.wordWrap === 'on' ? [EditorView.lineWrapping] : []),
        ...(options.contextmenu === false ? [EditorView.domEventHandlers({
            contextmenu() {
                return true;
            },
        })] : []),
        EditorView.theme({
            '&': {
                height: '100%',
            },
            ...(options.lineNumbersMinChars ? {
                '.cm-gutters': {
                    minWidth: `${options.lineNumbersMinChars + 1}ch`,
                },
            } : {}),
            '.cm-scroller': {
                overflowX: options.scrollbar?.horizontal === 'visible'
                    ? 'scroll'
                    : options.scrollbar?.horizontal ?? 'auto',
                overflowY: options.scrollbar?.vertical === 'visible'
                    ? 'scroll'
                    : options.scrollbar?.vertical ?? 'auto',
            },
        }),
        ...(gizmos ? [codeGizmoExtension(value ?? defaultValue ?? '', {
            selectorGizmos,
            onClick: onGizmoClick,
        })] : []),
        ...extensions,
    ], [
        editorLanguage,
        extensions,
        options.lineNumbersMinChars,
        options.contextmenu,
        options.scrollbar,
        options.tabSize,
        options.wordWrap,
        readOnly,
        defaultValue,
        gizmos,
        onGizmoClick,
        selectorGizmos,
        value,
    ]);
    const handleChange = useCallback((nextValue: string, update: Parameters<NonNullable<CodeEditorProps['onChange']>>[1]) => {
        onChange?.(nextValue, update);
    }, [onChange]);
    const handleMount = useCallback((view: EditorView) => {
        editorViewRef.current = view;
        onMount?.(view);
    }, [onMount]);

    useEffect(() => {
        if (value !== undefined && editorViewRef.current) {
            setEditorValue(editorViewRef.current, value);
        }
    }, [value]);

    return (
        <S.EditorScope
            className={className}
            $height={normalizeHeight(height)}
            $fontFamily={options.fontFamily ?? "'JetBrains Mono', 'Fira Code', monospace"}
            $fontSize={options.fontSize ?? 13}
            $lineHeight={options.lineHeight}
            $paddingTop={options.padding?.top ?? 0}
            $paddingBottom={options.padding?.bottom ?? 0}
            $contextMenu={options.contextmenu !== false}
        >
            <ReactCodeMirror
                value={initialValueRef.current}
                height="100%"
                theme={resolvedEditorTheme}
                placeholder={placeholder}
                readOnly={readOnly}
                editable={!readOnly}
                autoFocus={autoFocus}
                basicSetup={basicSetup ? {
                    lineNumbers: options.lineNumbers !== 'off',
                    foldGutter: options.folding ?? options.lineNumbers !== 'off',
                    highlightActiveLine: options.renderLineHighlight !== 'none',
                    highlightActiveLineGutter: options.renderLineHighlight !== 'none',
                    autocompletion: false,
                    allowMultipleSelections: true,
                } : false}
                extensions={editorExtensions}
                onChange={handleChange}
                onCreateEditor={handleMount}
                onUpdate={onUpdate}
            />
        </S.EditorScope>
    );
}
