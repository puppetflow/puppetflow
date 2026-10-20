export function updateRunSelection(
    previous: Set<number>,
    orderedRunIds: number[],
    runId: number,
    anchorRunId: number | null,
    selectRange: boolean,
): Set<number> {
    const next = new Set(previous);
    const anchorIndex = anchorRunId === null ? -1 : orderedRunIds.indexOf(anchorRunId);
    const runIndex = orderedRunIds.indexOf(runId);

    if (selectRange && previous.size > 0 && anchorIndex >= 0 && runIndex >= 0) {
        const start = Math.min(anchorIndex, runIndex);
        const end = Math.max(anchorIndex, runIndex);
        orderedRunIds.slice(start, end + 1).forEach(id => next.add(id));
        return next;
    }

    if (next.has(runId)) next.delete(runId);
    else next.add(runId);
    return next;
}
