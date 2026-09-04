import type { OnMount } from '@monaco-editor/react';
import type { NodalAutocompleteContext } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/staticAnalysis';
import {
    completionRange,
    getNestedRecord,
    isCompletionRecord,
    matchesCompletionModelUri,
    topLevelPathSuggestions,
    type CompletionModel,
    type CompletionPosition,
} from './completionCore';
import { PAGE_AUTOCOMPLETE_ENTRIES, type PageAutocompleteEntry } from './pageAutocomplete';

const ROOT_COMPLETION_PATTERN = /(?:^|[^\w$.])(\$[a-zA-Z_]*)$/;
const NODAL_EXPRESSION_FUNCTIONS = new Set([
    '$',
    '$vars',
    '$if',
    '$ifEmpty',
    '$max',
    '$min',
    '$sortDates',
    '$parseDates',
    '$currentDate',
    '$currentDateMinusOneMonth',
    '$currentDatePlusOneMonth',
    '$matchSequence',
]);

const escapeStringContent = (value: string, quote: string) => value
    .replaceAll('\\', '\\\\')
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n')
    .replaceAll(quote, `\\${quote}`);

const entriesForPath = (entries: PageAutocompleteEntry[], path: string) => {
    let current = entries;
    for (const segment of path.split('.').filter(Boolean)) {
        const next = current.find(entry => entry.key === segment);
        if (!next?.children) return [];
        current = next.children;
    }

    return current;
};

const pageEntrySuggestions = (
    monaco: Parameters<OnMount>[1],
    entries: PageAutocompleteEntry[],
    rootPath: string,
    range: ReturnType<typeof completionRange>,
) => entries.map(entry => ({
    label: entry.key,
    kind: entry.type === 'method'
        ? monaco.languages.CompletionItemKind.Method
        : monaco.languages.CompletionItemKind.Property,
    insertText: entry.type === 'method' ? `${entry.key}()` : entry.key,
    detail: entry.detail,
    documentation: `${rootPath}.${entry.key} - ${entry.documentation}`,
    range,
    sortText: entry.key,
}));

export function registerInputCompletions(monaco: Parameters<OnMount>[1], defaultInputs: Record<string, unknown> | null, modelUri?: string | null) {
    if (!monaco) return { dispose: () => {} };

    return monaco.languages.registerCompletionItemProvider('javascript', {
        triggerCharacters: ['$', '.', '['],
        provideCompletionItems: (model: CompletionModel, position: CompletionPosition) => {
            if (!matchesCompletionModelUri(model, modelUri)) return { suggestions: [] };

            const lineContent = model.getLineContent(position.lineNumber);
            const textBefore = lineContent.substring(0, position.column - 1);
            const rootMatch = textBefore.match(ROOT_COMPLETION_PATTERN);

            if (rootMatch) {
                const typed = rootMatch[1];
                const range = completionRange(position, typed);

                return {
                    suggestions: [
                        {
                            label: '$input',
                            kind: monaco.languages.CompletionItemKind.Variable,
                            insertText: '$input',
                            detail: 'flow input',
                            documentation: 'Current flow input data.',
                            range,
                        },
                    ],
                };
            }

            if (!defaultInputs || Object.keys(defaultInputs).length === 0) return { suggestions: [] };

            const bracketMatch = textBefore.match(/\$input\s*\[\s*(['"])([a-zA-Z0-9_]*)$/);
            if (bracketMatch) {
                const typed = bracketMatch[2];
                const range = completionRange(position, typed);
                const topKeys = Object.keys(defaultInputs);
                return {
                    suggestions: topKeys.map(key => ({
                        label: key,
                        kind: monaco.languages.CompletionItemKind.Field,
                        insertText: key,
                        detail: `input key`,
                        documentation: `$input["${key}"] - ${typeof defaultInputs?.[key]}`,
                        range,
                    })),
                };
            }

            const dotMatch = textBefore.match(/\$input((?:\.[a-zA-Z_]\w*)*)\.([a-zA-Z_]\w*)?$/);
            if (!dotMatch) return { suggestions: [] };

            const parentPath = dotMatch[1].replace(/^\./, '');
            const typed = dotMatch[2] ?? '';
            const target = getNestedRecord(defaultInputs, parentPath);
            if (!target) return { suggestions: [] };

            return {
                suggestions: topLevelPathSuggestions(monaco, target, parentPath ? `$input.${parentPath}` : '$input', completionRange(position, typed)),
            };
        },
    });
}

export function registerNodalAutocompleteCompletions(
    monaco: Parameters<OnMount>[1],
    context: Omit<NodalAutocompleteContext, 'outputData'> & { outputData?: unknown },
    modelUri?: string | null,
) {
    if (!monaco) return { dispose: () => {} };

    return monaco.languages.registerCompletionItemProvider('javascript', {
        triggerCharacters: ['$', '.', '[', '(', ')', "'", '"'],
        provideCompletionItems: (model: CompletionModel, position: CompletionPosition) => {
            if (!matchesCompletionModelUri(model, modelUri)) return { suggestions: [] };

            const lineContent = model.getLineContent(position.lineNumber);
            const textBefore = lineContent.substring(0, position.column - 1);
            const nodeData = isCompletionRecord(context.nodeData) ? context.nodeData : null;
            const nodeNames = Object.keys(nodeData ?? {}).filter(key => key !== 'last');
            const rootRunData = isCompletionRecord(context.runData) ? context.runData : null;
            const runData = isCompletionRecord(nodeData?.last) ? nodeData.last : rootRunData;
            const loopData = isCompletionRecord(runData?.$loop)
                ? runData.$loop
                : isCompletionRecord(rootRunData?.$loop) ? rootRunData.$loop : null;
            const captureData = isCompletionRecord(runData?.$capture)
                ? runData.$capture
                : isCompletionRecord(rootRunData?.$capture) ? rootRunData.$capture : null;

            const rootMatch = textBefore.match(ROOT_COMPLETION_PATTERN);
            if (rootMatch) {
                const typed = rootMatch[1];
                const range = completionRange(position, typed);
                const roots = [
                    { key: '$', detail: 'node result lookup', documentation: 'Get an executed node result by step name. Equivalent to $nodes[nodeName].' },
                    { key: '$page', detail: 'browser page', documentation: 'Current browser page data.' },
                    { key: '$nodes', detail: 'node results', documentation: 'Internal result values from executed nodal nodes.' },
                    { key: '$run', detail: 'current input snapshot', documentation: 'Output of the node executed immediately before this node. Use $("RUN") for the initial RUN data.' },
                    ...(loopData ? [{
                        key: '$loop',
                        detail: 'current loop context',
                        documentation: 'Item and index for the closest active loop.',
                    }] : []),
                    ...(captureData ? [{
                        key: '$capture',
                        detail: 'current network capture',
                        documentation: 'Request and response payload for the current Sniffing branch execution.',
                    }] : []),
                    { key: '$vars', detail: 'site variables', documentation: 'Global site variables.' },
                    { key: '$now', detail: 'current date and time', documentation: 'Current run DateTime.' },
                    { key: '$today', detail: 'start of today', documentation: 'Current day at midnight.' },
                    { key: '$if', detail: 'conditional value', documentation: 'Return one of two values depending on a condition.' },
                    { key: '$ifEmpty', detail: 'fallback value', documentation: 'Return a fallback for an empty value.' },
                    { key: '$max', detail: 'maximum number', documentation: 'Return the highest supplied number.' },
                    { key: '$min', detail: 'minimum number', documentation: 'Return the lowest supplied number.' },
                    { key: '$sortDates', detail: 'sort dates', documentation: 'Sort date strings using a format.' },
                    { key: '$parseDates', detail: 'parse dates', documentation: 'Parse date strings using a format.' },
                    { key: '$currentDate', detail: 'current date parts', documentation: 'Return day, month, and year.' },
                    { key: '$currentDateMinusOneMonth', detail: 'previous month date', documentation: 'Return date parts one month earlier.' },
                    { key: '$currentDatePlusOneMonth', detail: 'next month date', documentation: 'Return date parts one month later.' },
                    { key: '$matchSequence', detail: 'match sequence', documentation: 'Find a consecutive sequence matching patterns.' },
                    { key: '$viewportWidth', detail: 'viewport width', documentation: 'Effective browser viewport width in pixels.' },
                    { key: '$viewportHeight', detail: 'viewport height', documentation: 'Effective browser viewport height in pixels.' },
                    ...context.locals.map(local => ({
                        key: local.key,
                        detail: local.type === 'loop_index' ? 'loop index' : 'loop item',
                        documentation: local.key,
                    })),
                ];

                return {
                    suggestions: roots.map(root => ({
                        label: root.key,
                        kind: NODAL_EXPRESSION_FUNCTIONS.has(root.key)
                            ? monaco.languages.CompletionItemKind.Function
                            : monaco.languages.CompletionItemKind.Variable,
                        insertText: NODAL_EXPRESSION_FUNCTIONS.has(root.key) ? `${root.key}()` : root.key,
                        detail: root.detail,
                        documentation: root.documentation,
                        range,
                    })),
                };
            }

            const nodeLookupStart = textBefore.match(/\$\(\s*$/);
            const nodeBracketStart = textBefore.match(/\$nodes\s*\[\s*$/);
            if (nodeLookupStart || nodeBracketStart) {
                const range = completionRange(position, '');
                return {
                    suggestions: nodeNames.map(key => ({
                        label: key,
                        kind: monaco.languages.CompletionItemKind.Field,
                        insertText: JSON.stringify(key),
                        detail: 'node result',
                        documentation: nodeLookupStart
                            ? `$(${JSON.stringify(key)})`
                            : `$nodes[${JSON.stringify(key)}]`,
                        range,
                        sortText: key,
                    })),
                };
            }

            const nodeLookupMatch = textBefore.match(/\$\(\s*(['"])([^'"]*)$/);
            if (nodeLookupMatch) {
                const typed = nodeLookupMatch[2];
                const range = completionRange(position, typed);
                return {
                    suggestions: nodeNames.map(key => ({
                        label: key,
                        kind: monaco.languages.CompletionItemKind.Field,
                        insertText: escapeStringContent(key, nodeLookupMatch[1]),
                        detail: 'node result',
                        documentation: `$(${JSON.stringify(key)})`,
                        range,
                        sortText: key,
                    })),
                };
            }

            const bracketMatch = textBefore.match(/\$(page|nodes|run|loop|capture)\s*\[\s*(['"])([^'"]*)$/);
            if (bracketMatch) {
                const root = `$${bracketMatch[1]}`;
                const source = bracketMatch[1] === 'page'
                        ? context.pageData
                        : bracketMatch[1] === 'nodes'
                            ? nodeData
                        : bracketMatch[1] === 'run'
                            ? runData
                            : bracketMatch[1] === 'loop'
                                    ? loopData
                                    : captureData;
                const typed = bracketMatch[3];
                const range = completionRange(position, typed);

                if (bracketMatch[1] === 'page') {
                    return {
                        suggestions: pageEntrySuggestions(monaco, PAGE_AUTOCOMPLETE_ENTRIES, root, range).map(suggestion => ({
                            ...suggestion,
                            insertText: suggestion.label,
                        })),
                    };
                }

                return {
                    suggestions: (
                        bracketMatch[1] === 'nodes'
                            ? nodeNames
                            : Object.keys(source ?? {})
                    ).map(key => ({
                        label: key,
                        kind: monaco.languages.CompletionItemKind.Field,
                        insertText: escapeStringContent(key, bracketMatch[2]),
                        detail: `${bracketMatch[1]} key`,
                        documentation: `${root}["${key}"]`,
                        range,
                        sortText: key,
                    })),
                };
            }

            // Matches `$("Node")`, `$("Node").` and `$("Node").a.b`; the trailing segment is optional
            // so completions triggered by `)` can insert the leading dot themselves.
            const nodeDotMatch = textBefore.match(
                /\$\(\s*(['"])([^'"]+)\1\s*\)((?:\.[a-zA-Z_$][\w$]*)*?)(\.([a-zA-Z_$][\w$]*)?)?$/,
            );
            if (nodeDotMatch) {
                const nodeName = nodeDotMatch[2];
                const parentPath = nodeDotMatch[3].replace(/^\./, '');
                const typed = nodeDotMatch[5] ?? '';
                const source = isCompletionRecord(nodeData?.[nodeName]) ? nodeData[nodeName] : null;
                const target = getNestedRecord(source, parentPath);
                if (!target) return { suggestions: [] };

                const rootPath = `$(${JSON.stringify(nodeName)})${parentPath ? `.${parentPath}` : ''}`;
                const suggestions = topLevelPathSuggestions(
                    monaco,
                    target,
                    rootPath,
                    completionRange(position, typed),
                );
                const needsDot = nodeDotMatch[4] === undefined;

                return {
                    suggestions: needsDot
                        ? suggestions.map(suggestion => ({
                            ...suggestion,
                            insertText: `.${suggestion.insertText}`,
                        }))
                        : suggestions,
                };
            }

            const dotMatch = textBefore.match(/(\$(?:page|nodes|run|loop|capture))((?:\.[a-zA-Z_$][\w$]*)*)\.([a-zA-Z_$][\w$]*)?$/);
            if (!dotMatch) return { suggestions: [] };

            const root = dotMatch[1];
            const parentPath = dotMatch[2].replace(/^\./, '');
            const typed = dotMatch[3] ?? '';

            const source = root === '$page'
                    ? context.pageData
                    : root === '$nodes'
                        ? nodeData
                    : root === '$run'
                        ? runData
                        : root === '$loop'
                                ? loopData
                                : captureData;

            if (root === '$page') {
                return {
                    suggestions: pageEntrySuggestions(monaco, entriesForPath(PAGE_AUTOCOMPLETE_ENTRIES, parentPath), parentPath ? `${root}.${parentPath}` : root, completionRange(position, typed)),
                };
            }

            const target = getNestedRecord(source, parentPath);
            if (!target) return { suggestions: [] };

            return { suggestions: topLevelPathSuggestions(monaco, target, parentPath ? `${root}.${parentPath}` : root, completionRange(position, typed)) };
        },
    });
}
