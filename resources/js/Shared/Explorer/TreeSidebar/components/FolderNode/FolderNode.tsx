import { Icon } from '@/Shared/UI/Icon/Icon';
import { handleLinkClick } from '@/Shared/Utils/navigation';
import { useExplorerConfig } from '../../../ExplorerContext';
import type { ExplorerFolderTree, ExplorerItem } from '../../../types';
import { getFolderUrl } from '../../../ExplorerContent/utils';
import { useFolderTreeContext } from '../../treeContext';
import SidebarOverflow from '../SidebarOverflow/SidebarOverflow';
import TreeBranch from '../TreeBranch';
import FolderMenuItems from '../../../FolderMenuItems';
import { TreeChevron, TreeIconSlot, TreeLabel } from '../shared.styled';
import * as S from './styled';

interface Props<TItem extends ExplorerItem> {
    folder: ExplorerFolderTree<TItem>;
    depth: number;
    viewParam?: string;
    ownerId?: Id;
}

export default function FolderNode<TItem extends ExplorerItem>({ folder, depth, viewParam, ownerId }: Props<TItem>) {
    const { basePath } = useExplorerConfig();
    const {
        currentFolderId,
        deleteFolder,
        expandedFolders,
        renameFolder,
        toggleFolder,
    } = useFolderTreeContext();
    const isExpanded = expandedFolders.has(folder.id);
    const hasChildren = folder.children.length > 0 || folder.items.length > 0;
    const folderUrl = getFolderUrl(basePath, folder.id, { view: viewParam, owner_id: ownerId });

    return (
        <>
            <S.Row
                href={folderUrl}
                $depth={depth}
                $active={folder.id === currentFolderId}
                onClick={(event) => handleLinkClick(event, folderUrl)}
            >
                <TreeChevron
                    $visible={hasChildren}
                    $expanded={isExpanded}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        toggleFolder(folder.id);
                    }}
                >
                    <Icon icon="lucide:chevron-right" />
                </TreeChevron>
                <TreeIconSlot>
                    <Icon icon={isExpanded ? 'lucide:folder-open' : 'lucide:folder'} />
                    <SidebarOverflow>
                        <FolderMenuItems onRename={() => renameFolder(folder)} onDelete={() => deleteFolder(folder)} />
                    </SidebarOverflow>
                </TreeIconSlot>
                <TreeLabel>{folder.name}</TreeLabel>
            </S.Row>

            {isExpanded && (
                <TreeBranch folders={folder.children} items={folder.items} depth={depth + 1} viewParam={viewParam} ownerId={ownerId} />
            )}
        </>
    );
}
