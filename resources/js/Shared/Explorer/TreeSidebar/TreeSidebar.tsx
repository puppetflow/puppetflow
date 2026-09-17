import { useMemo } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { useUrlSyncedModal } from '@/Shared/Hooks/useUrlSyncedModal';
import { useExplorer } from '../ExplorerContext';
import type { DeletableFolder, ExplorerItem } from '../types';
import { allFolderTrees, collectFolders } from '../ExplorerContent/utils';
import RenameFolderModal from '../FolderItem/RenameFolderModal/RenameFolderModal';
import PersonalTreeSection from './components/PersonalTreeSection/PersonalTreeSection';
import WorkspaceTreeSection from './components/WorkspaceTreeSection/WorkspaceTreeSection';
import UsersTreeSection from './components/UsersTreeSection/UsersTreeSection';
import { FolderTreeContext } from './treeContext';
import { useTreeExpansion } from './useTreeExpansion';
import * as S from './styled';

interface Props {
    width?: number;
}

// Tree sidebar shared by every explorer: personal, workspace (with teams) and users sections.
export default function TreeSidebar<TItem extends ExplorerItem>({ width }: Props) {
    const { config, data, actions } = useExplorer<TItem>();
    const { currentFolder, breadcrumbs, filters } = data;
    const currentFolderId = currentFolder?.id ?? null;

    // Sections holding the current location start expanded.
    const activeSections = [
        ...(filters.view === 'workspace' ? ['workspace'] : []),
        ...(filters.view === 'users' || filters.owner_id !== null ? ['users'] : []),
        ...(filters.owner_id !== null ? [`user_${filters.owner_id}`] : []),
        ...(filters.team_id ? [`team_${filters.team_id}`] : []),
    ];
    const { expandedFolders, expandedSections, toggleFolder, toggleSection } = useTreeExpansion(config.key, breadcrumbs, activeSections);

    const allFolders = useMemo<DeletableFolder[]>(() => collectFolders(allFolderTrees(data)), [data]);
    const {
        selectedItem: renameTarget,
        openModal: renameFolder,
        closeModal: closeRename,
    } = useUrlSyncedModal(allFolders, 'edit-sidebar-folder');

    const treeContext = useMemo(() => ({
        currentFolderId,
        expandedFolders,
        expandedSections,
        toggleFolder,
        toggleSection,
        renameFolder,
        deleteFolder: actions.deleteFolder,
    }), [currentFolderId, expandedFolders, expandedSections, toggleFolder, toggleSection, renameFolder, actions.deleteFolder]);

    return (
        <S.Sidebar $width={width}>
            <S.SidebarHeader>
                <Icon icon="lucide:panel-left" />
                Explorer
            </S.SidebarHeader>
            <S.TreeContainer>
                <S.TreeInner>
                    <FolderTreeContext.Provider value={treeContext}>
                        <PersonalTreeSection />
                        <WorkspaceTreeSection />
                        <UsersTreeSection />
                    </FolderTreeContext.Provider>
                </S.TreeInner>
            </S.TreeContainer>

            {renameTarget && <RenameFolderModal folder={renameTarget} onClose={closeRename} />}
        </S.Sidebar>
    );
}
