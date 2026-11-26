import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { ArtifactFile, FlowRun } from '@/Domains/Flow/types';

const ACTIVE_RUN_REFRESH_INTERVAL = 3000;

type ArtifactType = 'screenshots' | 'downloads';

async function fetchArtifactFiles(
    flowId: Id,
    runId: number,
    type: ArtifactType,
    signal: AbortSignal,
): Promise<ArtifactFile[]> {
    const response = await fetch(`/flows/${flowId}/runs/${runId}/artifacts/${type}`, { signal });
    if (!response.ok) throw new Error(`Failed to load run ${runId} ${type}`);

    return await response.json() as ArtifactFile[];
}

// Fetches the screenshot and download artifacts for the active run. Files land in the run
// workspace while it executes and are finalized with the terminal status, so the lists are
// refreshed silently during the run and whenever its status or artifact counts change.
export function useRunArtifacts(run: FlowRun | null, flowId: Id, artifactsTabActive: boolean) {
    const [screenshotFiles, setScreenshotFiles] = useState<ArtifactFile[]>([]);
    const [downloadFiles, setDownloadFiles] = useState<ArtifactFile[]>([]);
    const [screenshotsLoading, setScreenshotsLoading] = useState(false);
    const [downloadsLoading, setDownloadsLoading] = useState(false);
    const loadedRunIdRef = useRef<number | null>(null);
    const runId = run?.id;
    const isActive = run?.status === 'pending' || run?.status === 'running';
    const artifactsRevision = run
        ? `${run.status}:${run.screenshots_count}:${run.downloads_count}`
        : '';

    useEffect(() => {
        if (runId === undefined) return;
        loadedRunIdRef.current = null;
        setScreenshotFiles([]);
        setDownloadFiles([]);
        setScreenshotsLoading(false);
        setDownloadsLoading(false);
    }, [runId]);

    useEffect(() => {
        if (runId === undefined || !artifactsTabActive) return;

        const controller = new AbortController();
        const load = (
            type: ArtifactType,
            setFiles: Dispatch<SetStateAction<ArtifactFile[]>>,
            setLoading: Dispatch<SetStateAction<boolean>>,
            showLoader: boolean,
        ) => {
            if (showLoader) setLoading(true);
            fetchArtifactFiles(flowId, runId, type, controller.signal)
                .then(files => {
                    if (!controller.signal.aborted) setFiles(files);
                })
                .catch(() => {
                    if (showLoader && !controller.signal.aborted) setFiles([]);
                })
                .finally(() => {
                    if (!controller.signal.aborted) setLoading(false);
                });
        };
        const loadAll = (showLoader: boolean) => {
            load('screenshots', setScreenshotFiles, setScreenshotsLoading, showLoader);
            load('downloads', setDownloadFiles, setDownloadsLoading, showLoader);
        };

        loadAll(loadedRunIdRef.current !== runId);
        loadedRunIdRef.current = runId;
        const intervalId = isActive
            ? setInterval(() => {
                if (!document.hidden) loadAll(false);
            }, ACTIVE_RUN_REFRESH_INTERVAL)
            : null;

        return () => {
            controller.abort();
            if (intervalId !== null) clearInterval(intervalId);
        };
    }, [runId, flowId, artifactsTabActive, isActive, artifactsRevision]);

    return {
        screenshotFiles,
        downloadFiles,
        screenshotsLoading,
        downloadsLoading,
    };
}
