import { useEffect, useRef } from 'react';
import { router } from '@inertiajs/react';

interface UseInertiaPollingOptions {
    only: string[];
    active: boolean;
    activeDelay: number;
    idleDelay: number;
    pauseWhenHidden: boolean;
}

// Reloads selected Inertia props at activity-aware intervals, with optional visibility pausing.
export function useInertiaPolling({
    only,
    active,
    activeDelay,
    idleDelay,
    pauseWhenHidden,
}: UseInertiaPollingOptions): void {
    const onlyRef = useRef(only);

    if (
        onlyRef.current.length !== only.length
        || onlyRef.current.some((value, index) => value !== only[index])
    ) {
        onlyRef.current = only;
    }

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
        const poll = () => router.reload({ only: onlyRef.current, preserveUrl: true });
        const start = () => {
            stop();
            interval = setInterval(poll, delay);
        };
        const onVisibilityChange = () => {
            const isHidden = document.hidden;
            if (isHidden === wasHidden) return;
            wasHidden = isHidden;

            if (isHidden) {
                stop();
                return;
            }

            poll();
            start();
        };

        if (!wasHidden) start();
        if (pauseWhenHidden) document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            stop();
            if (pauseWhenHidden) document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [active, activeDelay, idleDelay, pauseWhenHidden]);
}
