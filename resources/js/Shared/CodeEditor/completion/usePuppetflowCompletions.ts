import { useMemo } from 'react';
import {
    snippetCompletion,
    startCompletion,
    type Completion,
    type CompletionContext,
    type CompletionResult,
    type CompletionSection,
    type CompletionSource,
} from '@codemirror/autocomplete';
import { EditorState, type Extension } from '@codemirror/state';
import { usePageProps } from '@/App/Hooks/usePageProps';
import { fetchAiModelSuggestions } from '@/Domains/AiModel/aiModelSuggestions';
import type { NodalAutocompleteContext } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/staticAnalysis';
import type { NodalParamDef } from '@/Domains/Flow/Pages/FlowEditor/types';
import { fetchChannelSuggestions } from '@/Domains/Flow/Pages/FlowEditor/utils/channelSuggestions';
import { fetchDataTableSuggestions } from '@/Domains/Flow/Pages/FlowEditor/utils/dataTableSuggestions';
import { ALL_HELP_ENTRIES } from '@/Domains/Flow/Pages/FlowEditor/utils/helpCatalog';
import { fetchMailboxWatcherSuggestions } from '@/Domains/Flow/Pages/FlowEditor/utils/mailboxWatcherSuggestions';
import { fetchSnippetSuggestions } from '@/Domains/Flow/Pages/FlowEditor/utils/snippetSuggestions';
import { getHelpEntryDocumentationPath } from '@/Domains/Flow/Pages/FlowEditor/utils/helpDocumentation';
import {
    PAGE_AUTOCOMPLETE_ENTRIES,
    type PageAutocompleteEntry,
} from '@/Domains/Flow/Pages/FlowEditor/utils/pageAutocomplete';
import {
    collectNamedCookieJarsFromCode,
    DEFAULT_COOKIE_JAR_NAME,
} from '@/Domains/Flow/Pages/FlowEditor/utils/cookieJarSuggestions';
import {
    collectNamedSniffProfilesFromCode,
    DEFAULT_SNIFF_PROFILE_NAME,
} from '@/Domains/Flow/Pages/FlowEditor/utils/sniffProfileSuggestions';
import {
    collectNamedStopwatchesFromCode,
    DEFAULT_STOPWATCH_NAME,
} from '@/Domains/Flow/Pages/FlowEditor/utils/stopwatchNameSuggestions';
import {
    collectNamedTabsFromCode,
    DEFAULT_TAB_NAME,
} from '@/Domains/Flow/Pages/FlowEditor/utils/tabNameSuggestions';
import {
    fetchVariableSuggestionsForAutocomplete,
} from '@/Domains/Flow/Pages/FlowEditor/utils/variableSuggestions';
import {
    createCompletionSection,
    LOCAL_COMPLETION_SECTION,
} from './sections';
import {
    DATA_TABLE_RESOURCE_HELPERS,
    getResourceArgumentRule,
} from './resourceArgumentRules';

export type PuppetflowCompletionMode =
    | 'code-flow'
    | 'nodal-expression'
    | 'nodal-code'
    | 'snippet';

export interface PuppetflowCompletionOptions {
    mode: PuppetflowCompletionMode;
    flowId?: Id;
    defaultInputs?: Record<string, unknown> | null;
    nodalContext?: NodalAutocompleteContext | null;
    documentationBaseUrl?: string;
}

const SECTIONS = {
    local: LOCAL_COMPLETION_SECTION,
    suggested: createCompletionSection('Suggested', 1),
    earlierNodes: createCompletionSection('Earlier nodes', 2),
    tools: createCompletionSection('Tools', 3),
    methods: createCompletionSection('Methods', 4),
    snippets: createCompletionSection('Snippets', 5),
};

const SUGGESTED = new Set(['$run', '$input', '$page', '$now', '$today', '$if', '$ifEmpty']);
const CODE_FLOW_EXCLUDED_HELPERS = new Set(['$if', '$ifEmpty']);
const NODAL_EXPRESSION_HELPERS = new Set([
    '$vars',
    '$now',
    '$today',
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
    '$viewportWidth',
    '$viewportHeight',
]);
const DATE_TIME_COMPLETIONS: Array<{
    name: string;
    type: 'method' | 'property';
    detail: string;
    documentation: string;
}> = [
    { name: 'format', type: 'method', detail: 'format(dateFormat?: string): string', documentation: 'Format using Luxon tokens, for example dd/LL/yyyy.' },
    { name: 'minus', type: 'method', detail: 'minus(amount: number, unit?: string): DateTime', documentation: 'Subtract a duration.' },
    { name: 'plus', type: 'method', detail: 'plus(amount: number, unit?: string): DateTime', documentation: 'Add a duration.' },
    { name: 'diffTo', type: 'method', detail: 'diffTo(otherDate, unit?): number | object', documentation: 'Return the difference to another date.' },
    { name: 'extract', type: 'method', detail: 'extract(part?: string): number', documentation: 'Extract a component such as year, month, day, or hour.' },
    { name: 'endOf', type: 'method', detail: 'endOf(unit: string): DateTime', documentation: 'Move to the end of a time unit.' },
    { name: 'set', type: 'method', detail: 'set(values: object): DateTime', documentation: 'Set DateTime components.' },
    { name: 'setLocale', type: 'method', detail: 'setLocale(locale: string): DateTime', documentation: 'Return a DateTime with another locale.' },
    { name: 'setZone', type: 'method', detail: 'setZone(zone?: string): DateTime', documentation: 'Return a DateTime converted to another timezone.' },
    { name: 'startOf', type: 'method', detail: 'startOf(unit: string): DateTime', documentation: 'Move to the start of a time unit.' },
    { name: 'toLocal', type: 'method', detail: 'toLocal(): DateTime', documentation: 'Convert to the local timezone.' },
    { name: 'toUTC', type: 'method', detail: 'toUTC(offset?: number): DateTime', documentation: 'Convert to UTC.' },
    { name: 'diffToNow', type: 'method', detail: 'diffToNow(unit?: string): number | object', documentation: 'Return the difference to now.' },
    { name: 'equals', type: 'method', detail: 'equals(otherDate: DateTime): boolean', documentation: 'Check exact equality with another DateTime.' },
    { name: 'hasSame', type: 'method', detail: 'hasSame(otherDate: DateTime, unit: string): boolean', documentation: 'Compare a time unit with another DateTime.' },
    { name: 'isBetween', type: 'method', detail: 'isBetween(firstDate, secondDate): boolean', documentation: 'Check whether this DateTime is between two dates.' },
    { name: 'toISO', type: 'method', detail: 'toISO(options?: object): string | null', documentation: 'Format as ISO 8601.' },
    { name: 'toJSDate', type: 'method', detail: 'toJSDate(): Date', documentation: 'Convert to a JavaScript Date.' },
    { name: 'toLocaleString', type: 'method', detail: 'toLocaleString(options?: object): string', documentation: 'Format using locale options.' },
    { name: 'toMillis', type: 'method', detail: 'toMillis(): number', documentation: 'Return the epoch timestamp in milliseconds.' },
    { name: 'toRelative', type: 'method', detail: 'toRelative(options?: object): string | null', documentation: 'Return a relative time string.' },
    { name: 'toSeconds', type: 'method', detail: 'toSeconds(): number', documentation: 'Return the epoch timestamp in seconds.' },
    { name: 'toJSON', type: 'method', detail: 'toJSON(): string | null', documentation: 'Serialize the DateTime as JSON.' },
    { name: 'toString', type: 'method', detail: 'toString(): string', documentation: 'Return the DateTime as a string.' },
    { name: 'valueOf', type: 'method', detail: 'valueOf(): number', documentation: 'Return the epoch timestamp in milliseconds.' },
    { name: 'day', type: 'property', detail: 'day: number', documentation: 'Day of the month.' },
    { name: 'hour', type: 'property', detail: 'hour: number', documentation: 'Hour of the day.' },
    { name: 'isInDST', type: 'property', detail: 'isInDST: boolean', documentation: 'Whether daylight saving time applies.' },
    { name: 'isInLeapYear', type: 'property', detail: 'isInLeapYear: boolean', documentation: 'Whether the year is a leap year.' },
    { name: 'isWeekend', type: 'property', detail: 'isWeekend: boolean', documentation: 'Whether the date falls on a weekend.' },
    { name: 'locale', type: 'property', detail: 'locale: string', documentation: 'Locale used by this DateTime.' },
    { name: 'millisecond', type: 'property', detail: 'millisecond: number', documentation: 'Millisecond component.' },
    { name: 'minute', type: 'property', detail: 'minute: number', documentation: 'Minute component.' },
    { name: 'month', type: 'property', detail: 'month: number', documentation: 'Month number from 1 to 12.' },
    { name: 'monthLong', type: 'property', detail: 'monthLong: string', documentation: 'Localized long month name.' },
    { name: 'monthShort', type: 'property', detail: 'monthShort: string', documentation: 'Localized short month name.' },
    { name: 'quarter', type: 'property', detail: 'quarter: number', documentation: 'Quarter number from 1 to 4.' },
    { name: 'second', type: 'property', detail: 'second: number', documentation: 'Second component.' },
    { name: 'weekday', type: 'property', detail: 'weekday: number', documentation: 'Weekday number from Monday 1 to Sunday 7.' },
    { name: 'weekdayLong', type: 'property', detail: 'weekdayLong: string', documentation: 'Localized long weekday name.' },
    { name: 'weekdayShort', type: 'property', detail: 'weekdayShort: string', documentation: 'Localized short weekday name.' },
    { name: 'weekNumber', type: 'property', detail: 'weekNumber: number', documentation: 'ISO week number.' },
    { name: 'year', type: 'property', detail: 'year: number', documentation: 'Full year.' },
    { name: 'zone', type: 'property', detail: 'zone: Zone', documentation: 'Timezone object.' },
];

const isRecord = (value: unknown): value is Record<string, unknown> => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const applyAndContinueCompletion = (value: string): NonNullable<Completion['apply']> => (
    view,
    _completion,
    from,
    to,
) => {
    view.dispatch({
        changes: { from, to, insert: value },
        selection: { anchor: from + value.length },
    });
    queueMicrotask(() => {
        if (view.dom.isConnected) startCompletion(view);
    });
};

const infoNode = (
    signature: string,
    description: string,
    example?: string,
    documentationUrl?: string,
    details: Array<{ label: string; value: string }> = [],
    schema: Array<{ name: string; type: string }> = [],
) => {
    const container = document.createElement('div');
    container.className = 'cm-puppetflow-completion-info';
    const code = document.createElement('code');
    code.textContent = signature;
    container.appendChild(code);
    const paragraph = document.createElement('p');
    paragraph.textContent = description;
    container.appendChild(paragraph);
    if (details.length > 0) {
        const detailList = document.createElement('dl');
        detailList.className = 'cm-puppetflow-completion-details';
        details.forEach(detail => {
            const label = document.createElement('dt');
            label.textContent = detail.label;
            const value = document.createElement('dd');
            value.textContent = detail.value;
            detailList.append(label, value);
        });
        container.appendChild(detailList);
    }
    if (schema.length > 0) {
        const schemaBlock = document.createElement('div');
        schemaBlock.className = 'cm-puppetflow-completion-schema';
        const schemaTitle = document.createElement('strong');
        schemaTitle.textContent = 'Schema';
        schemaBlock.appendChild(schemaTitle);
        schema.forEach(column => {
            const row = document.createElement('div');
            const name = document.createElement('code');
            name.textContent = column.name;
            const type = document.createElement('span');
            type.textContent = column.type;
            row.append(name, type);
            schemaBlock.appendChild(row);
        });
        container.appendChild(schemaBlock);
    }
    if (example) {
        const exampleNode = document.createElement('pre');
        exampleNode.textContent = example;
        container.appendChild(exampleNode);
    }
    if (documentationUrl) {
        const link = document.createElement('a');
        link.className = 'cm-puppetflow-doc-link';
        link.href = documentationUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Open documentation';
        container.appendChild(link);
    }
    return container;
};

const linePrefix = (context: CompletionContext) => {
    const line = context.state.doc.lineAt(context.pos);
    return {
        text: line.text.slice(0, context.pos - line.from),
        lineFrom: line.from,
    };
};

const escapeQuotedCompletion = (value: string, quote: string) => {
    const escaped = value
        .replaceAll('\\', '\\\\')
        .replaceAll('\r', '\\r')
        .replaceAll('\n', '\\n')
        .replaceAll(quote, `\\${quote}`);
    return quote === '`' ? escaped.replace(/\$\{/g, '\\${') : escaped;
};

const helperCompletions = (
    mode: PuppetflowCompletionMode,
    documentationBaseUrl?: string,
): Completion[] => {
    return ALL_HELP_ENTRIES
        .filter(entry => entry.availability !== 'none')
        .filter(entry => mode !== 'code-flow' || !CODE_FLOW_EXCLUDED_HELPERS.has(entry.name))
        .filter(entry => mode === 'nodal-expression'
            ? NODAL_EXPRESSION_HELPERS.has(entry.name)
            : entry.availability !== 'nodal')
        .map((entry): Completion => {
            const signature = entry.signature;
            const rawArgs = signature.match(/\((.*)\)/)?.[1] ?? '';
            const args = rawArgs
                .split(',')
                .map(arg => arg.trim().replace(/\?$/, '').replace(/^\.\.\./, ''))
                .filter(Boolean);
            const template = args.length > 0
                ? `${entry.name}(${args.map((arg, index) => `\${${index + 1}:${arg}}`).join(', ')})`
                : `${entry.name}()`;
            const targetSection = SUGGESTED.has(entry.name)
                ? SECTIONS.suggested
                : SECTIONS.methods;
            const documentationPath = getHelpEntryDocumentationPath(entry);
            const documentationUrl = documentationPath && documentationBaseUrl
                ? `${documentationBaseUrl.replace(/\/+$/, '')}/${documentationPath.replace(/^\/+/, '')}`
                : undefined;
            const completionInfo = () => infoNode(
                signature,
                entry.nodalDesc ?? entry.desc,
                entry.evalExpr,
                documentationUrl,
            );

            if (!signature.includes('(')) {
                return {
                    label: entry.name,
                    apply: entry.name,
                    type: 'variable',
                    detail: signature,
                    section: targetSection,
                    boost: targetSection === SECTIONS.suggested ? 20 : 0,
                    info: completionInfo,
                };
            }

            return snippetCompletion(template, {
                label: entry.name,
                type: 'function',
                detail: signature,
                section: targetSection,
                boost: targetSection === SECTIONS.suggested ? 20 : 0,
                info: completionInfo,
            });
        });
};

const matchesSearch = (query: string, ...values: Array<string | number>) => {
    const normalizedQuery = query.toLowerCase();
    return !normalizedQuery || values.some(value =>
        String(value).toLowerCase().includes(normalizedQuery));
};

const snippetCompletions = async (query = ''): Promise<Completion[]> => {
    const snippets = await fetchSnippetSuggestions();
    return snippets
        .filter(snippet => matchesSearch(query, snippet.id, snippet.label))
        .map(snippet => snippetCompletion(
        `$$${snippet.id}(${snippet.args})`,
        {
            label: `$$${snippet.id}`,
            displayLabel: snippet.label,
            type: 'function',
            detail: snippet.args,
            section: SECTIONS.snippets,
            info: () => infoNode(
                `$$${snippet.id}(${snippet.args})`,
                snippet.description ?? snippet.label,
            ),
        },
        ));
};

const previousNodeNames = (nodalContext?: NodalAutocompleteContext | null) => (
    Object.keys(nodalContext?.nodeData ?? {})
        .filter(name => name !== 'RUN' && name !== 'last')
);

const earlierNodeCompletions = (
    nodalContext?: NodalAutocompleteContext | null,
): Completion[] => previousNodeNames(nodalContext).map(name => {
    const lookup = `$(${JSON.stringify(name)})`;
    return {
        label: lookup,
        apply: lookup,
        type: 'variable',
        detail: 'Earlier node result',
        section: SECTIONS.earlierNodes,
        info: () => infoNode(lookup, `Output snapshot from the earlier node ${name}.`),
    };
});

const staticRootCompletions = (
    mode: PuppetflowCompletionMode,
    nodalContext?: NodalAutocompleteContext | null,
    documentationBaseUrl?: string,
): Completion[] => {
    const roots: Completion[] = mode === 'code-flow'
        ? [
            { label: '$input', type: 'variable', detail: 'Flow input', section: SECTIONS.local },
            { label: '$page', type: 'variable', detail: 'Puppeteer Page', section: SECTIONS.local },
            { label: '$client', type: 'variable', detail: 'CDP session', section: SECTIONS.local },
        ]
        : [
            { label: '$run', type: 'variable', detail: 'Current input snapshot', section: SECTIONS.suggested },
            { label: '$nodes', type: 'variable', detail: 'Earlier node results', section: SECTIONS.earlierNodes },
            { label: '$page', type: 'variable', detail: 'Puppeteer Page', section: SECTIONS.suggested },
            ...(nodalContext?.runData?.$loop ? [{ label: '$loop', type: 'variable', detail: 'Current loop', section: SECTIONS.suggested }] : []),
            ...(nodalContext?.runData?.$capture ? [{ label: '$capture', type: 'variable', detail: 'Current network capture', section: SECTIONS.suggested }] : []),
            ...(nodalContext?.locals ?? []).map(local => ({
                label: local.key,
                type: 'variable',
                detail: local.type === 'loop_index' ? 'Loop index' : 'Loop item',
                section: SECTIONS.suggested,
            })),
            ...earlierNodeCompletions(nodalContext),
        ];

    return roots.map(root => ({
        ...root,
        info: () => {
            const helpEntry = ALL_HELP_ENTRIES.find(entry => entry.name === root.label);
            const documentationPath = helpEntry
                ? getHelpEntryDocumentationPath(helpEntry)
                : undefined;
            const documentationUrl = documentationPath && documentationBaseUrl
                ? `${documentationBaseUrl.replace(/\/+$/, '')}/${documentationPath.replace(/^\/+/, '')}`
                : undefined;

            return infoNode(
                helpEntry?.signature ?? root.label,
                helpEntry?.desc ?? String(root.detail ?? 'Puppetflow runtime value'),
                helpEntry?.evalExpr,
                documentationUrl,
            );
        },
    }));
};

const propertyCompletions = (
    source: Record<string, unknown> | null | undefined,
    completionSection: CompletionSection = SECTIONS.methods,
): Completion[] => Object.entries(source ?? {}).map(([key, value]) => {
    const valueType = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
    return {
        label: key,
        type: isRecord(value) ? 'property' : 'variable',
        detail: valueType,
        section: completionSection,
        info: () => infoNode(key, `Property with type ${valueType}.`),
    };
});

const pathValue = (source: Record<string, unknown> | null | undefined, path: string) => {
    let current = source;
    for (const part of path.split('.').filter(Boolean)) {
        const next = current?.[part];
        if (!isRecord(next)) return null;
        current = next;
    }
    return current;
};

const pageEntriesForPath = (path: string): PageAutocompleteEntry[] => {
    let entries = PAGE_AUTOCOMPLETE_ENTRIES;
    for (const segment of path.split('.').filter(Boolean)) {
        entries = entries.find(entry => entry.key === segment)?.children ?? [];
    }
    return entries;
};

const pageEntryCompletions = (
    path: string,
): Completion[] => pageEntriesForPath(path).map(entry => ({
    label: entry.key,
    apply: entry.type === 'method' ? `${entry.key}()` : entry.key,
    type: entry.type,
    detail: entry.detail,
    info: () => infoNode(
        `$page${path ? `.${path}` : ''}.${entry.key}`,
        entry.documentation,
    ),
}));

const splitTopLevelArguments = (value: string) => {
    const args: string[] = [];
    let start = 0;
    let depth = 0;
    let quote: string | null = null;
    let escaped = false;

    for (let index = 0; index < value.length; index += 1) {
        const char = value[index];
        if (quote) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === quote) quote = null;
            continue;
        }
        if (char === '"' || char === "'" || char === '`') {
            quote = char;
            continue;
        }
        if (char === '(' || char === '{' || char === '[') depth += 1;
        if (char === ')' || char === '}' || char === ']') depth -= 1;
        if (char === ',' && depth === 0) {
            args.push(value.slice(start, index));
            start = index + 1;
        }
    }
    args.push(value.slice(start));
    return args;
};

const findActiveHelperCall = (line: string) => {
    const calls = [...line.matchAll(/\$\w+\s*\(/g)];
    for (let index = calls.length - 1; index >= 0; index -= 1) {
        const match = calls[index];
        const openParen = (match.index ?? 0) + match[0].lastIndexOf('(');
        const callBody = line.slice(openParen + 1);
        let parentheses = 0;
        let quote: string | null = null;
        let escaped = false;
        let closed = false;
        for (const char of callBody) {
            if (quote) {
                if (escaped) escaped = false;
                else if (char === '\\') escaped = true;
                else if (char === quote) quote = null;
                continue;
            }
            if (char === '"' || char === "'" || char === '`') {
                quote = char;
                continue;
            }
            if (char === '(') parentheses += 1;
            if (char !== ')') continue;
            if (parentheses === 0) {
                closed = true;
                break;
            }
            parentheses -= 1;
        }
        if (closed) continue;
        const args = splitTopLevelArguments(callBody);
        if (args.length === 0) continue;
        return {
            name: match[0].replace(/\s*\($/, ''),
            from: match.index ?? 0,
            argIndex: args.length - 1,
            currentArg: args.at(-1) ?? '',
        };
    }
    return null;
};

const openObjectBody = (value: string) => {
    let depth = 0;
    let openIndex = -1;
    let quote: string | null = null;
    let escaped = false;
    for (let index = 0; index < value.length; index += 1) {
        const char = value[index];
        if (quote) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === quote) quote = null;
            continue;
        }
        if (char === '"' || char === "'" || char === '`') {
            quote = char;
            continue;
        }
        if (char === '{') {
            if (depth === 0) openIndex = index;
            depth += 1;
        } else if (char === '}') {
            depth -= 1;
            if (depth === 0) openIndex = -1;
        }
    }
    return openIndex === -1 ? null : value.slice(openIndex + 1);
};

const currentObjectKey = (value: string) => {
    const body = openObjectBody(value);
    if (body === null) return null;
    const properties = splitTopLevelArguments(body);
    const current = properties.at(-1) ?? '';
    if (current.includes(':')) return null;
    return current.match(/([a-zA-Z_$][\w$]*)$/)?.[1] ?? '';
};

const helperObjectCompletions = (
    context: CompletionContext,
    documentationBaseUrl?: string,
): CompletionResult | null => {
    const prefix = context.state.doc.sliceString(
        Math.max(0, context.pos - 8000),
        context.pos,
    );
    const call = findActiveHelperCall(prefix);
    if (!call) return null;
    const entry = ALL_HELP_ENTRIES.find(item => item.name === call.name);
    if (!entry) return null;
    const argumentNames = entry.signature
        .match(/\(([^)]*)\)/)?.[1]
        ?.split(',')
        .map(argument => argument.trim().replace(/\?$/, '').replace(/^\.\.\./, ''))
        .filter(Boolean) ?? [];
    const argumentName = argumentNames[call.argIndex];
    if (!argumentName) return null;
    const fields: Record<string, NodalParamDef> | undefined = entry
        .nodalParams?.[argumentName]
        ?.objectFields;
    if (!fields || Object.keys(fields).length === 0) return null;
    const typed = currentObjectKey(call.currentArg);
    if (typed === null) return null;
    const documentationPath = getHelpEntryDocumentationPath(entry);
    const documentationUrl = documentationPath && documentationBaseUrl
        ? `${documentationBaseUrl.replace(/\/+$/, '')}/${documentationPath.replace(/^\/+/, '')}`
        : undefined;

    return {
        from: context.pos - typed.length,
        options: Object.entries(fields).map(([name, field]) => ({
            label: name,
            apply: name,
            type: 'property',
            detail: field.valueType ?? 'option',
            info: () => infoNode(
                `${name}: ${field.valueType ?? 'option'}`,
                field.description,
                undefined,
                documentationUrl,
                [
                    {
                        label: 'Function',
                        value: entry.nodalDesc ?? entry.desc,
                    },
                    { label: 'Type', value: field.valueType ?? 'option' },
                    ...(field.required ? [{ label: 'Required', value: 'Yes' }] : []),
                    ...(field.defaultValue !== undefined
                        ? [{ label: 'Default', value: field.defaultValue }]
                        : []),
                    ...(field.options?.length
                        ? [{
                            label: 'Allowed',
                            value: field.options.map(option => option.label).join(', '),
                        }]
                        : []),
                ],
            ),
        })),
        validFor: /^[\w$]*$/,
    };
};

function createContextSource(options: PuppetflowCompletionOptions): CompletionSource {
    const helpers = helperCompletions(options.mode, options.documentationBaseUrl);
    return async context => {
        const prefix = linePrefix(context);
        const lastNodeData = isRecord(options.nodalContext?.nodeData?.last)
            ? options.nodalContext?.nodeData?.last
            : null;
        const currentRunData = lastNodeData ?? options.nodalContext?.runData;
        const currentLoopData = isRecord(currentRunData?.$loop)
            ? currentRunData.$loop
            : isRecord(options.nodalContext?.runData?.$loop)
                ? options.nodalContext.runData.$loop
                : null;
        const currentCaptureData = isRecord(currentRunData?.$capture)
            ? currentRunData.$capture
            : isRecord(options.nodalContext?.runData?.$capture)
                ? options.nodalContext.runData.$capture
                : null;
        const rootMatch = prefix.text.match(/(?:^|[^\w$.])(\$[a-zA-Z_]*)$/);
        if (rootMatch) {
            const isInitialRoot = rootMatch[1] === '$';
            const roots = staticRootCompletions(
                options.mode,
                options.nodalContext,
                options.documentationBaseUrl,
            );
            const visibleHelpers = isInitialRoot
                ? helpers.filter(completion => completion.section === SECTIONS.suggested)
                : helpers;
            const snippets = isInitialRoot ? await snippetCompletions() : [];
            const seenLabels = new Set<string>();

            return {
                from: context.pos - rootMatch[1].length,
                options: [
                    ...roots,
                    ...visibleHelpers,
                    ...snippets,
                ].filter(completion => {
                    if (seenLabels.has(completion.label)) return false;
                    seenLabels.add(completion.label);
                    return true;
                }),
                validFor: isInitialRoot ? /^\$$/ : /^\$[\w$]*$/,
            };
        }

        const snippetMatch = prefix.text.match(/(\$\$[A-Za-z0-9_]*)$/);
        if (snippetMatch) {
            const typed = snippetMatch[1].slice(2);
            return {
                from: context.pos - snippetMatch[1].length,
                options: await snippetCompletions(typed),
                filter: false,
            };
        }

        const nodeMatch = prefix.text.match(/\$\(\s*(['"])?([^'"]*)$/);
        if (nodeMatch && options.nodalContext?.nodeData) {
            const typed = nodeMatch[2] ?? '';
            return {
                from: context.pos - typed.length,
                options: previousNodeNames(options.nodalContext)
                    .map(name => ({
                        label: name,
                        apply: nodeMatch[1] ? name : `${JSON.stringify(name)})`,
                        type: 'variable',
                        detail: 'Node result',
                        section: SECTIONS.earlierNodes,
                        info: () => infoNode(`$(${JSON.stringify(name)})`, 'Output snapshot from an earlier node.'),
                    })),
            };
        }

        const nodeBracketStart = prefix.text.match(/\$nodes\s*\[\s*$/);
        if (nodeBracketStart && options.nodalContext?.nodeData) {
            return {
                from: context.pos,
                options: previousNodeNames(options.nodalContext)
                    .map(name => ({
                        label: name,
                        apply: JSON.stringify(name),
                        type: 'variable',
                        detail: 'Node result',
                        section: SECTIONS.earlierNodes,
                        info: () => infoNode(
                            `$nodes[${JSON.stringify(name)}]`,
                            'Output snapshot from an earlier node.',
                        ),
                    })),
            };
        }

        const dateTimeMatch = prefix.text.match(
            /(\$(?:now|today)(?:\.[a-zA-Z_$][\w$]*(?:\([^()]*\))?)*)\.([a-zA-Z_$][\w$]*)?$/,
        );
        if (dateTimeMatch && options.mode === 'nodal-expression') {
            const typed = dateTimeMatch[2] ?? '';
            return {
                from: context.pos - typed.length,
                options: DATE_TIME_COMPLETIONS.map(entry => ({
                    label: entry.name,
                    apply: entry.type === 'method' ? `${entry.name}()` : entry.name,
                    type: entry.type,
                    detail: entry.detail,
                    info: () => infoNode(entry.detail, entry.documentation),
                })),
                validFor: /^[\w$]*$/,
            };
        }

        const propertyMatch = prefix.text.match(/(\$(?:input|page|run|nodes|loop|capture))((?:\.[a-zA-Z_$][\w$]*)*)\.([a-zA-Z_$][\w$]*)?$/);
        if (propertyMatch) {
            const root = propertyMatch[1];
            const path = propertyMatch[2].replace(/^\./, '');
            const typed = propertyMatch[3] ?? '';
            if (root === '$page' && options.mode === 'nodal-expression') {
                return {
                    from: context.pos - typed.length,
                    options: pageEntryCompletions(path),
                    validFor: /^[\w$]*$/,
                };
            }
            const source = root === '$input'
                ? options.mode === 'code-flow'
                    ? options.defaultInputs
                    : options.nodalContext?.inputData
                : root === '$page'
                    ? options.nodalContext?.pageData
                : root === '$run'
                    ? currentRunData
                    : root === '$nodes'
                        ? options.nodalContext?.nodeData
                        : root === '$loop'
                            ? currentLoopData
                            : currentCaptureData;
            return {
                from: context.pos - typed.length,
                options: propertyCompletions(pathValue(source, path)),
            };
        }

        const nodePropertyMatch = prefix.text.match(/\$\(\s*(['"])([^'"]+)\1\s*\)((?:\.[a-zA-Z_$][\w$]*)*)\.([a-zA-Z_$][\w$]*)?$/);
        if (nodePropertyMatch && options.nodalContext?.nodeData) {
            const node = options.nodalContext.nodeData[nodePropertyMatch[2]];
            const typed = nodePropertyMatch[4] ?? '';
            return {
                from: context.pos - typed.length,
                options: propertyCompletions(
                    pathValue(isRecord(node) ? node : null, nodePropertyMatch[3].replace(/^\./, '')),
                    SECTIONS.earlierNodes,
                ),
            };
        }

        const bracketMatch = prefix.text.match(/\$(input|page|nodes|run|loop|capture)\s*\[\s*(["'`])([^"'`]*)$/);
        if (bracketMatch) {
            const root = bracketMatch[1];
            const quote = bracketMatch[2];
            const typed = bracketMatch[3] ?? '';
            const source = root === 'input'
                ? options.mode === 'code-flow'
                    ? options.defaultInputs
                    : options.nodalContext?.inputData
                : root === 'page'
                    ? options.nodalContext?.pageData
                : root === 'nodes'
                    ? options.nodalContext?.nodeData
                    : root === 'run'
                        ? currentRunData
                        : root === 'loop'
                            ? currentLoopData
                            : currentCaptureData;
            return {
                from: context.pos - typed.length,
                options: Object.keys(source ?? {}).map(key => ({
                    label: key,
                    apply: escapeQuotedCompletion(key, quote),
                    type: 'property',
                    detail: `${root} property`,
                    info: () => infoNode(
                        `$${root}[${JSON.stringify(key)}]`,
                        `Property with type ${typeof source?.[key]}.`,
                    ),
                })),
            };
        }

        const objectOptions = helperObjectCompletions(context, options.documentationBaseUrl);
        if (objectOptions) return objectOptions;

        return resourceArgumentCompletions(context, options);
    };
}

async function resourceArgumentCompletions(
    context: CompletionContext,
    options: PuppetflowCompletionOptions,
): Promise<CompletionResult | null> {
    const prefixFrom = Math.max(0, context.pos - 8000);
    const prefix = context.state.doc.sliceString(
        prefixFrom,
        context.pos,
    );
    const call = findActiveHelperCall(prefix);
    if (!call) return null;
    const helper = call.name.replace(/^\$/, '');
    const resourceRule = getResourceArgumentRule(helper);
    if (!resourceRule || call.argIndex !== resourceRule.argumentIndex) return null;
    const quotedValue = call.currentArg.match(/^\s*(["'`])([^"'`]*)$/);
    if (!quotedValue) return null;
    const quote = quotedValue[1];
    const typed = quotedValue[2] ?? '';
    let values: Array<{ id: Id; name: string; detail: string }> = [];

    if (helper === 'vars') {
        values = (await fetchVariableSuggestionsForAutocomplete())
            .filter(item => !String(item.id).includes('.'))
            .map(item => ({ id: item.id, name: item.key, detail: item.type }));
    } else if (helper === 'notify' || helper === 'waitHumanValidation') {
        values = (await fetchChannelSuggestions())
            .map(item => ({ id: item.id, name: item.name, detail: item.provider }));
    } else if (helper === 'aiMessage' || helper === 'aiControl') {
        values = (await fetchAiModelSuggestions())
            .filter(item => helper === 'aiControl'
                ? item.capabilities.vision === true
                : item.capabilities.text === true)
            .map(item => ({ id: item.id, name: item.name, detail: item.ai_model_id }));
    } else if (DATA_TABLE_RESOURCE_HELPERS.has(helper) && options.flowId) {
        values = (await fetchDataTableSuggestions(options.flowId))
            .map(item => ({ id: item.id, name: item.name, detail: `${item.columns.length} columns` }));
    } else if (helper === 'waitForEmail' && options.flowId) {
        values = (await fetchMailboxWatcherSuggestions(options.flowId))
            .map(item => ({ id: item.id, name: item.name, detail: item.address }));
    } else {
        const declarationSource = context.state.doc.sliceString(
            0,
            prefixFrom + call.from,
        );
        const collectLocalNames = (source: string) => helper === 'gotoUrl' || helper === 'gotoTab'
            ? collectNamedTabsFromCode(source)
            : helper.startsWith('stopwatch')
                ? collectNamedStopwatchesFromCode(source)
                : helper === 'sniffNetwork' || helper === 'stopSniffing'
                    ? collectNamedSniffProfilesFromCode(source)
                    : collectNamedCookieJarsFromCode(source);
        const localNames = collectLocalNames(declarationSource);
        const knownNames = helper === 'gotoUrl' || helper === 'gotoTab'
            ? options.nodalContext?.tabNames
            : helper.startsWith('stopwatch')
                ? options.nodalContext?.stopwatchNames
                : helper === 'sniffNetwork' || helper === 'stopSniffing'
                    ? options.nodalContext?.sniffProfileNames
                    : options.nodalContext?.cookieJarNames;
        const creationDefault = helper === 'gotoUrl' || helper === 'gotoTab'
            ? DEFAULT_TAB_NAME
            : helper === 'stopwatchStart'
                ? DEFAULT_STOPWATCH_NAME
                : helper === 'sniffNetwork'
                    ? DEFAULT_SNIFF_PROFILE_NAME
                    : helper === 'saveCookies'
                        ? DEFAULT_COOKIE_JAR_NAME
                        : null;
        values = [...new Set([
            ...(creationDefault ? [creationDefault] : []),
            ...(knownNames ?? []),
            ...localNames,
        ])]
            .map(name => ({ id: name, name, detail: 'Named runtime resource' }));
    }

    return {
        from: context.pos - typed.length,
        options: values
            .filter(item => matchesSearch(typed, item.id, item.name))
            .map(item => ({
            label: item.name,
            apply: escapeQuotedCompletion(String(item.id), quote),
            detail: String(item.id),
            type: 'constant',
            section: SECTIONS.tools,
            info: () => infoNode(
                item.name,
                `${helper} resource ${item.id}`,
                undefined,
                undefined,
                [{ label: 'Type', value: item.detail }],
            ),
            })),
        filter: false,
    };
}

const JSON_REFERENCE_NAMESPACES = [
    { label: 'vars', detail: 'Workspace variables' },
    { label: 'channels', detail: 'Notification channels' },
    { label: 'mailboxWatchers', detail: 'Mailbox watchers', requiresFlow: true },
    { label: 'aiModels', detail: 'AI models', requiresFlow: true },
    { label: 'dataTables', detail: 'Data Tables', requiresFlow: true },
] as const;

function createJsonReferenceSource(
    options: PuppetflowCompletionOptions,
): CompletionSource {
    return async context => {
        const prefix = linePrefix(context).text;
        const namespaceMatch = prefix.match(/\$\{([a-zA-Z]*)$/);
        if (namespaceMatch) {
            const typed = namespaceMatch[1] ?? '';
            return {
                from: context.pos - typed.length,
                options: JSON_REFERENCE_NAMESPACES
                    .filter(namespace => !('requiresFlow' in namespace) || options.flowId)
                    .map(namespace => ({
                        label: namespace.label,
                        apply: applyAndContinueCompletion(`${namespace.label}.`),
                        type: 'namespace',
                        detail: namespace.detail,
                        section: SECTIONS.tools,
                        boost: 20,
                        info: () => infoNode(
                            `${namespace.label}.`,
                            namespace.detail,
                            `\${${namespace.label}.reference}`,
                        ),
                    })),
                validFor: /^[a-zA-Z]*$/,
            };
        }

        const referenceMatch = prefix.match(
            /\$\{(vars|channels|mailboxWatchers|aiModels|dataTables)\.([a-zA-Z0-9_.-]*)$/,
        );
        if (!referenceMatch) return null;

        const namespace = referenceMatch[1];
        const path = referenceMatch[2] ?? '';
        const typed = path.split('.').pop() ?? '';
        let values: Array<{
            id: Id;
            name: string;
            detail: string;
            description?: string;
            details?: Array<{ label: string; value: string }>;
            schema?: Array<{ name: string; type: string }>;
        }> = [];

        if (namespace === 'vars') {
            const parentPath = path.includes('.')
                ? path.slice(0, path.lastIndexOf('.'))
                : '';
            values = (await fetchVariableSuggestionsForAutocomplete())
                .filter(variable => parentPath
                    ? String(variable.id).startsWith(`${parentPath}.`)
                        && !String(variable.id).slice(parentPath.length + 1).includes('.')
                    : !String(variable.id).includes('.'))
                .map(variable => ({
                    id: parentPath
                        ? String(variable.id).slice(parentPath.length + 1)
                        : variable.id,
                    name: variable.key.split('.').pop() ?? variable.key,
                    detail: variable.type,
                    description: `Workspace variable ${variable.key}.`,
                    details: [
                        { label: 'Type', value: variable.type },
                        ...(variable.scope ? [{ label: 'Scope', value: variable.scope }] : []),
                        ...(variable.team_name ? [{ label: 'Team', value: variable.team_name }] : []),
                        ...(variable.provider ? [{ label: 'Provider', value: variable.provider }] : []),
                    ],
                }));
        } else if (namespace === 'channels') {
            values = (await fetchChannelSuggestions()).map(channel => ({
                id: channel.id,
                name: channel.name,
                detail: channel.provider,
                description: `Notification channel ${channel.name}.`,
                details: [
                    { label: 'Provider', value: channel.provider },
                    { label: 'Destination', value: channel.destination },
                    { label: 'Scope', value: channel.scope },
                    ...(channel.team_name ? [{ label: 'Team', value: channel.team_name }] : []),
                ],
            }));
        } else if (namespace === 'aiModels') {
            values = (await fetchAiModelSuggestions()).map(model => ({
                id: model.id,
                name: model.name,
                detail: model.ai_model_id,
                description: `AI model ${model.name}.`,
                details: [
                    { label: 'Model', value: model.ai_model_id },
                    { label: 'Provider', value: model.ai_integration.provider },
                    { label: 'Integration', value: model.ai_integration.name },
                    { label: 'Scope', value: model.scope },
                    ...(model.team_name ? [{ label: 'Team', value: model.team_name }] : []),
                    {
                        label: 'Capabilities',
                        value: Object.entries(model.capabilities)
                            .filter(([, enabled]) => enabled)
                            .map(([capability]) => capability)
                            .join(', ') || 'None',
                    },
                ],
            }));
        } else if (namespace === 'mailboxWatchers' && options.flowId) {
            values = (await fetchMailboxWatcherSuggestions(options.flowId)).map(watcher => ({
                id: watcher.id,
                name: watcher.name,
                detail: watcher.address,
                description: `Mailbox watcher ${watcher.name}.`,
                details: [
                    { label: 'Address', value: watcher.address },
                    { label: 'Scope', value: watcher.scope },
                    ...(watcher.team_name ? [{ label: 'Team', value: watcher.team_name }] : []),
                ],
            }));
        } else if (namespace === 'dataTables' && options.flowId) {
            values = (await fetchDataTableSuggestions(options.flowId)).map(table => ({
                id: table.id,
                name: table.name,
                detail: `${table.columns.length} columns`,
                description: table.description || `Data Table ${table.name}.`,
                details: [
                    ...(table.visibility ? [{ label: 'Visibility', value: table.visibility }] : []),
                    { label: 'Access', value: table.can_manage ? 'Manage' : 'Read only' },
                ],
                schema: table.columns.map(column => ({
                    name: column.name,
                    type: column.type,
                })),
            }));
        }

        return {
            from: context.pos - typed.length,
            options: values
                .filter(value => matchesSearch(typed, value.id, value.name))
                .map(value => ({
                label: String(value.id),
                displayLabel: value.name,
                apply: String(value.id),
                type: 'variable',
                detail: String(value.id),
                section: SECTIONS.tools,
                info: () => infoNode(
                    `${namespace}.${value.id}`,
                    value.description ?? `${value.name} (${value.detail})`,
                    undefined,
                    undefined,
                    [
                        { label: 'Type', value: value.detail },
                        ...(value.details ?? []),
                    ],
                    value.schema,
                ),
                })),
            validFor: /^[a-zA-Z0-9_-]*$/,
            filter: false,
        };
    };
}

export function usePuppetflowCompletions(
    options: PuppetflowCompletionOptions | null,
): Extension[] {
    const { settings } = usePageProps();
    const documentationBaseUrl = settings.documentation_url;

    return useMemo(() => {
        if (!options) return [];
        const resolvedOptions = { ...options, documentationBaseUrl };
        const contextSource = createContextSource(resolvedOptions);
        const referenceSource = createJsonReferenceSource(resolvedOptions);
        return [
            EditorState.languageData.of(() => [
                { autocomplete: contextSource },
                { autocomplete: referenceSource },
            ]),
        ];
    }, [documentationBaseUrl, options]);
}
