import { useCallback, useEffect, useRef, useState } from 'react';

function readStored(storageKey: string, fallback: string[]): Set<string> {
    if (typeof window === 'undefined') return new Set(fallback);
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return new Set(fallback);
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set(fallback);
        return new Set(parsed.filter((value): value is string => typeof value === 'string'));
    } catch {
        return new Set(fallback);
    }
}

/**
 * Tracks which named sections are expanded and remembers the choice in localStorage
 * so a user finds the settings laid out the way they left them.
 */
export function useCollapsibleSections(storageKey: string, defaultOpen: string[]) {
    const [open, setOpen] = useState<Set<string>>(() => readStored(storageKey, defaultOpen));
    const touched = useRef(false);

    // Persist only after the user (or an auto-expand) changed something, never the initial read.
    useEffect(() => {
        if (!touched.current || typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(Array.from(open)));
        } catch {
            // Storage may be unavailable (private mode, quota); the UI still works in-memory.
        }
    }, [open, storageKey]);

    const isOpen = useCallback((id: string) => open.has(id), [open]);

    const toggle = useCallback((id: string) => {
        touched.current = true;
        setOpen(current => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const expand = useCallback((ids: string | string[]) => {
        const list = Array.isArray(ids) ? ids : [ids];
        setOpen(current => {
            if (list.every(id => current.has(id))) return current;
            touched.current = true;
            const next = new Set(current);
            for (const id of list) next.add(id);
            return next;
        });
    }, []);

    return { isOpen, toggle, expand };
}
