export type ChannelSuggestion = {
    id: Id;
    name: string;
    provider: string;
    scope: string;
    team_name: string | null;
    destination: string;
};
let cachedChannelSuggestions: ChannelSuggestion[] | null = null;
let channelSuggestionsRequest: Promise<ChannelSuggestion[]> | null = null;

export function fetchChannelSuggestions(force = false): Promise<ChannelSuggestion[]> {
    if (!force && cachedChannelSuggestions) return Promise.resolve(cachedChannelSuggestions);
    if (channelSuggestionsRequest) return channelSuggestionsRequest;

    channelSuggestionsRequest = fetch('/channels/suggestions', { cache: 'no-store' })
        .then(response => {
            if (!response.ok) throw new Error('Unable to load notification channels.');
            return response.json();
        })
        .then(payload => {
            cachedChannelSuggestions = Array.isArray(payload) ? payload : [];
            return cachedChannelSuggestions;
        })
        .catch(() => cachedChannelSuggestions ?? [])
        .finally(() => {
            channelSuggestionsRequest = null;
        });

    return channelSuggestionsRequest;
}

export function invalidateChannelCache() {
    cachedChannelSuggestions = null;
}
