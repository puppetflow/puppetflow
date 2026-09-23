import { useEffect, useState } from 'react';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';
const MOBILE_MEDIA_QUERY = '(max-width: 768px)';

function getInitialCollapsed(): boolean {
    try {
        return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
        return false;
    }
}

function getInitialIsMobile(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;

    return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

// Persists and toggles the sidebar's collapsed presentation state.
// On mobile the sidebar is a full drawer, so it is never collapsed there.
export function useSidebarCollapsed() {
    const [storedCollapsed, setStoredCollapsed] = useState(getInitialCollapsed);
    const [isMobile, setIsMobile] = useState(getInitialIsMobile);

    useEffect(() => {
        const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
        const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);

        setIsMobile(mediaQuery.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const toggleCollapsed = () => {
        setStoredCollapsed(previous => {
            const next = !previous;

            try {
                localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
            } catch {
                // The sidebar still works when storage is unavailable.
            }

            return next;
        });
    };

    return { collapsed: storedCollapsed && !isMobile, toggleCollapsed };
}
