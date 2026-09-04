import { useCallback, useEffect, useMemo, useState } from 'react';

const PATH_SEPARATOR = '\u0000';

// Tracks collapsed tree paths. The user's expand/collapse choices survive parent re-renders
// and are only reset when the set of collapsible paths actually changes.
export function useCollapsedPaths(defaultCollapsedPaths: Set<string>) {
    const structureKey = useMemo(
        () => [...defaultCollapsedPaths].sort().join(PATH_SEPARATOR),
        [defaultCollapsedPaths],
    );
    const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => defaultCollapsedPaths);
    useEffect(() => {
        setCollapsedPaths(new Set(structureKey ? structureKey.split(PATH_SEPARATOR) : []));
    }, [structureKey]);

    const toggleCollapsedPath = useCallback((path: string) => {
        setCollapsedPaths(current => {
            const next = new Set(current);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    }, []);

    return { collapsedPaths, toggleCollapsedPath };
}
