import { useEffect, useState } from 'react';

const STORAGE_PREFIX = 'puppetflow.workspace-settings.mcp.accordion';

export function usePersistedAccordion(name: string) {
    const storageKey = `${STORAGE_PREFIX}.${name}`;
    const [expanded, setExpanded] = useState(false);
    useEffect(() => {
        try {
            setExpanded(window.localStorage.getItem(storageKey) === 'open');
        } catch {
            setExpanded(false);
        }
    }, [storageKey]);

    const setPersistedExpanded = (open: boolean) => {
        setExpanded(open);

        try {
            window.localStorage.setItem(storageKey, open ? 'open' : 'closed');
        } catch {
            // Keep the in-memory state when browser storage is unavailable.
        }
    };

    return [expanded, setPersistedExpanded] as const;
}
