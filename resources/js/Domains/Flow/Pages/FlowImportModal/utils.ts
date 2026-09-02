import type { VisibilityPickerValue } from '@proprietary/Domains/Flow/Components/VisibilityPicker/VisibilityPicker.pp';
import type { FormDataConvertible } from '@inertiajs/core';
import {
    inputDefinitionsToDefaults,
    parseCodeInputDefinitions,
    parseNodalInputDefinitions,
    type ExportedDataTableSchema,
    type ExportedMailboxWatcherSchema,
} from '@/Domains/Flow/Utils/flowInputsMetadata';

export type ParsedFlowFile = {
    code: string;
    flowType: 'code' | 'nodal';
    nodalGraph: { nodes: FormDataConvertible[]; edges: FormDataConvertible[] } | null;
    dataTables: ExportedDataTableSchema[];
    mailboxWatchers: ExportedMailboxWatcherSchema[];
};

const DATA_TABLE_COLUMN_TYPES = new Set(['string', 'number', 'boolean', 'datetime']);
const WATCHER_RULE_FIELDS = new Set(['body', 'subject', 'to', 'from', 'has_attachments', 'size']);
const WATCHER_RULE_OPERATORS = new Set(['contains', 'not_contains', 'equals', 'greater_than', 'less_than', 'regex']);

function parseDataTableSchema(value: unknown): ExportedDataTableSchema {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Invalid Data Table resource schema.');
    }

    const candidate = value as Record<string, unknown>;
    if (
        typeof candidate.source_id !== 'string'
        || !candidate.source_id.trim()
        || typeof candidate.name !== 'string'
        || !candidate.name.trim()
        || !Array.isArray(candidate.columns)
    ) {
        throw new Error('Invalid Data Table resource schema.');
    }

    const columns = candidate.columns.map(column => {
        if (!column || typeof column !== 'object' || Array.isArray(column)) {
            throw new Error('Invalid Data Table column schema.');
        }
        const definition = column as Record<string, unknown>;
        if (
            typeof definition.name !== 'string'
            || !definition.name.trim()
            || typeof definition.type !== 'string'
            || !DATA_TABLE_COLUMN_TYPES.has(definition.type)
        ) {
            throw new Error('Invalid Data Table column schema.');
        }

        return {
            name: definition.name,
            type: definition.type as ExportedDataTableSchema['columns'][number]['type'],
        };
    });

    return {
        source_id: candidate.source_id,
        name: candidate.name,
        description: typeof candidate.description === 'string' ? candidate.description : null,
        group: typeof candidate.group === 'string' ? candidate.group : null,
        columns,
    };
}

function dataTablesFromCode(code: string): ExportedDataTableSchema[] {
    return code.split(/\r?\n/).flatMap(line => {
        const match = line.trim().match(/^\/\/\s*@resource\s+data-table\s+(.+)$/i);
        if (!match) return [];

        try {
            return [parseDataTableSchema(JSON.parse(match[1]))];
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error('Invalid JSON in Data Table resource metadata.');
            }
            throw error;
        }
    });
}

function dataTablesFromJson(decoded: unknown): ExportedDataTableSchema[] {
    if (!decoded || typeof decoded !== 'object') return [];
    const resources = (decoded as { resources?: unknown }).resources;
    if (!resources || typeof resources !== 'object' || Array.isArray(resources)) return [];
    const dataTables = (resources as { data_tables?: unknown }).data_tables;
    if (dataTables === undefined) return [];
    if (!Array.isArray(dataTables)) throw new Error('Data Table resources must be an array.');

    return dataTables.map(parseDataTableSchema);
}

function parseMailboxWatcherSchema(value: unknown): ExportedMailboxWatcherSchema {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Invalid Mailbox Watcher resource schema.');
    }
    const candidate = value as Record<string, unknown>;
    const mailbox = candidate.mailbox as Record<string, unknown> | null;
    if (
        typeof candidate.source_id !== 'string' || !candidate.source_id.trim()
        || typeof candidate.name !== 'string' || !candidate.name.trim()
        || !mailbox || typeof mailbox.source_id !== 'string'
        || typeof mailbox.address !== 'string' || !mailbox.address.trim()
        || typeof candidate.extract_enabled !== 'boolean'
        || !['regex', 'selector'].includes(String(candidate.extract_mode))
        || typeof candidate.is_active !== 'boolean'
        || !Array.isArray(candidate.rules)
    ) {
        throw new Error('Invalid Mailbox Watcher resource schema.');
    }

    const rules = candidate.rules.map(rule => {
        if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
            throw new Error('Invalid Mailbox Watcher rule schema.');
        }
        const definition = rule as Record<string, unknown>;
        if (
            !Number.isInteger(definition.rule_group)
            || typeof definition.field !== 'string' || !WATCHER_RULE_FIELDS.has(definition.field)
            || typeof definition.operator !== 'string' || !WATCHER_RULE_OPERATORS.has(definition.operator)
            || typeof definition.value !== 'string'
        ) {
            throw new Error('Invalid Mailbox Watcher rule schema.');
        }
        return definition as ExportedMailboxWatcherSchema['rules'][number];
    });

    return {
        source_id: candidate.source_id,
        name: candidate.name,
        group: typeof candidate.group === 'string' ? candidate.group : null,
        mailbox: { source_id: mailbox.source_id, address: mailbox.address },
        extract_enabled: candidate.extract_enabled,
        extract_mode: candidate.extract_mode as 'regex' | 'selector',
        extract_expression: typeof candidate.extract_expression === 'string' ? candidate.extract_expression : null,
        is_active: candidate.is_active,
        timeout: typeof candidate.timeout === 'number' ? candidate.timeout : null,
        rules,
    };
}

function mailboxWatchersFromCode(code: string): ExportedMailboxWatcherSchema[] {
    return code.split(/\r?\n/).flatMap(line => {
        const match = line.trim().match(/^\/\/\s*@resource\s+mailbox-watcher\s+(.+)$/i);
        if (!match) return [];
        try {
            return [parseMailboxWatcherSchema(JSON.parse(match[1]))];
        } catch (error) {
            if (error instanceof SyntaxError) throw new Error('Invalid JSON in Mailbox Watcher resource metadata.');
            throw error;
        }
    });
}

function mailboxWatchersFromJson(decoded: unknown): ExportedMailboxWatcherSchema[] {
    if (!decoded || typeof decoded !== 'object') return [];
    const resources = (decoded as { resources?: unknown }).resources;
    if (!resources || typeof resources !== 'object' || Array.isArray(resources)) return [];
    const watchers = (resources as { mailbox_watchers?: unknown }).mailbox_watchers;
    if (watchers === undefined) return [];
    if (!Array.isArray(watchers)) throw new Error('Mailbox Watcher resources must be an array.');
    return watchers.map(parseMailboxWatcherSchema);
}

function isFormDataConvertible(value: unknown): value is FormDataConvertible {
    if (
        value === null
        || value === undefined
        || typeof value === 'string'
        || typeof value === 'number'
        || typeof value === 'boolean'
    ) {
        return true;
    }

    if (Array.isArray(value)) {
        return value.every(isFormDataConvertible);
    }

    return typeof value === 'object'
        && Object.values(value).every(isFormDataConvertible);
}

export function baseNameFromFile(fileName: string) {
    return fileName.replace(/\.[^/.]+$/, '');
}

export function titleFromBaseName(baseName: string) {
    const words = baseName
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!words) return 'Imported Flow';

    return words.replace(/\b\w/g, match => match.toUpperCase());
}

export function metadataFromCode(code: string) {
    const metadata: {
        title?: string;
        description?: string;
        defaultInputs?: Record<string, unknown>;
    } = {};

    for (const rawLine of code.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        if (!line.startsWith('//')) break;

        const match = line.match(/^\/\/\s*@(title|description)\s+(.+)$/i);
        if (match) {
            metadata[match[1].toLowerCase() as 'title' | 'description'] = match[2].trim();
        }
    }

    const inputs = inputDefinitionsToDefaults(parseCodeInputDefinitions(code));
    if (Object.keys(inputs).length > 0) {
        metadata.defaultInputs = inputs;
    }

    return metadata;
}

export function metadataFromJson(content: string) {
    try {
        const decoded = JSON.parse(content) as unknown;
        if (!decoded || typeof decoded !== 'object') return {};

        const root = decoded as { metadata?: unknown; store?: unknown; library?: unknown; title?: unknown; description?: unknown };
        const candidates = [root.metadata, root.store, root.library, root];
        const metadata = candidates.find(candidate => (
            candidate &&
            typeof candidate === 'object' &&
            (
                typeof (candidate as { title?: unknown }).title === 'string' ||
                typeof (candidate as { description?: unknown }).description === 'string'
            )
        )) as { title?: unknown; description?: unknown } | undefined;

        const inputs = inputDefinitionsToDefaults(parseNodalInputDefinitions(root.metadata));

        return {
            title: typeof metadata?.title === 'string' ? metadata.title.trim() : undefined,
            description: typeof metadata?.description === 'string' ? metadata.description.trim() : undefined,
            defaultInputs: Object.keys(inputs).length > 0 ? inputs : undefined,
        };
    } catch {
        return {};
    }
}

export function labelFromCode(code: string, fallback: string) {
    const firstComment = code
        .split(/\r?\n/)
        .map(line => line.trim())
        .find(line => line.startsWith('//') && !line.match(/^\/\/\s*@/));

    return firstComment ? firstComment.replace(/^\/\/\s?/, '').trim() || fallback : fallback;
}

export function nodalGraphFromJson(decoded: unknown) {
    if (!decoded || typeof decoded !== 'object') return null;

    const root = decoded as {
        nodes?: unknown;
        edges?: unknown;
        graph?: unknown;
        nodal_graph?: unknown;
        nodalGraph?: unknown;
    };
    const candidates = [root, root.graph, root.nodal_graph, root.nodalGraph];

    for (const candidate of candidates) {
        const nodes = (candidate as { nodes?: unknown } | null)?.nodes;
        const edges = (candidate as { edges?: unknown } | null)?.edges;
        if (
            candidate &&
            typeof candidate === 'object' &&
            Array.isArray(nodes) &&
            nodes.every(isFormDataConvertible) &&
            Array.isArray(edges) &&
            edges.every(isFormDataConvertible)
        ) {
            return { nodes, edges };
        }
    }

    return null;
}

export function parseFlowFile(content: string, fileName: string): ParsedFlowFile {
    if (fileName.toLowerCase().endsWith('.json')) {
        const decoded = JSON.parse(content) as unknown;
        const nodalGraph = nodalGraphFromJson(decoded);

        if (nodalGraph) {
            return {
                code: '',
                flowType: 'nodal',
                nodalGraph,
                dataTables: dataTablesFromJson(decoded),
                mailboxWatchers: mailboxWatchersFromJson(decoded),
            };
        }

        throw new Error('JSON flow files must contain nodes and edges arrays, either at the root or under graph.');
    }

    return {
        code: content.replace(/\s*$/, '\n'),
        flowType: 'code',
        nodalGraph: null,
        dataTables: dataTablesFromCode(content),
        mailboxWatchers: mailboxWatchersFromCode(content),
    };
}

export function buildInitialVisibility(
    defaultVisibility: VisibilityPickerValue['visibility'],
    defaultFolderId: Id | null,
    defaultTeamId: Id | null,
): VisibilityPickerValue {
    return {
        visibility: defaultVisibility,
        personalFolderId: defaultVisibility === 'owner' ? defaultFolderId : null,
        wsFolderId: defaultVisibility === 'workspace' ? defaultFolderId : null,
        teamId: defaultVisibility === 'team' ? defaultTeamId : null,
        teamFolderId: defaultVisibility === 'team' ? defaultFolderId : null,
    };
}
