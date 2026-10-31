import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type MutableRefObject,
} from 'react';
import type { FlowRun } from '@/Domains/Flow/types';

function buildUrlWithRun(runId: number | null): string {
    const params = new URLSearchParams(window.location.search);
    if (runId != null) {
        params.set('run', String(runId));
    } else {
        params.delete('run');
    }
    const search = params.toString();
    return window.location.pathname + (search ? '?' + search : '') + window.location.hash;
}

// Keeps the selected run detail synchronized with the browser URL and history.
export function useRunDetailUrlState(
    flowId: Id,
    runs: FlowRun[],
    pendingRunOpenRef: MutableRefObject<boolean>,
    onLoadError: () => void,
) {
    const [detailRun, setDetailRun] = useState<FlowRun | null>(null);
    const detailRunRef = useRef<FlowRun | null>(null);
    const hydrationRequestRef = useRef(0);
    detailRunRef.current = detailRun;

    const fetchRunDetail = useCallback(async (run: FlowRun): Promise<FlowRun> => {
        const response = await fetch(
            `/flows/${encodeURIComponent(String(flowId))}/runs/${run.id}`,
            { headers: { Accept: 'application/json' } },
        );
        if (!response.ok) throw new Error(`Failed to load run ${run.id}`);

        const detail = await response.json() as FlowRun;
        return { ...run, ...detail };
    }, [flowId]);

    const hydrateRun = useCallback((run: FlowRun) => {
        const request = ++hydrationRequestRef.current;
        if (detailRunRef.current?.id !== run.id) setDetailRun(null);

        void fetchRunDetail(run)
            .then(detail => {
                if (hydrationRequestRef.current === request) setDetailRun(detail);
            })
            .catch(() => {
                if (hydrationRequestRef.current === request) onLoadError();
            });
    }, [fetchRunDetail, onLoadError]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const syncFromUrl = (event?: PopStateEvent) => {
            const runId = new URLSearchParams(window.location.search).get('run');
            const target = runId
                ? runs.find(run => String(run.id) === runId) ?? null
                : null;

            if (target && detailRunRef.current?.id !== target.id) {
                hydrateRun(target);
            } else if (!target && event) {
                hydrationRequestRef.current++;
                setDetailRun(null);
            }
        };

        syncFromUrl();
        window.addEventListener('popstate', syncFromUrl);
        return () => window.removeEventListener('popstate', syncFromUrl);
    }, [hydrateRun, runs]);

    useEffect(() => {
        const current = detailRunRef.current;
        if (!current) return;

        const fresh = runs.find(run => run.id === current.id);
        if (!fresh) {
            hydrationRequestRef.current++;
            setDetailRun(null);
            return;
        }

        const listFields = Object.fromEntries(
            Object.entries(fresh).filter(([, value]) => value !== undefined),
        ) as Partial<FlowRun>;
        const merged = { ...current, ...listFields };
        setDetailRun(merged);

        if (fresh.status === current.status) return;

        let cancelled = false;
        void fetchRunDetail(merged)
            .then(detail => {
                if (!cancelled) {
                    setDetailRun(previous => previous?.id === detail.id ? detail : previous);
                }
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, [fetchRunDetail, runs]);

    useEffect(() => {
        if (!pendingRunOpenRef.current) return;
        const latestRun = runs.find(run => run.status === 'pending' || run.status === 'running');
        if (!latestRun) return;

        pendingRunOpenRef.current = false;
        hydrateRun(latestRun);
        const newUrl = buildUrlWithRun(latestRun.id);
        if (newUrl !== window.location.pathname + window.location.search + window.location.hash) {
            window.history.pushState({ runId: latestRun.id }, '', newUrl);
        }
    }, [hydrateRun, pendingRunOpenRef, runs]);

    const handleViewRunDetails = useCallback((run: FlowRun) => {
        hydrateRun(run);
        const newUrl = buildUrlWithRun(run.id);
        if (newUrl !== window.location.pathname + window.location.search + window.location.hash) {
            window.history.pushState({ runId: run.id }, '', newUrl);
        }
    }, [hydrateRun]);

    const handleCloseRunDetail = useCallback(() => {
        hydrationRequestRef.current++;
        setDetailRun(null);
        const params = new URLSearchParams(window.location.search);
        if (params.has('run')) {
            window.history.pushState(null, '', buildUrlWithRun(null));
        }
    }, []);

    return {
        detailRun,
        handleViewRunDetails,
        handleCloseRunDetail,
    };
}
