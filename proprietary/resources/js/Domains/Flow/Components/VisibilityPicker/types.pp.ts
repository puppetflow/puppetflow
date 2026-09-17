import type { ExplorerFolderTree as FolderTree, ExplorerTeamTree as TeamTree } from '@/Shared/Explorer/types';

export type Visibility = 'owner' | 'workspace' | 'team';
export type FolderTarget = Visibility | null;

export interface VisibilityPickerValue {
    visibility: Visibility;
    personalFolderId: Id | null;
    wsFolderId: Id | null;
    teamId: Id | null;
    teamFolderId: Id | null;
}

export interface VisibilityPickerProps {
    value: VisibilityPickerValue;
    onChange: (value: VisibilityPickerValue) => void;
    personalTree: FolderTree[];
    workspaceTree: FolderTree[];
    teamTrees: TeamTree[];
    /** Owner of the flow; personal folders created from the picker belong to this user. */
    ownerId?: Id | null;
    ownerChanged?: boolean;
    disabled?: boolean;
    disabledHint?: string;
    /** Folder resource endpoint used for inline folder creation (defaults to flow folders). */
    folderEndpoint?: string;
    /** Resource noun used in the option descriptions (defaults to "flow"). */
    resourceLabel?: string;
}
