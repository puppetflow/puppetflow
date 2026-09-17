import { createContext, useContext } from 'react';
import type { MediaTreeItem } from '@/Domains/Media/types';

export interface MediaInspectorActions {
    /** Opens the metadata modal for an asset, navigating to its folder when it is not on the current page. */
    inspect: (item: MediaTreeItem) => void;
    /** Opens the browser file picker targeting the current explorer location. */
    openUploadDialog: () => void;
}

export const MediaInspectorContext = createContext<MediaInspectorActions | null>(null);

export function useMediaInspector(): MediaInspectorActions {
    const context = useContext(MediaInspectorContext);
    if (!context) {
        throw new Error('Media components must be rendered inside MediaLibrary.');
    }
    return context;
}
