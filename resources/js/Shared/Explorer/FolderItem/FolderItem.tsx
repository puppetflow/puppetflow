import { useMemo } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { handleLinkClick } from '@/Shared/Utils/navigation';
import { useUrlSyncedModal } from '@/Shared/Hooks/useUrlSyncedModal';
import { useExplorer, useExplorerView } from '../ExplorerContext';
import type { DropTarget, ExplorerFolder } from '../types';
import { getFolderUrl } from '../ExplorerContent/utils';
import FolderIcon from './FolderIcon/FolderIcon';
import FolderItemMenu from './FolderItemMenu/FolderItemMenu';
import RenameFolderModal from './RenameFolderModal/RenameFolderModal';
import { useFolderItemDnd } from './useFolderItemDnd';
import * as S from './styled';

interface FolderItemProps {
    folder: ExplorerFolder;
    onDrop: (event: React.DragEvent, target: DropTarget) => void;
    selectionActive?: boolean;
    selected?: boolean;
    onToggleSelect?: (folder: ExplorerFolder) => void;
}

export default function FolderItem({ folder, onDrop, selectionActive = false, selected = false, onToggleSelect }: FolderItemProps) {
    const { config: { basePath }, data: { filters }, actions } = useExplorer();
    const { isWorkspaceView } = useExplorerView();
    const isTeamRoot = !!folder.team_id && !folder.parent_id;
    const selectable = !isTeamRoot && !!onToggleSelect;
    const modalFolders = useMemo(() => [folder], [folder]);
    const {
        selectedItem: renameFolder,
        openModal: openRename,
        closeModal: closeRename,
    } = useUrlSyncedModal(modalFolders, 'edit-folder');
    const folderUrl = getFolderUrl(basePath, folder.id, filters);
    const dnd = useFolderItemDnd(folder, onDrop);

    const handleItemClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (selectionActive && selectable) {
            e.preventDefault();
            e.stopPropagation();
            onToggleSelect?.(folder);
            return;
        }

        handleLinkClick(e, folderUrl);
    };

    return (
        <>
            <S.Item
                href={folderUrl}
                onClick={handleItemClick}
                draggable={!isTeamRoot}
                onDragStart={dnd.onDragStart}
                {...dnd.handlers}
                $dragOver={dnd.dragOver}
                $selected={selected}
                $selectionActive={selectionActive}
            >
                {!selectable ? (
                    <FolderIcon team={!!folder.team_id} shared={folder.is_shared} />
                ) : (
                    <S.SelectableIconWrapper>
                        <S.SelectableFolderIcon $selected={selected}>
                            <FolderIcon team={!!folder.team_id} shared={folder.is_shared} />
                        </S.SelectableFolderIcon>
                        <S.SelectCheckbox
                            type="button"
                            $selected={selected}
                            aria-pressed={selected}
                            aria-label={selected ? `Unselect ${folder.name}` : `Select ${folder.name}`}
                            onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                onToggleSelect?.(folder);
                            }}
                        >
                            {selected && <Icon icon="lucide:check" width={13} height={13} />}
                        </S.SelectCheckbox>
                    </S.SelectableIconWrapper>
                )}
                <S.NameGroup>
                    <S.Name>{folder.name}</S.Name>
                    {isWorkspaceView && folder.owner && !folder.team_id && (
                        <S.OwnerName>{folder.owner.name}</S.OwnerName>
                    )}
                </S.NameGroup>
                {!isTeamRoot && (
                    <FolderItemMenu onRename={() => openRename(folder)} onDelete={() => actions.deleteFolder(folder)} />
                )}
            </S.Item>

            {renameFolder && <RenameFolderModal folder={renameFolder} onClose={closeRename} />}
        </>
    );
}
