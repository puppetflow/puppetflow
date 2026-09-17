import type { User } from '@/App/types';
import type {
    DropTarget,
    ExplorerBreadcrumb,
    ExplorerFilters,
    ExplorerFolder,
    ExplorerFolderTree,
    ExplorerItem,
    ExplorerPageData,
} from '../types';

/** Default management rule: instance admins, workspace admins and the owner. */
export function isOwnerOrAdmin(item: Pick<ExplorerItem, 'owner_id'>, user: User | null): boolean {
    return Boolean(user && (
        user.role === 'admin'
        || user.workspace_role === 'admin'
        || item.owner_id === user.id
    ));
}

/** True when the drag was started by an explorer card (item or folder), as opposed to OS files. */
export function isExplorerDrag(event: React.DragEvent): boolean {
    return event.dataTransfer.types.includes('application/x-drag-type');
}

type ScopedFolder = Pick<ExplorerFolder, 'id' | 'team_id' | 'is_shared' | 'owner_id'>;

export function getFolderDropTarget(folder: ScopedFolder, isWorkspaceView = false): DropTarget {
    if (folder.team_id) {
        return { folderId: folder.id, scope: 'team', teamId: folder.team_id, ownerId: null };
    }

    const scope = folder.is_shared || isWorkspaceView ? 'workspace' : 'owner';
    return {
        folderId: folder.id,
        scope,
        teamId: null,
        ownerId: scope === 'owner' ? folder.owner_id ?? null : null,
    };
}

/** Drop target of a folder id in the current location: the breadcrumbs, the current folder or the root. */
export function resolveDropScope(
    folderId: Id | null,
    isWorkspace: boolean,
    breadcrumbs: ExplorerBreadcrumb[],
    currentFolder: ExplorerFolder | null,
    currentTeamId: Id | null = null,
    currentOwnerId: Id | null = null,
): DropTarget {
    if (folderId === null) {
        if (isWorkspace && currentTeamId) {
            return { folderId: null, scope: 'team', teamId: currentTeamId, ownerId: null };
        }
        return {
            folderId: null,
            scope: isWorkspace ? 'workspace' : 'owner',
            teamId: null,
            ownerId: isWorkspace ? null : currentOwnerId,
        };
    }

    const known = breadcrumbs.find(item => item.id === folderId)
        ?? (currentFolder?.id === folderId ? currentFolder : null);

    return known
        ? getFolderDropTarget({
            id: folderId,
            team_id: known.team_id,
            is_shared: known.is_shared ?? false,
            owner_id: known.owner_id,
        }, isWorkspace)
        : {
            folderId,
            scope: isWorkspace ? 'workspace' : 'owner',
            teamId: null,
            ownerId: isWorkspace ? null : currentOwnerId,
        };
}

export function isSameDropScope(
    itemScope: string,
    itemTeamId: Id,
    itemOwnerId: Id,
    target: DropTarget,
): boolean {
    if (itemScope !== target.scope) return false;
    if (target.scope === 'team') {
        return target.teamId !== null && String(itemTeamId) === String(target.teamId);
    }
    if (target.scope === 'owner' && target.ownerId !== null) {
        return String(itemOwnerId) === String(target.ownerId);
    }
    return true;
}

export function scopeLabel(scope: string): string {
    return scope === 'team' ? 'Team' : scope === 'workspace' ? 'Workspace' : 'Owner';
}

export function findFolderNode<TItem extends ExplorerItem>(
    trees: ExplorerFolderTree<TItem>[],
    id: Id,
): ExplorerFolderTree<TItem> | null {
    for (const folder of trees) {
        if (folder.id === id) return folder;

        const found = findFolderNode(folder.children, id);
        if (found) return found;
    }

    return null;
}

export function countTreeItems<TItem extends ExplorerItem>(node: ExplorerFolderTree<TItem>): number {
    return node.item_count ?? node.items.length;
}

export function countFolderDescendants<TItem extends ExplorerItem>(
    folder: ExplorerFolderTree<TItem>,
): { folders: number; items: number } {
    return folder.children.reduce(
        (acc, child) => {
            const childCounts = countFolderDescendants(child);
            return {
                folders: acc.folders + 1 + childCounts.folders,
                items: acc.items + countTreeItems(child) + childCounts.items,
            };
        },
        { folders: 0, items: countTreeItems(folder) },
    );
}

type LocationFilters = Partial<Pick<ExplorerFilters, 'view' | 'owner_id' | 'team_id' | 'persistent_filters'>>;

function appendPersistentFilters(params: URLSearchParams, filters: LocationFilters): void {
    Object.entries(filters.persistent_filters ?? {}).forEach(([key, value]) => {
        if (value !== '') params.set(key, value);
    });
}

/** URL of a folder, keeping the workspace view or the browsed owner in the query string. */
export function getFolderUrl(basePath: string, folderId: Id, filters: LocationFilters = {}): string {
    const params = new URLSearchParams({ folder_id: String(folderId) });
    if (filters.view === 'workspace') params.set('view', 'workspace');
    else if (filters.owner_id) params.set('owner_id', String(filters.owner_id));
    appendPersistentFilters(params, filters);

    return `${basePath}?${params}`;
}

/** URL of a root location: workspace (optionally a team), users, another owner or the personal space. */
export function getRootUrl(basePath: string, filters: LocationFilters): string {
    const params = new URLSearchParams();
    if (filters.view === 'workspace') {
        params.set('view', 'workspace');
        if (filters.team_id) params.set('team_id', String(filters.team_id));
    } else if (filters.view === 'users') {
        params.set('view', 'users');
    } else if (filters.owner_id) {
        params.set('owner_id', String(filters.owner_id));
    }
    appendPersistentFilters(params, filters);

    const query = params.toString();
    return query === '' ? basePath : `${basePath}?${query}`;
}

export function getLocationUrl(basePath: string, folderId: Id | null, filters: LocationFilters): string {
    return folderId ? getFolderUrl(basePath, folderId, filters) : getRootUrl(basePath, filters);
}

/** Every folder tree of the page: personal, workspace, teams and browsed users. */
export function allFolderTrees<TItem extends ExplorerItem>(data: ExplorerPageData<TItem>): ExplorerFolderTree<TItem>[] {
    return [
        ...data.folderTree,
        ...data.workspaceTree,
        ...data.teamTrees.flatMap(team => team.tree),
        ...data.userTrees.flatMap(user => user.tree),
    ];
}

/** Flattens folder trees into a depth-first list of nodes. */
export function collectFolders<TItem extends ExplorerItem>(trees: ExplorerFolderTree<TItem>[]): ExplorerFolderTree<TItem>[] {
    return trees.flatMap(folder => [folder, ...collectFolders(folder.children)]);
}

export function toggleSetValue<T>(values: Set<T>, value: T): Set<T> {
    const next = new Set(values);
    if (next.has(value)) {
        next.delete(value);
    } else {
        next.add(value);
    }
    return next;
}

export function getDefaultFolderTree<TItem extends ExplorerItem>(folder: ExplorerFolder): ExplorerFolderTree<TItem> {
    return {
        id: folder.id,
        name: folder.name,
        parent_id: folder.parent_id,
        team_id: folder.team_id,
        children: [],
        items: [],
    };
}

export function getMovePayload(target: DropTarget, changeVisibility: boolean): Record<string, Id | boolean | null> {
    const visibility: Record<string, boolean> = changeVisibility ? { change_visibility: true } : {};

    if (target.scope === 'team') {
        return {
            workspace_folder_id: target.folderId,
            scope: 'team',
            team_id: target.teamId,
            ...visibility,
        };
    }

    if (target.scope === 'workspace') {
        return {
            workspace_folder_id: target.folderId,
            scope: 'workspace',
            ...visibility,
        };
    }

    return {
        folder_id: target.folderId,
        owner_id: target.ownerId,
        ...visibility,
    };
}

export function getFolderMovePayload(
    target: DropTarget,
    changeAssignment: boolean,
): Record<string, Id | boolean | null> {
    if (!changeAssignment) return { parent_id: target.folderId };

    return {
        parent_id: target.folderId,
        scope: target.scope,
        team_id: target.teamId,
        owner_id: target.ownerId,
        change_visibility: true,
    };
}
