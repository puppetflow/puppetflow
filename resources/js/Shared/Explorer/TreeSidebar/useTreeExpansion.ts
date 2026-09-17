import { useCallback, useState } from 'react';
import type { ExplorerBreadcrumb } from '../types';

function read(key: string): unknown {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function write(key: string, value: unknown) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {}
}

// Persists expansion state for folder nodes and sections (personal, workspace, team_<id>, user_<id>).
export function useTreeExpansion(explorerKey: string, breadcrumbs: ExplorerBreadcrumb[], activeSections: string[]) {
    // The flow explorer keeps its historical storage keys.
    const prefix = explorerKey === 'flows' ? '' : `${explorerKey}_`;
    const foldersKey = `${prefix}sidebar_expanded_folders`;
    const sectionsKey = `${prefix}sidebar_expanded_sections`;

    const [expandedFolders, setExpandedFolders] = useState<Set<Id>>(() => {
        const stored = read(foldersKey);
        return new Set<Id>([
            ...(Array.isArray(stored) ? stored.filter((id): id is Id => typeof id === 'string' || typeof id === 'number') : []),
            ...breadcrumbs.flatMap(crumb => (crumb.id !== null ? [crumb.id] : [])),
        ]);
    });
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
        const stored = read(sectionsKey);
        return {
            personal: true,
            ...(stored && typeof stored === 'object' ? stored as Record<string, boolean> : {}),
            ...Object.fromEntries(activeSections.map(key => [key, true])),
        };
    });

    const toggleFolder = useCallback((folderId: Id) => {
        setExpandedFolders((previous) => {
            const next = new Set(previous);
            if (!next.delete(folderId)) next.add(folderId);
            write(foldersKey, [...next]);
            return next;
        });
    }, [foldersKey]);

    const toggleSection = useCallback((key: string) => {
        setExpandedSections((previous) => {
            const next = { ...previous, [key]: !previous[key] };
            write(sectionsKey, next);
            return next;
        });
    }, [sectionsKey]);

    return { expandedFolders, expandedSections, toggleFolder, toggleSection };
}
