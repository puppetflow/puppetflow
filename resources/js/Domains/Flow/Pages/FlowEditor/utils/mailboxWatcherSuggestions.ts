export type WatcherSuggestion = {
    id: Id;
    name: string;
    address: string;
    scope: string;
    team_name: string | null;
};

const cachedWatcherSuggestions = new Map<Id, WatcherSuggestion[]>();
const watcherSuggestionRequests = new Map<Id, Promise<WatcherSuggestion[]>>();

export function fetchMailboxWatcherSuggestions(flowId: Id, force = false): Promise<WatcherSuggestion[]> {
    const cached = cachedWatcherSuggestions.get(flowId);
    if (!force && cached) return Promise.resolve(cached);

    const pending = watcherSuggestionRequests.get(flowId);
    if (pending) return pending;

    const request = fetch(`/flows/${flowId}/mailbox-watchers/suggestions`, { cache: 'no-store' })
        .then(response => {
            if (!response.ok) throw new Error('Unable to load mailbox watchers.');
            return response.json();
        })
        .then(payload => {
            const watchers: WatcherSuggestion[] = Array.isArray(payload) ? payload : [];
            cachedWatcherSuggestions.set(flowId, watchers);
            return watchers;
        })
        .catch(() => cachedWatcherSuggestions.get(flowId) ?? [])
        .finally(() => {
            watcherSuggestionRequests.delete(flowId);
        });

    watcherSuggestionRequests.set(flowId, request);
    return request;
}

export function invalidateWatcherCache() {
    cachedWatcherSuggestions.clear();
}
