export type SnippetEntry = { id: Id; label: string; args: string; description: string | null };
let cachedSnippetSuggestions: SnippetEntry[] | null = null;
let snippetSuggestionsRequest: Promise<SnippetEntry[]> | null = null;

export function fetchSnippetSuggestions(): Promise<SnippetEntry[]> {
    return cachedSnippetSuggestions
        ? Promise.resolve(cachedSnippetSuggestions)
        : requestSnippetSuggestions();
}

function requestSnippetSuggestions(): Promise<SnippetEntry[]> {
    if (snippetSuggestionsRequest) return snippetSuggestionsRequest;

    snippetSuggestionsRequest = fetch('/snippets/suggestions')
        .then(response => {
            if (!response.ok) throw new Error('Unable to load snippets.');
            return response.json();
        })
        .then(payload => {
            cachedSnippetSuggestions = Array.isArray(payload) ? payload : [];
            return cachedSnippetSuggestions;
        })
        .catch(() => cachedSnippetSuggestions ?? [])
        .finally(() => {
            snippetSuggestionsRequest = null;
        });

    return snippetSuggestionsRequest;
}

export function buildSnippetTypeDeclarations(snippets: SnippetEntry[]) {
    return snippets.map(snippet => {
        const doc = snippet.description ? `${snippet.label}. ${snippet.description}` : snippet.label;
        return `/** ${doc} */\ndeclare function $$${snippet.id}(${snippet.args || ''}): any;`;
    }).join('\n');
}

export function invalidateSnippetCache() {
    cachedSnippetSuggestions = null;
}
