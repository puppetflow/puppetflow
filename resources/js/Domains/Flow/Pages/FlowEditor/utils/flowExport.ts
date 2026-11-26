import { csrfHeaders } from '@/Shared/Utils/csrf';
import { buildLibraryCompliantCode, buildLibraryCompliantNodalGraph, buildLibraryCompliantNodalSnippet } from '@/Domains/Library/Utils/libraryCodeExport';
import { createZipBlob } from '@/Shared/Utils/zip';
import {
    compileNodalGraphToCode,
    normalizeNodalFunctionGraph,
    normalizeNodalGraph,
} from '@/Domains/Flow/Pages/FlowEditor/nodalCompiler';
import type { NodalGraph } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import type {
    ExportedDataTableSchema,
    ExportedMailboxWatcherSchema,
    FlowInputDefinition,
} from '@/Domains/Flow/Utils/flowInputsMetadata';

export interface ExportedSnippet {
    id: Id;
    label: string;
    args: string;
    description: string | null;
    code: string;
    snippet_type: 'code' | 'nodal';
    nodal_graph: NodalGraph | null;
}

interface DownloadFlowOptions {
    flowId: Id;
    name: string;
    description: string | null;
    isNodalFlow: boolean;
    code: string;
    nodalGraph: NodalGraph;
    inputDefinitions?: FlowInputDefinition[] | null;
}

export class SnippetExportError extends Error {}
export class FlowInputExportError extends Error {}

const getFlowDownloadBaseName = (name: string, id: Id) => {
    const slugify = (value: string) => value.trim()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return slugify(name) || slugify(String(id)) || 'flow';
};

export const collectSnippetReferences = (content: string) => {
    const references = new Set<string>();
    const pattern = /(^|[^\w$])\$\$([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(content)) !== null) {
        references.add(match[2]);
    }

    return references;
};

const downloadBlob = (filename: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

const downloadTextFile = (filename: string, content: string, mimeType: string) => {
    downloadBlob(filename, new Blob([content], { type: mimeType }));
};

const fetchSnippetExports = async (references: string[]) => {
    if (references.length === 0) return [];

    const response = await fetch('/snippets/export', {
        method: 'POST',
        headers: {
            ...csrfHeaders(),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ references }),
    });

    if (!response.ok) {
        throw new Error('Unable to export snippets.');
    }

    return response.json() as Promise<ExportedSnippet[]>;
};

const fetchReferencedSnippets = async (code: string) => {
    const snippetsByReference = new Map<string, ExportedSnippet>();
    const pendingReferences = collectSnippetReferences(code);

    while (pendingReferences.size > 0) {
        const references = [...pendingReferences].filter(reference => !snippetsByReference.has(reference));
        pendingReferences.clear();

        if (references.length === 0) break;

        const snippets = await fetchSnippetExports(references);
        snippets.forEach(snippet => {
            snippetsByReference.set(String(snippet.id), snippet);
            collectSnippetReferences(snippet.code).forEach(reference => {
                if (!snippetsByReference.has(reference)) {
                    pendingReferences.add(reference);
                }
            });
        });
    }

    return snippetsByReference;
};

const DATA_TABLE_ID_PATTERN = /\bdtbl_[A-Za-z0-9]{12}\b/g;

const collectDataTableIds = (content: string) => [...new Set(content.match(DATA_TABLE_ID_PATTERN) ?? [])];

const fetchFlowInputs = async (flowId: Id, dataTableIds: string[]) => {
    const query = new URLSearchParams();
    dataTableIds.forEach(id => query.append('data_table_ids[]', id));
    const response = await fetch(`/flows/${flowId}/export-inputs${dataTableIds.length > 0 ? `?${query}` : ''}`);
    if (!response.ok) {
        throw new FlowInputExportError('Unable to download flow inputs.');
    }

    const result = await response.json() as {
        inputs?: unknown;
        data_tables?: unknown;
        mailbox_watchers?: unknown;
    };
    const inputs = result.inputs && typeof result.inputs === 'object' && !Array.isArray(result.inputs)
        ? result.inputs as Record<string, unknown>
        : {};
    const dataTables = Array.isArray(result.data_tables)
        ? result.data_tables as ExportedDataTableSchema[]
        : [];
    const mailboxWatchers = Array.isArray(result.mailbox_watchers)
        ? result.mailbox_watchers as ExportedMailboxWatcherSchema[]
        : [];

    return { inputs, dataTables, mailboxWatchers };
};

export interface FlowExportPackage {
    baseName: string;
    name: string;
    description: string | null;
    isNodalFlow: boolean;
    code: string;
    nodalGraph: NodalGraph;
    inputs: Record<string, unknown>;
    inputDefinitions?: FlowInputDefinition[] | null;
    dataTables: ExportedDataTableSchema[];
    mailboxWatchers: ExportedMailboxWatcherSchema[];
    snippets: ExportedSnippet[];
}

export interface FlowExportSelection {
    snippets: boolean;
    dataTables: boolean;
    mailboxWatchers: boolean;
}

// Collects everything a flow download can carry; the user then picks what to keep.
export const prepareFlowExport = async ({
    flowId,
    name,
    description,
    isNodalFlow,
    code,
    nodalGraph,
    inputDefinitions,
}: DownloadFlowOptions): Promise<FlowExportPackage> => {
    const currentNodalGraph = normalizeNodalGraph(nodalGraph);
    const { inputs, dataTables, mailboxWatchers } = await fetchFlowInputs(
        flowId,
        collectDataTableIds(isNodalFlow ? JSON.stringify(currentNodalGraph) : code),
    );
    const codeContent = isNodalFlow ? compileNodalGraphToCode(currentNodalGraph) : code;
    let snippetsByReference: Map<string, ExportedSnippet>;
    try {
        snippetsByReference = await fetchReferencedSnippets(codeContent);
    } catch {
        throw new SnippetExportError('Unable to export snippets.');
    }

    return {
        baseName: getFlowDownloadBaseName(name, flowId),
        name,
        description,
        isNodalFlow,
        code,
        nodalGraph: currentNodalGraph,
        inputs,
        inputDefinitions,
        dataTables,
        mailboxWatchers,
        snippets: [...snippetsByReference.values()],
    };
};

export const hasOptionalFlowExportResources = (pkg: FlowExportPackage) => (
    pkg.snippets.length > 0 || pkg.dataTables.length > 0 || pkg.mailboxWatchers.length > 0
);

export const downloadFlowPackage = (
    pkg: FlowExportPackage,
    selection: FlowExportSelection = { snippets: true, dataTables: true, mailboxWatchers: true },
) => {
    const dataTables = selection.dataTables ? pkg.dataTables : [];
    const mailboxWatchers = selection.mailboxWatchers ? pkg.mailboxWatchers : [];
    const baseContent = pkg.isNodalFlow
        ? buildLibraryCompliantNodalGraph({
            title: pkg.name,
            description: pkg.description,
            inputs: pkg.inputs,
            inputDefinitions: pkg.inputDefinitions,
            dataTables,
            mailboxWatchers,
            graph: pkg.nodalGraph,
        })
        : buildLibraryCompliantCode({
            title: pkg.name,
            description: pkg.description,
            inputs: pkg.inputs,
            inputDefinitions: pkg.inputDefinitions,
            dataTables,
            mailboxWatchers,
            code: pkg.code,
        });
    const baseFilename = `${pkg.baseName}.${pkg.isNodalFlow ? 'json' : 'js'}`;
    const snippets = selection.snippets ? pkg.snippets : [];

    if (snippets.length === 0) {
        downloadTextFile(
            baseFilename,
            baseContent,
            pkg.isNodalFlow ? 'application/json;charset=utf-8' : 'text/javascript;charset=utf-8',
        );
        return;
    }

    downloadBlob(`${pkg.baseName}.zip`, createZipBlob([
        { path: baseFilename, content: baseContent },
        ...snippets.map(snippet => {
            const isNodalSnippet = snippet.snippet_type === 'nodal' && snippet.nodal_graph;
            if (isNodalSnippet) {
                const graph = normalizeNodalFunctionGraph(snippet.nodal_graph!);
                return {
                    path: `snippets/${snippet.id}.json`,
                    content: buildLibraryCompliantNodalSnippet({
                        title: snippet.label,
                        description: snippet.description,
                        args: snippet.args,
                        graph,
                    }),
                };
            }

            return {
                path: `snippets/${snippet.id}.js`,
                content: buildLibraryCompliantCode({
                    title: snippet.label,
                    description: snippet.description,
                    args: snippet.args,
                    code: snippet.code,
                }),
            };
        }),
    ]));
};
