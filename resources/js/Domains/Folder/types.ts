import type { Flow } from '@/Domains/Flow/types';
import type {
    ExplorerBreadcrumb,
    ExplorerFolder,
    ExplorerFolderTree,
    ExplorerTeamTree,
    ExplorerUserTree,
} from '@/Shared/Explorer/types';

export type { BreadcrumbSiblingFolder, DeletableFolder } from '@/Shared/Explorer/types';

export type Folder = ExplorerFolder;
export type Breadcrumb = ExplorerBreadcrumb;
export type TreeFlow = Pick<Flow, 'id' | 'name' | 'visibility' | 'folder_id' | 'workspace_folder_id' | 'owner_id' | 'team_id' | 'owner_workspace_role' | 'icon_type' | 'icon_value' | 'icon_color' | 'icon_url' | 'library_reference' | 'library_locked'>;
export type FolderTree = ExplorerFolderTree<TreeFlow>;
export type TeamTree = ExplorerTeamTree<TreeFlow>;
export type UserTree = ExplorerUserTree<TreeFlow>;
