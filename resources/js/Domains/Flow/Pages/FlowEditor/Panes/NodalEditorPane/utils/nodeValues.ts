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
    let migratedValues = (
        ['$saveCookies', '$loadCookies', '$clearCookies'].includes(entry.name)
        && normalizedValues.profile === undefined
        && normalizedValues.jarName !== undefined
    )
        ? { ...normalizedValues, profile: normalizedValues.jarName }
        : normalizedValues;

    if (
        entry.name === '$selectShadow'
        && migratedValues.scope === undefined
        && migratedValues.shadowRootSelector !== undefined
    ) {
        migratedValues = { ...migratedValues, scope: migratedValues.shadowRootSelector };
    }

    if (entry.name === '$shadowInputFill' && migratedValues.scope === undefined) {
        const options = migratedValues.options;
        if (options?.mode === 'object' && options.inputMode === 'form') {
            const rootSelector = options.fields.find(field => field.key === 'rootSelector');
            if (rootSelector) {
                migratedValues = {
                    ...migratedValues,
                    scope: rootSelector.value,
                    options: {
                        ...options,
                        fields: options.fields.filter(field => field !== rootSelector),
                    },
                };
            }
        } else if (options?.mode === 'object' && options.inputMode === 'json' && options.jsonMode !== 'expression') {
            try {
                const parsed = JSON.parse(options.value || '{}') as unknown;
                if (
                    parsed
                    && typeof parsed === 'object'
                    && !Array.isArray(parsed)
                    && typeof (parsed as Record<string, unknown>).rootSelector === 'string'
                ) {
                    const { rootSelector, ...remainingOptions } = parsed as Record<string, unknown>;
                    migratedValues = {
                        ...migratedValues,
                        scope: { mode: 'fixed', value: rootSelector as string },
                        options: { ...options, value: JSON.stringify(remainingOptions) },
                    };
                }
            } catch {
                // Keep malformed legacy JSON untouched so the editor can surface it for correction.
            }
        }
    }

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
