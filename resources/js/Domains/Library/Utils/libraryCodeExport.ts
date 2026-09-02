import {
    formatCodeInputDefinition,
    inputDefinitionsFromDefaults,
    type ExportedDataTableSchema,
    type ExportedMailboxWatcherSchema,
    type FlowInputDefinition,
} from '@/Domains/Flow/Utils/flowInputsMetadata';

const libraryDocLine = (tag: string, value: string) => `// @${tag} ${value.replace(/\r?\n/g, ' ').trim()}`;

const stripLibraryMetadataHeader = (code: string) => {
    const lines = code.split(/\r?\n/);
    let index = 0;
    let sawMetadata = false;

    while (index < lines.length) {
        const line = lines[index].trim();

        if (line === '') {
            if (sawMetadata) {
                index += 1;
                continue;
            }
            break;
        }

        if (/^\/\/\s*@(title|description|param|input|resource)\s+/i.test(line)) {
            sawMetadata = true;
            index += 1;
            continue;
        }

        break;
    }

    return sawMetadata ? lines.slice(index).join('\n').replace(/^\s*\n/, '') : code;
};

const inputDefinitionsWithValues = (
    inputs: Record<string, unknown> | null | undefined,
    definitions?: FlowInputDefinition[] | null,
) => {
    if (!definitions?.length) return inputDefinitionsFromDefaults(inputs ?? null);

    return definitions.map(definition => ({
        ...definition,
        default: inputs && Object.prototype.hasOwnProperty.call(inputs, definition.name)
            ? inputs[definition.name]
            : definition.default,
    }));
};

export function buildLibraryCompliantCode(item: {
    title: string;
    description?: string | null;
    args?: string | null;
    inputs?: Record<string, unknown> | null;
    inputDefinitions?: FlowInputDefinition[] | null;
    dataTables?: ExportedDataTableSchema[];
    mailboxWatchers?: ExportedMailboxWatcherSchema[];
    code: string;
}) {
    const sourceCode = stripLibraryMetadataHeader(item.code);
    const header = [
        libraryDocLine('title', item.title),
        item.description?.trim() ? libraryDocLine('description', item.description) : null,
        ...inputDefinitionsWithValues(item.inputs, item.inputDefinitions).map(formatCodeInputDefinition),
        ...(item.dataTables ?? []).map(dataTable => (
            libraryDocLine('resource', `data-table ${JSON.stringify(dataTable)}`)
        )),
        ...(item.mailboxWatchers ?? []).map(watcher => (
            libraryDocLine('resource', `mailbox-watcher ${JSON.stringify(watcher)}`)
        )),
        ...(item.args ?? '')
            .split(',')
            .map(arg => arg.trim())
            .filter(Boolean)
            .map(arg => libraryDocLine('param', `{any} ${arg}`)),
    ].filter(Boolean);

    return `${header.join('\n')}\n\n${sourceCode.replace(/\s*$/, '')}\n`;
}

export function buildLibraryCompliantNodalGraph(item: {
    title: string;
    description?: string | null;
    inputs?: Record<string, unknown> | null;
    inputDefinitions?: FlowInputDefinition[] | null;
    dataTables?: ExportedDataTableSchema[];
    mailboxWatchers?: ExportedMailboxWatcherSchema[];
    graph: unknown;
}) {
    return `${JSON.stringify({
        metadata: {
            title: item.title,
            ...(item.description?.trim() ? { description: item.description.trim() } : {}),
            ...((item.inputDefinitions?.length || (item.inputs && Object.keys(item.inputs).length > 0))
                ? { inputs: inputDefinitionsWithValues(item.inputs, item.inputDefinitions) }
                : {}),
        },
        ...((item.dataTables?.length ?? 0) > 0 || (item.mailboxWatchers?.length ?? 0) > 0
            ? {
                  resources: {
                      ...((item.dataTables?.length ?? 0) > 0 ? { data_tables: item.dataTables } : {}),
                      ...((item.mailboxWatchers?.length ?? 0) > 0
                          ? { mailbox_watchers: item.mailboxWatchers }
                          : {}),
                  },
              }
            : {}),
        graph: item.graph,
    }, null, 2)}\n`;
}

export function buildLibraryCompliantNodalSnippet(item: {
    title: string;
    description?: string | null;
    args?: string | null;
    graph: unknown;
}) {
    return `${JSON.stringify({
        format: 'puppetflow.snippet',
        format_version: 1,
        snippet_type: 'nodal',
        compiler_version: 2,
        metadata: {
            title: item.title,
            description: item.description?.trim() || '',
            args: item.args?.trim() || '',
        },
        graph: item.graph,
    }, null, 2)}\n`;
}
