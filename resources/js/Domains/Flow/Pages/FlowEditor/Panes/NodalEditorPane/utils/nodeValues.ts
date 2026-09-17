import type { HelpEntryDef } from '@/Domains/Flow/Pages/FlowEditor/types';
import type { NodeParameterValue, RawNodeParameterValue } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import { getSignatureArgs } from './catalog';
import { normalizeNodeValues } from './expression';

const cleanSignatureArg = (arg: string) => arg.replace(/\?$/, '').replace(/^\.\.\./, '');

export const sanitizeNodeValuesForEntry = (
    entry: HelpEntryDef,
    values?: Record<string, RawNodeParameterValue>,
): Record<string, NodeParameterValue> => {
    const normalizedValues = normalizeNodeValues(values);
    const migratedValues = (
        ['$saveCookies', '$loadCookies', '$clearCookies'].includes(entry.name)
        && normalizedValues.profile === undefined
        && normalizedValues.jarName !== undefined
    )
        ? { ...normalizedValues, profile: normalizedValues.jarName }
        : normalizedValues;

    if (entry.category === 'Custom') {
        // Snippet nodes keep their call arguments as values; drop the removed legacy "run output key" field.
        const { __runOutputKey: _legacyRunOutputKey, ...callArgumentValues } = migratedValues;
        return callArgumentValues;
    }

    const allowedKeys = new Set(getSignatureArgs(entry.signature).map(cleanSignatureArg));

    return Object.fromEntries(
        Object.entries(migratedValues).filter(([key]) => allowedKeys.has(key)),
    );
};
