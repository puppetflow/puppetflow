import type { ComponentType, ReactNode } from 'react';
import type { User } from '@/App/types';
import type { PaginatedData } from '@/Shared/Types/pagination';

export type ExplorerScope = 'owner' | 'workspace' | 'team';

/** Minimum contract an explorer item (flow, media asset...) must satisfy. */
export interface ExplorerItem {
    id: Id;
    name: string;
    visibility: ExplorerScope;
    owner_id: Id | null;
    team_id: Id | null;
}

export interface ExplorerFolder {
    id: Id;
    name: string;
    parent_id: Id | null;
    sort_order: number;
    is_shared: boolean;
    team_id?: Id | null;
    owner_id?: Id | null;
    children?: ExplorerFolder[];
    owner?: Pick<User, 'id' | 'name'>;
}

export type DeletableFolder = Pick<ExplorerFolder, 'id' | 'name'>;

export interface BreadcrumbSiblingFolder {
    id: Id;
    name: string;
    href: string;
}

export interface ExplorerBreadcrumb {
    id: Id | null;
    name: string;
    href?: string;
    icon?: 'personal' | 'workspace' | 'team';
    team_id?: Id | null;
    is_shared?: boolean;
    parent_id?: Id | null;
    owner_id?: Id | null;
    siblingFolders?: BreadcrumbSiblingFolder[];
}

export interface ExplorerFolderTree<TItem = ExplorerItem> {
    id: Id;
    name: string;
    parent_id: Id | null;
    owner_id?: Id | null;
    owner_name?: string;
    team_id?: Id | null;
    /** Number of items in the folder when the tree does not embed items. */
    item_count?: number;
    children: ExplorerFolderTree<TItem>[];
    items: TItem[];
}

export interface ExplorerTeamTree<TItem = ExplorerItem> {
    id: Id;
    name: string;
    root_folder_id: Id | null;
    tree: ExplorerFolderTree<TItem>[];
    rootItems: TItem[];
}

export interface ExplorerUserTree<TItem = ExplorerItem> {
    id: Id;
    name: string;
    tree: ExplorerFolderTree<TItem>[];
    rootItems: TItem[];
}

export interface ExplorerFilters {
    search: string | null;
    folder_id: Id | null;
    view: string | null;
    owner_id: Id | null;
    /** Set when the current location is a virtual team root or a folder inside a team. */
    team_id?: Id | null;
    search_everywhere: string | null;
    persistent_filters?: Record<string, string>;
}

export interface ExplorerToolbarFilter {
    key: string;
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
}

export interface DropTarget {
    folderId: Id | null;
    scope: ExplorerScope;
    teamId: Id | null;
    ownerId: Id | null;
}

export interface PendingMove {
    itemId: Id;
    target: DropTarget;
    fromScope: string;
    fromOwnerId: Id | null;
    resource: 'item' | 'folder';
}

/** Inertia payload shared by every explorer page. */
export interface ExplorerPageData<TItem extends ExplorerItem, TFolder extends ExplorerFolder = ExplorerFolder> {
    items: PaginatedData<TItem>;
    folders: TFolder[];
    currentFolder: TFolder | null;
    breadcrumbs: ExplorerBreadcrumb[];
    folderTree: ExplorerFolderTree<TItem>[];
    userTrees: ExplorerUserTree<TItem>[];
    workspaceTree: ExplorerFolderTree<TItem>[];
    teamTrees: ExplorerTeamTree<TItem>[];
    rootItems: TItem[];
    workspaceRootItems: TItem[];
    filters: ExplorerFilters;
    personalOwner: Pick<User, 'id' | 'name'>;
}

export interface ExplorerItemCardProps<TItem extends ExplorerItem> {
    item: TItem;
    variant: 'grid' | 'list';
    selectionActive: boolean;
    selected: boolean;
    onToggleSelect: (item: TItem) => void;
}

export interface ExplorerTreeItemProps<TItem extends ExplorerItem> {
    item: TItem;
    depth: number;
}

export interface ExplorerLabels {
    /** Singular item label, lowercase ("flow"). */
    item: string;
    /** Plural item label, lowercase ("flows"). */
    items: string;
    searchPlaceholder: string;
    emptyTitle: string;
    emptyDescription: string;
    sharedEmptyDescription: string;
    /** Warning displayed when deleting a folder that contains items. */
    deleteFolderWarning: string;
}

export interface ExplorerEndpoints {
    /** Folder resource base, e.g. "/folders". */
    folders: string;
    /** The folder move endpoint accepts virtual owner, workspace and team roots. */
    folderScopeMoves?: boolean;
    moveItem: (id: Id) => string;
    batchDelete: string;
}

/** Adapter describing how a domain plugs into the shared explorer. */
export interface ExplorerConfig<TItem extends ExplorerItem> {
    /** Stable key used for local storage and preferences. */
    key: string;
    basePath: string;
    title: string;
    documentationPath?: string;
    documentationLabel?: string;
    /** Value of the "application/x-drag-type" data transfer entry for items. */
    dragType: string;
    labels: ExplorerLabels;
    endpoints: ExplorerEndpoints;
    canManageItem: (item: TItem, user: User | null) => boolean;
    renderItemCard: (props: ExplorerItemCardProps<TItem>) => ReactNode;
    renderItemIcon: (item: TItem) => ReactNode;
    renderTreeItem?: (props: ExplorerTreeItemProps<TItem>) => ReactNode;
    renderEmptyAction?: () => ReactNode;
    /** Optional provider wrapping the tree sidebar (domain specific item actions). */
    SidebarProvider?: ComponentType<{ children: ReactNode }>;
}
