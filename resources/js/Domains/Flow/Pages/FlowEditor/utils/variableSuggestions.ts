import { DATA_TYPE_ICONS } from '@/Shared/Utils/dataTypeIcons';

export type VariableSuggestion = {
    id: Id;
    key: string;
    type: string;
    scope?: string;
    team_name?: string | null;
    provider?: string | null;
    preview_value?: unknown;
};

export function getVariableSuggestionIcon(variable: Pick<VariableSuggestion, 'type' | 'provider'>) {
    if (variable.provider === 'onepassword') {
        return { icon: 'simple-icons:1password', color: '#0572ec' };
    }

    const icon = variable.type === 'json' || variable.type === 'json_path'
        ? DATA_TYPE_ICONS.object
        : variable.type === 'totp'
            ? DATA_TYPE_ICONS.otp
            : DATA_TYPE_ICONS[variable.type as keyof typeof DATA_TYPE_ICONS] ?? DATA_TYPE_ICONS.variable;

    return { icon };
}
let cachedVariableSuggestions: VariableSuggestion[] | null = null;
let variableSuggestionsPromise: Promise<VariableSuggestion[]> | null = null;
let variableSuggestionsGeneration = 0;

function requestVariableSuggestions(force = false): Promise<VariableSuggestion[]> {
    if (!force && cachedVariableSuggestions) return Promise.resolve(cachedVariableSuggestions);
    if (!force && variableSuggestionsPromise) return variableSuggestionsPromise;

    const generation = variableSuggestionsGeneration;
    const promise = fetch('/variables/suggestions', { cache: 'no-store' })
        .then(response => response.json())
        .then((vars: VariableSuggestion[]) => {
            if (generation !== variableSuggestionsGeneration) {
                return variableSuggestionsPromise ?? cachedVariableSuggestions ?? [];
            }
            cachedVariableSuggestions = vars;
            return vars;
        })
        .catch(() => {
            if (generation !== variableSuggestionsGeneration) {
                return variableSuggestionsPromise ?? cachedVariableSuggestions ?? [];
            }
            return cachedVariableSuggestions ?? [];
        })
        .finally(() => {
            if (generation === variableSuggestionsGeneration && variableSuggestionsPromise === promise) {
                variableSuggestionsPromise = null;
            }
        });
    variableSuggestionsPromise = promise;

    return promise;
}

export function fetchVariableSuggestions(force = false): Promise<VariableSuggestion[]> {
    return requestVariableSuggestions(force);
}

export function fetchVariableSuggestionsForAutocomplete(): Promise<VariableSuggestion[]> {
    if (!cachedVariableSuggestions) return requestVariableSuggestions();
    if (!variableSuggestionsPromise) void requestVariableSuggestions(true);
    return Promise.resolve(cachedVariableSuggestions);
}

export function preloadVariableSuggestions() {
    void requestVariableSuggestions();
}

export function invalidateVariableCache() {
    variableSuggestionsGeneration++;
    cachedVariableSuggestions = null;
    variableSuggestionsPromise = null;
}
