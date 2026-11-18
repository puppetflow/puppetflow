import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { FlowRun } from '@/Domains/Flow/types';

type LiveRunProgress = Pick<FlowRun, 'id' | 'status' | 'running_at'> & {
    console_logs: NonNullable<FlowRun['console_logs']>;
    console_logs_count: number;
    console_logs_offset: number;
};

const isActiveStatus = (status: FlowRun['status']) => status === 'pending' || status === 'running';

async function fetchLiveProgress(flowId: Id, runId: number, after: number): Promise<LiveRunProgress> {
    const response = await fetch(
        `/flows/${encodeURIComponent(String(flowId))}/runs/${runId}?console_logs_after=${after}`,
        { headers: { Accept: 'application/json' } },
    );
    if (!response.ok) throw new Error(`Failed to load run ${runId} progress`);

    return await response.json() as LiveRunProgress;
}

// Streams the opened run while it is pending or running. Run lists only carry lightweight
// columns, while console logs (and the line/node progress derived from them) live in the
// detail: each tick only fetches the log lines the client does not have yet, and the full
// detail is reloaded once when the run ends.
export function useActiveRunDetailPolling(
    run: FlowRun | null,
    flowId: Id | null | undefined,
    fetchDetail: (run: FlowRun) => Promise<FlowRun | null>,
    setRun: Dispatch<SetStateAction<FlowRun | null>>,
    interval = 1500,
) {
    const runRef = useRef(run);
    const fetchDetailRef = useRef(fetchDetail);

    runRef.current = run;
    fetchDetailRef.current = fetchDetail;

    const activeRunId = run && isActiveStatus(run.status) ? run.id : null;

    useEffect(() => {
        if (activeRunId == null || flowId == null) return;

        let cancelled = false;
        let inFlight = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const replaceWithFullDetail = async (current: FlowRun) => {
            const detail = await fetchDetailRef.current(current);
            if (!cancelled && detail) {
                setRun(previous => previous?.id === detail.id ? detail : previous);
            }
        };
        const poll = async () => {
            timeoutId = null;
            const current = runRef.current;
            if (cancelled || document.hidden || current?.id !== activeRunId) return;

            inFlight = true;
            try {
                const knownCount = current.console_logs?.length ?? 0;
                const live = await fetchLiveProgress(flowId, current.id, knownCount);
                if (cancelled) return;

                if (!isActiveStatus(live.status) || live.console_logs_count < knownCount) {
                    await replaceWithFullDetail(current);
                    return;
                }

                setRun(previous => {
                    if (previous?.id !== live.id) return previous;
                    const logs = previous.console_logs ?? [];
                    if (logs.length !== live.console_logs_offset) return previous;

                    return {
                        ...previous,
                        status: live.status,
                        running_at: live.running_at,
                        console_logs: live.console_logs.length > 0
                            ? [...logs, ...live.console_logs]
                            : logs,
                    };
                });
            } catch {
                // The next tick retries.
            } finally {
                inFlight = false;
                schedule();
            }
        };
        const schedule = () => {
            if (cancelled || inFlight || timeoutId !== null || document.hidden) return;
            timeoutId = setTimeout(poll, interval);
        };
        const onVisibilityChange = () => {
            if (!document.hidden) schedule();
        };

        schedule();
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            cancelled = true;
            if (timeoutId !== null) clearTimeout(timeoutId);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [activeRunId, flowId, interval, setRun]);
}
