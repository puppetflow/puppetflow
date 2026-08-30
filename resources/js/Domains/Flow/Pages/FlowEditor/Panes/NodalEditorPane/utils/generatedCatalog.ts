import type { HelpEntryDef, NodalParamDef } from '@/Domains/Flow/Pages/FlowEditor/types';
import { ALL_HELP_ENTRIES } from '@/Domains/Flow/Pages/FlowEditor/utils/helpCatalog';
import { uniqueEntriesByName, VISUAL_HELP_ENTRIES } from './catalog';
import {
    FUNCTION_DECLARATION_NODE_NAME,
    getNodeInputPorts,
    STICKY_NOTE_ENTRY,
    SYSTEM_NODE_ENTRIES,
} from './constants';
import {
    getFlowParameterDefinitions,
    getNodeFlowPortDefinitions,
} from './flowParameters';

interface FlatParameter {
    path: string[];
    meta: NodalParamDef;
}

const signatureParameters = (signature: string) => {
    const match = signature.match(/\((.*)\)/);
    if (!match?.[1]) return new Map<string, boolean>();

    return new Map(match[1]
        .split(',')
        .map(argument => argument.trim())
        .filter(Boolean)
        .map(argument => {
            const required = !argument.endsWith('?') && !argument.startsWith('...');
            return [argument.replace(/\?$/, '').replace(/^\.\.\./, ''), required];
        }));
};

const flattenParameters = (params: Record<string, NodalParamDef> = {}) => {
    const flattened: FlatParameter[] = [];
    const visit = (path: string[], meta: NodalParamDef) => {
        flattened.push({ path, meta });
        Object.entries(meta.objectFields ?? {}).forEach(([name, field]) => {
            visit([...path, name], field);
        });
    };

    Object.entries(params).forEach(([name, meta]) => visit([name], meta));
    return flattened;
};

const parameterOneOf = (params: Record<string, NodalParamDef> = {}) => {
    const groups: string[][][] = [];
    const visit = (path: string[], meta: NodalParamDef) => {
        (meta.requiredOneOf ?? []).forEach(group => {
            groups.push(group.map(field => [...path, field]));
        });
        Object.entries(meta.objectFields ?? {}).forEach(([name, field]) => {
            visit([...path, name], field);
        });
    };

    Object.entries(params).forEach(([name, meta]) => visit([name], meta));
    return groups;
};

const serializeEntry = (entry: HelpEntryDef, mode: 'flow' | 'code') => {
    const systemEntry = Object.values(SYSTEM_NODE_ENTRIES).some(system => system.name === entry.name);
    const documentedParams = entry.nodalParams ?? {};
    const params = systemEntry ? {} : documentedParams;
    const signature = systemEntry ? new Map<string, boolean>() : signatureParameters(entry.signature);
    const flattened = flattenParameters(documentedParams);
    const parameterNames = new Set([...signature.keys(), ...Object.keys(params)]);
    const flowParameters = getFlowParameterDefinitions(entry).map(parameter => ({
        argument: parameter.argument,
        path: parameter.path,
        portId: parameter.portId,
        label: parameter.label,
        required: parameter.meta.required ?? false,
    }));
    const outputPorts = getNodeFlowPortDefinitions(entry);
    const inputPorts = getNodeInputPorts(entry.name);

    return {
        name: entry.name,
        signature: entry.signature,
        description: mode === 'code' ? entry.desc : (entry.nodalDesc ?? entry.desc),
        ...(entry.displayLabel ? { displayLabel: entry.displayLabel } : {}),
        ...(entry.aliases?.length ? { aliases: entry.aliases } : {}),
        ...(entry.nodalOutput ? { nodalOutput: entry.nodalOutput } : {}),
        category: entry.category,
        availability: entry.availability ?? 'both',
        ...(entry.options ? { options: entry.options } : {}),
        ...(entry.evalExpr ? { evalExpr: entry.evalExpr } : {}),
        ...(entry.siteUrlContexts?.length ? { siteUrlContexts: entry.siteUrlContexts } : {}),
        parameters: Object.fromEntries([...parameterNames].map(name => {
            const meta = params[name];
            const hasExplicitRequired = meta
                ? Object.prototype.hasOwnProperty.call(meta, 'required')
                : false;
            return [
            name,
            {
                description: meta?.description ?? '',
                required: hasExplicitRequired ? meta?.required === true : (signature.get(name) ?? false),
                validationRequired: meta?.validationRequired ?? false,
                ...(meta?.valueType ? { valueType: meta.valueType } : {}),
            },
            ];
        })),
        parameterFields: flattened.map(({ path, meta }) => ({
            path,
            required: meta.required ?? false,
            validationRequired: meta.validationRequired ?? false,
            valueType: meta.valueType ?? null,
            description: meta.description,
            ...(meta.label ? { label: meta.label } : {}),
            ...(meta.input ? { input: meta.input } : {}),
            ...(meta.picker ? { picker: meta.picker } : {}),
            ...(meta.placeholder !== undefined ? { placeholder: meta.placeholder } : {}),
            ...(meta.defaultValue !== undefined ? { defaultValue: meta.defaultValue } : {}),
            ...(meta.options ? { options: meta.options } : {}),
        })),
        parameterOneOf: parameterOneOf(documentedParams),
        flowParameters,
        ports: {
            input: inputPorts.map(port => port.id),
            output: outputPorts.map(port => port.id),
        },
        typedPorts: {
            input: inputPorts,
            output: outputPorts.map(port => ({
                id: port.id,
                label: port.label,
                side: 'output',
                kind: port.kind,
            })),
        },
    };
};

const codeEntries = ALL_HELP_ENTRIES.filter(entry => (
    (entry.availability === 'code' || entry.availability === 'both' || entry.availability === undefined)
));

export const GENERATED_NODAL_CATALOG = {
    version: 1,
    flow: uniqueEntriesByName([
        ...Object.values(SYSTEM_NODE_ENTRIES),
        STICKY_NOTE_ENTRY,
        ...VISUAL_HELP_ENTRIES.filter(entry => entry.name !== FUNCTION_DECLARATION_NODE_NAME),
    ]).map(entry => serializeEntry(entry, 'flow')),
    code: uniqueEntriesByName(codeEntries).map(entry => serializeEntry(entry, 'code')),
};
