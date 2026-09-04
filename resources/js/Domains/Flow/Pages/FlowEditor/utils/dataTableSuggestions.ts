export type DataTableSuggestion = {
    id: Id;
    name: string;
    description?: string | null;
    visibility?: string;
    can_manage: boolean;
    columns: Array<{
        id: Id;
        name: string;
        type: string;
    }>;
};

const cachedSuggestions = new Map<Id, DataTableSuggestion[]>();
const pendingRequests = new Map<Id, Promise<DataTableSuggestion[]>>();

export function invalidateDataTableCache(): void {
    cachedSuggestions.clear();
}

export function fetchDataTableSuggestions(flowId: Id, force = false): Promise<DataTableSuggestion[]> {
    const cached = cachedSuggestions.get(flowId);
    if (!force && cached) return Promise.resolve(cached);
    const pending = pendingRequests.get(flowId);
    if (pending) return pending;

    const request = fetch(`/flows/${flowId}/data-table-resources`, { cache: 'no-store' })
        .then(response => {
            if (!response.ok) throw new Error('Unable to load Data Tables.');
            return response.json();
        })
        .then(payload => {
            const suggestions: DataTableSuggestion[] = Array.isArray(payload) ? payload : [];
            cachedSuggestions.set(flowId, suggestions);
            return suggestions;
        })
        .catch(() => cachedSuggestions.get(flowId) ?? [])
        .finally(() => {
            pendingRequests.delete(flowId);
        });

    pendingRequests.set(flowId, request);
    return request;
}
