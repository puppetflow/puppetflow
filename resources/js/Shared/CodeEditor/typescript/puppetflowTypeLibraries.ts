import { useEffect, useMemo, useState } from 'react';
import { EXTRA_LIB_SOURCE } from '@/Domains/Flow/Pages/FlowEditor/utils/helpCatalog';
import {
    buildSnippetTypeDeclarations,
    fetchSnippetSuggestions,
} from '@/Domains/Flow/Pages/FlowEditor/utils/snippetSuggestions';
import type { NodalAutocompleteContext } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/staticAnalysis';
import puppeteerTypesRaw from '../../../../../node_modules/puppeteer-core/lib/types.d.ts?raw';

const PUPPETEER_TYPE_STUBS = `
type ChildProcess = any;
type ParseSelector<Selector extends string> = any;
declare class PassThrough {}
declare namespace ProtocolMapping {
    interface Events extends Record<string, [any]> {}
    interface Commands extends Record<string, { paramsType: [any?]; returnType: any }> {}
}
declare namespace Protocol {
    namespace Emulation {
        type UserAgentMetadata = any;
        interface SetEmulatedVisionDeficiencyRequest { type?: any }
    }
    namespace Input { type DragData = any }
    namespace Network {
        type CookiePartitionKey = any;
        type ErrorReason = any;
        type Initiator = any;
        type ResourceTiming = any;
        type ResourceType = any;
    }
    namespace Page { type DialogType = any }
    namespace Profiler { type ScriptCoverage = any }
    namespace Runtime { type RemoteObject = any }
    namespace Target { type TargetInfo = any }
}
declare namespace Session {
    type CapabilityRequest = Record<string, any>;
}
`;

const puppeteerDeclarations = `${PUPPETEER_TYPE_STUBS}
${puppeteerTypesRaw
        .replace(/^\/\/\/ <reference types="node" \/>\s*/m, '')
        .replace(/^import(?:\s+type)?[\s\S]*?;\s*$/gm, '')
        .replace(/^export declare /gm, 'declare ')
        .replace(/^export(?:\s+type)?\s+\{[^}]*\};?\s*$/gm, '')
        .replace(/^export default [^;]+;\s*$/gm, '')}
`;

export const PUPPETFLOW_TYPE_LIBRARIES: Record<string, string> = {
    '/puppetflow-globals.d.ts': EXTRA_LIB_SOURCE,
    '/puppetflow-puppeteer.d.ts': puppeteerDeclarations,
};

const CONTEXT_DECLARATIONS = {
    'code-flow': '',
    nodal: `
declare const $run: Record<string, any>;
declare const $nodes: Record<string, Record<string, any>>;
declare const $loop: { item: any; index: number };
declare const $capture: Record<string, any>;
declare function $(nodeName: string): Record<string, any>;
`,
    snippet: 'declare const $input: Record<string, any>;',
} as const;

export function usePuppetflowTypeLibraries(
    context: keyof typeof CONTEXT_DECLARATIONS = 'code-flow',
) {
    const [snippetTypes, setSnippetTypes] = useState('');

    useEffect(() => {
        let disposed = false;
        void fetchSnippetSuggestions().then(snippets => {
            if (!disposed) setSnippetTypes(buildSnippetTypeDeclarations(snippets));
        });
        return () => {
            disposed = true;
        };
    }, []);

    return useMemo(() => ({
        ...PUPPETFLOW_TYPE_LIBRARIES,
        '/puppetflow-snippets.d.ts': snippetTypes,
        '/puppetflow-context.d.ts': CONTEXT_DECLARATIONS[context],
    }), [context, snippetTypes]);
}

function valueToTypeScript(value: unknown, depth = 0): string {
    if (depth > 5) return 'unknown';
    if (value === null) return 'null';
    if (Array.isArray(value)) {
        const itemTypes = [...new Set(value.slice(0, 8).map(item => valueToTypeScript(item, depth + 1)))];
        return `Array<${itemTypes.join(' | ') || 'unknown'}>`;
    }
    if (typeof value === 'object') {
        return `{ ${Object.entries(value as Record<string, unknown>)
            .map(([key, item]) => `${JSON.stringify(key)}: ${valueToTypeScript(item, depth + 1)};`)
            .join(' ')} }`;
    }
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'unknown';
}

export function buildNodalTypeLibrary(context: NodalAutocompleteContext): string {
    return `
declare const $run: ${valueToTypeScript(context.runData)};
declare const $nodes: ${valueToTypeScript(context.nodeData)};
declare const $loop: ${valueToTypeScript(context.runData?.$loop)};
declare const $capture: ${valueToTypeScript(context.runData?.$capture)};
declare function $(nodeName: keyof typeof $nodes): (typeof $nodes)[typeof nodeName];
${context.locals.map(local => `declare const ${local.key}: ${local.type === 'loop_index' ? 'number' : 'unknown'};`).join('\n')}
`;
}
