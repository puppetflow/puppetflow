import { createContext, useContext } from 'react';
import type { DeletableFolder } from '../types';

export interface FolderTreeContextValue {
    currentFolderId: Id | null;
    expandedFolders: Set<Id>;
    expandedSections: Record<string, boolean>;
    toggleFolder: (id: Id) => void;
    toggleSection: (key: string) => void;
    renameFolder: (folder: DeletableFolder) => void;
    deleteFolder: (folder: DeletableFolder) => void;
}

export const FolderTreeContext = createContext<FolderTreeContextValue | null>(null);

// Gives tree descendants access to navigation state, expansion state and folder actions.
export function useFolderTreeContext() {
    const context = useContext(FolderTreeContext);
    if (!context) {
        throw new Error('Folder tree components must be rendered inside FolderTreeContext.');
    }
    return context;
}
