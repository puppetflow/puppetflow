import { useCallback, useEffect, useRef, useState } from 'react';

const MINI_MAP_VISIBLE_MS = 3000;
const MINI_MAP_FADE_MS = 220;

// Shows the minimap for a few seconds after each viewport pan. While the
// pointer is over the minimap (hover or drag) the countdown is suspended so
// it cannot vanish under the user's hand; it restarts when the pointer leaves.
export function useMiniMapVisibility() {
    const hideTimerRef = useRef<number | null>(null);
    const unmountTimerRef = useRef<number | null>(null);
    const heldRef = useRef(false);
    const [showMiniMap, setShowMiniMap] = useState(false);
    const [miniMapFading, setMiniMapFading] = useState(false);

    const clearTimers = useCallback(() => {
        if (hideTimerRef.current) {
            window.clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
        if (unmountTimerRef.current) {
            window.clearTimeout(unmountTimerRef.current);
            unmountTimerRef.current = null;
        }
    }, []);

    const scheduleHide = useCallback(() => {
        clearTimers();
        hideTimerRef.current = window.setTimeout(() => {
            setMiniMapFading(true);
            hideTimerRef.current = null;
            unmountTimerRef.current = window.setTimeout(() => {
                setShowMiniMap(false);
                setMiniMapFading(false);
                unmountTimerRef.current = null;
            }, MINI_MAP_FADE_MS);
        }, MINI_MAP_VISIBLE_MS);
    }, [clearTimers]);

    const revealMiniMap = useCallback(() => {
        setShowMiniMap(true);
        setMiniMapFading(false);
        if (heldRef.current) {
            clearTimers();
            return;
        }
        scheduleHide();
    }, [clearTimers, scheduleHide]);

    const holdMiniMap = useCallback(() => {
        heldRef.current = true;
        clearTimers();
        setMiniMapFading(false);
    }, [clearTimers]);

    const releaseMiniMap = useCallback(() => {
        heldRef.current = false;
        scheduleHide();
    }, [scheduleHide]);

    useEffect(() => clearTimers, [clearTimers]);

    return {
        holdMiniMap,
        miniMapFading,
        releaseMiniMap,
        revealMiniMap,
        showMiniMap,
    };
}
