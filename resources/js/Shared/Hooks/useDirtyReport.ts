import { useEffect } from 'react';

/** Notifies a parent whenever a form's dirty state changes, and clears it on unmount. */
export function useDirtyReport(dirty: boolean, onDirtyChange?: (dirty: boolean) => void) {
    useEffect(() => {
        onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
}
