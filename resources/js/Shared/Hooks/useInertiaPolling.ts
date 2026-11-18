import { useEffect, useRef } from 'react';
import { router } from '@inertiajs/react';

interface UseInertiaPollingOptions {
    only: string[];
    active: boolean;
    activeDelay: number;
    idleDelay: number;
    pauseWhenHidden: boolean;
    /** Props kept polling while the tab is hidden instead of pausing (needs `pauseWhenHidden`). */
    hiddenOnly?: string[] | null;
}

function useStableList(list: string[] | null): string[] | null {
    const ref = useRef(list);

    if (
        ref.current?.length !== list?.length
        || (ref.current && list && ref.current.some((value, index) => value !== list[index]))
    ) {
        ref.current = list;
    }

    return ref.current;
}

// Reloads selected Inertia props at activity-aware intervals, with optional visibility pausing.
export function useInertiaPolling({
    only,
    active,
    activeDelay,
    idleDelay,
    pauseWhenHidden,
    hiddenOnly = null,
}: UseInertiaPollingOptions): void {
    const stableOnly = useStableList(only);
    const stableHiddenOnly = useStableList(hiddenOnly);
    const onlyRef = useRef(stableOnly);
    const hiddenOnlyRef = useRef(stableHiddenOnly);
    onlyRef.current = stableOnly;
    hiddenOnlyRef.current = stableHiddenOnly;
    const pollsWhenHidden = stableHiddenOnly !== null && stableHiddenOnly.length > 0;

    useEffect(() => {
        const delay = active ? activeDelay : idleDelay;
        let interval: ReturnType<typeof setInterval> | null = null;
        let wasHidden = pauseWhenHidden && document.hidden;

        const stop = () => {
            if (!interval) return;
            clearInterval(interval);
            interval = null;
        };
        // Inertia rewrites the URL with the one captured when the request started. A background
        // poll must not undo query params written meanwhile (URL-synced modals, run detail).
        const poll = () => router.reload({
            only: (pauseWhenHidden && document.hidden ? hiddenOnlyRef.current : null) ?? onlyRef.current ?? [],
            preserveUrl: true,
        });
        const start = () => {
            stop();
            interval = setInterval(poll, delay);
        };
        const onVisibilityChange = () => {
            const isHidden = document.hidden;
            if (isHidden === wasHidden) return;
            wasHidden = isHidden;

            if (isHidden) {
                if (!pollsWhenHidden) stop();
                return;
            }

            poll();
            start();
        };

        if (!wasHidden || pollsWhenHidden) start();
        if (pauseWhenHidden) document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            stop();
            if (pauseWhenHidden) document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [active, activeDelay, idleDelay, pauseWhenHidden, pollsWhenHidden]);
}
