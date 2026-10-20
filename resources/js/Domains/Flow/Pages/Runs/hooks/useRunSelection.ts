import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FlowRun } from '@/Domains/Flow/types';
import { updateRunSelection } from '@/Domains/Flow/Utils/runSelection';
import { hasOpenModal } from '@/Domains/Flow/Pages/Runs/utils';

// Maintains run selection across active and terminated run lists.
export function useRunSelection(runningRuns: FlowRun[], terminatedRuns: FlowRun[]) {
    const [selectedRunIds, setSelectedRunIds] = useState<Set<number>>(() => new Set());
    const selectionAnchorRef = useRef<number | null>(null);
    const allRuns = useMemo(() => [...runningRuns, ...terminatedRuns], [runningRuns, terminatedRuns]);
    const selectedRunningRuns = runningRuns.filter(run => selectedRunIds.has(run.id));
    const selectedTerminatedRuns = terminatedRuns.filter(run => selectedRunIds.has(run.id));

    useEffect(() => {
        setSelectedRunIds(previous => {
            const visibleIds = new Set(allRuns.map(run => run.id));
            if (
                selectionAnchorRef.current !== null
                && !visibleIds.has(selectionAnchorRef.current)
            ) {
                selectionAnchorRef.current = null;
            }
            const next = new Set([...previous].filter(id => visibleIds.has(id)));
            return next.size === previous.size ? previous : next;
        });
    }, [allRuns]);

    const toggleRunSelection = useCallback((run: FlowRun, selectRange = false) => {
        const orderedRunIds = allRuns.map(candidate => candidate.id);
        const anchorRunId = selectionAnchorRef.current;
        const canSelectRange = selectRange
            && selectedRunIds.size > 0
            && anchorRunId !== null
            && orderedRunIds.includes(anchorRunId);
        setSelectedRunIds(previous => updateRunSelection(
            previous,
            orderedRunIds,
            run.id,
            anchorRunId,
            canSelectRange,
        ));
        if (!canSelectRange) {
            selectionAnchorRef.current = run.id;
        }
    }, [allRuns, selectedRunIds.size]);

    const clearAllRunSelection = useCallback(() => {
        selectionAnchorRef.current = null;
        setSelectedRunIds(new Set());
    }, []);

    useEffect(() => {
        if (selectedRunIds.size === 0) return;
        const handleEscapeSelection = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || hasOpenModal()) return;
            clearAllRunSelection();
        };
        document.addEventListener('keydown', handleEscapeSelection);
        return () => document.removeEventListener('keydown', handleEscapeSelection);
    }, [clearAllRunSelection, selectedRunIds.size]);

    const clearRunSelection = useCallback((runs: FlowRun[]) => {
        const runIds = new Set(runs.map(run => run.id));
        if (
            selectionAnchorRef.current !== null
            && runIds.has(selectionAnchorRef.current)
        ) {
            selectionAnchorRef.current = null;
        }
        setSelectedRunIds(previous => {
            const next = new Set(previous);
            runIds.forEach(id => next.delete(id));
            return next;
        });
    }, []);

    const toggleVisibleRunSelection = useCallback((runs: FlowRun[]) => {
        const visibleIds = runs.map(run => run.id);
        selectionAnchorRef.current = null;
        setSelectedRunIds(previous => {
            const next = new Set(previous);
            const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => previous.has(id));
            if (allVisibleSelected) visibleIds.forEach(id => next.delete(id));
            else visibleIds.forEach(id => next.add(id));
            return next;
        });
    }, []);

    const removeRunIdsFromSelection = useCallback((ids: number[]) => {
        const idSet = new Set(ids);
        if (
            selectionAnchorRef.current !== null
            && idSet.has(selectionAnchorRef.current)
        ) {
            selectionAnchorRef.current = null;
        }
        setSelectedRunIds(previous => {
            const next = new Set(previous);
            idSet.forEach(id => next.delete(id));
            return next;
        });
    }, []);

    return {
        selectedRunIds,
        selectedRunningRuns,
        selectedTerminatedRuns,
        toggleRunSelection,
        toggleVisibleRunSelection,
        clearRunSelection,
        removeRunIdsFromSelection,
    };
}
