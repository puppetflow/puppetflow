import { useEffect, useState } from 'react';
import type { HelpEntryDef } from '@/Domains/Flow/Pages/FlowEditor/types';

export interface SnippetSuggestion {
    id: string;
    label: string;
    args: string;
    version: number;
    /** True when the snippet draft differs from the published version flows run. */
    has_unpublished_changes: boolean;
    description: string | null;
    edit_url: string;
}

export const snippetSuggestionToHelpEntry = (snippet: SnippetSuggestion): HelpEntryDef => ({
    name: `$$${snippet.id}`,
    signature: `$$${snippet.id}(${snippet.args})`,
    // No fallback to the label: it is already shown as the entry title.
    desc: snippet.description || '',
    displayLabel: snippet.label,
    category: 'Snippets',
    editUrl: snippet.edit_url,
    snippetVersion: snippet.version,
    snippetHasUnpublishedChanges: snippet.has_unpublished_changes,
});

interface UseSnippetSuggestionsOptions {
    enabled?: boolean;
    mapSuggestion?: (suggestion: SnippetSuggestion) => HelpEntryDef;
    refreshKey?: number;
}

// Fetches reusable snippet suggestions for the code editor help panel.
export function useSnippetSuggestions({
    enabled = true,
    mapSuggestion = snippetSuggestionToHelpEntry,
    refreshKey = 0,
}: UseSnippetSuggestionsOptions = {}) {
    const [entries, setEntries] = useState<HelpEntryDef[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!enabled) return;

        const controller = new AbortController();
        setLoading(true);

        fetch('/snippets/suggestions', { signal: controller.signal, cache: 'no-store' })
            .then(response => response.json())
            .then((items: SnippetSuggestion[]) => {
                setEntries(items.map(mapSuggestion));
            })
            .catch(() => {})
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [enabled, mapSuggestion, refreshKey]);

    return { entries, loading };
}
