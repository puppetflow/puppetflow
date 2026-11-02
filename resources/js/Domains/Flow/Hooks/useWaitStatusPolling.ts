import { useEffect, useMemo, useRef } from 'react';

const WAIT_STATUS_CACHE_MS = 3000;

export interface WaitStatusRunRef {
    id: number;
    flowId: Id;
}

export interface WaitStatusData {
    waiting: boolean;
    wait_id: string | null;
    validation_message: string | null;
}

export type WaitStatusPollResult =
    | {
        ok: true;
        run: WaitStatusRunRef;
        data: WaitStatusData;
    }
    | {
        ok: false;
        run: WaitStatusRunRef;
        error: unknown;
    };

interface UseWaitStatusPollingOptions<T> {
    runs: WaitStatusRunRef[];
    active: boolean;
    interval: number;
    transform: (results: WaitStatusPollResult[]) => T;
    onData: (data: T) => void;
}

interface SharedWaitStatusRequest {
    promise: Promise<WaitStatusData>;
    expiresAt: number | null;
}

const sharedRequests = new Map<string, SharedWaitStatusRequest>();

function fetchWaitStatus(run: WaitStatusRunRef): Promise<WaitStatusData> {
    const url = `/flows/${run.flowId}/runs/${run.id}/wait-status`;
    const existing = sharedRequests.get(url);
    if (existing && (existing.expiresAt === null || existing.expiresAt > Date.now())) {
        return existing.promise;
    }

    const entry: SharedWaitStatusRequest = {
        expiresAt: null,
        promise: fetch(url)
            .then(async response => {
                if (!response.ok) {
                    throw new Error(`Wait status request failed with HTTP ${response.status}.`);
                }

                const data = await response.json() as Partial<WaitStatusData>;
                if (
                    typeof data.waiting !== 'boolean'
                    || (data.wait_id !== null && typeof data.wait_id !== 'string')
                    || (data.validation_message !== null && typeof data.validation_message !== 'string')
                ) {
                    throw new Error('Wait status response is malformed.');
                }

                entry.expiresAt = Date.now() + WAIT_STATUS_CACHE_MS;
                window.setTimeout(() => {
                    if (sharedRequests.get(url) === entry) sharedRequests.delete(url);
                }, WAIT_STATUS_CACHE_MS);

                return data as WaitStatusData;
            })
            .catch(error => {
                if (sharedRequests.get(url) === entry) sharedRequests.delete(url);
                throw error;
            }),
    };

    sharedRequests.set(url, entry);
    return entry.promise;
}

// Polls wait-status endpoints for a changing set of flow runs and publishes transformed results.
export function useWaitStatusPolling<T>({
    runs,
    active,
    interval,
    transform,
    onData,
}: UseWaitStatusPollingOptions<T>): void {
    const normalizedRuns = useMemo(() => {
        const uniqueRuns = Array.from(new Map(
            runs.map(run => [`${run.flowId}:${run.id}`, run]),
        ).values());

        return {
            runs: uniqueRuns,
            key: uniqueRuns.map(run => `${run.flowId}:${run.id}`).join(','),
        };
    }, [runs]);
    const runsKey = normalizedRuns.key;
    const runsRef = useRef(normalizedRuns.runs);
    const transformRef = useRef(transform);
    const onDataRef = useRef(onData);

    runsRef.current = normalizedRuns.runs;
    transformRef.current = transform;
    onDataRef.current = onData;

    useEffect(() => {
        if (!active || runsRef.current.length === 0) return;

        let cancelled = false;
        let polling = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const poll = async () => {
            if (polling || document.hidden) return;
            polling = true;

            try {
                const results = await Promise.all(
                    runsRef.current.map(async (run): Promise<WaitStatusPollResult> => {
                        try {
                            return { ok: true, run, data: await fetchWaitStatus(run) };
                        } catch (error) {
                            return { ok: false, run, error };
                        }
                    }),
                );

                if (!cancelled) {
                    onDataRef.current(transformRef.current(results));
                }
            } finally {
                polling = false;
            }
        };

        const stop = () => {
            if (intervalId === null) return;
            clearInterval(intervalId);
            intervalId = null;
        };
        const start = () => {
            if (intervalId !== null || document.hidden) return;
            void poll();
            intervalId = setInterval(poll, interval);
        };
        const onVisibilityChange = () => {
            if (document.hidden) stop();
            else start();
        };

        start();
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            cancelled = true;
            stop();
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [active, interval, runsKey]);
}
