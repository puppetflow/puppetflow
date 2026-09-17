import { createContext, useCallback, useContext } from 'react';
import { useAuth } from '@/App/Hooks/usePageProps';
import type { DeletableFolder, DropTarget, ExplorerConfig, ExplorerItem, ExplorerPageData } from './types';
import { resolveDropScope } from './ExplorerContent/utils';

export interface ExplorerActions {
    openCreateFolder: () => void;
    deleteFolder: (folder: DeletableFolder) => void;
}

export interface ExplorerContextValue<TItem extends ExplorerItem = ExplorerItem> {
    config: ExplorerConfig<TItem>;
    data: ExplorerPageData<TItem>;
    actions: ExplorerActions;
}

export const ExplorerContext = createContext<ExplorerContextValue | null>(null);

// Gives explorer descendants access to the domain adapter, page payload and shared actions.
export function useExplorer<TItem extends ExplorerItem = ExplorerItem>(): ExplorerContextValue<TItem> {
    const context = useContext(ExplorerContext);
    if (!context) {
        throw new Error('Explorer components must be rendered inside an Explorer.');
    }
    return context as unknown as ExplorerContextValue<TItem>;
}

export function useExplorerConfig<TItem extends ExplorerItem = ExplorerItem>(): ExplorerConfig<TItem> {
    return useExplorer<TItem>().config;
}

/** View flags derived from the current filters, shared by every content component. */
export function useExplorerView() {
    const { data: { filters, breadcrumbs, currentFolder } } = useExplorer();
    const { user } = useAuth();
    const isWorkspaceView = filters.view === 'workspace';
    const teamId = filters.team_id ?? null;
    const ownerId = filters.owner_id ?? user?.id ?? null;
    const resolveDropTarget = useCallback(
        (folderId: Id | null): DropTarget => resolveDropScope(
            folderId,
            isWorkspaceView,
            breadcrumbs,
            currentFolder,
            teamId,
            ownerId,
        ),
        [breadcrumbs, currentFolder, isWorkspaceView, ownerId, teamId],
    );

    return {
        isWorkspaceView,
        isUsersView: filters.view === 'users',
        isOtherOwner: filters.owner_id !== null,
        teamId,
        viewMode: user?.explorer_view_mode === 'list' ? 'list' as const : 'grid' as const,
        resolveDropTarget,
    };
}
