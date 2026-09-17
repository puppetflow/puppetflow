import { useCallback } from 'react';
import type { DropTarget, ExplorerFolder } from '../types';
import { useExplorerView } from '../ExplorerContext';
import { getFolderDropTarget } from '../ExplorerContent/utils';
import { useDropTarget } from '../ExplorerContent/useExplorerDrop';

// A folder card is both draggable and a drop target for items and other folders.
export function useFolderItemDnd(folder: ExplorerFolder, onDrop: (event: React.DragEvent, target: DropTarget) => void) {
    const { isWorkspaceView } = useExplorerView();
    const target = useDropTarget(useCallback(
        (event: React.DragEvent) => onDrop(event, getFolderDropTarget(folder, isWorkspaceView)),
        [onDrop, folder, isWorkspaceView],
    ));

    const onDragStart = useCallback((event: React.DragEvent) => {
        const source = getFolderDropTarget(folder);
        event.dataTransfer.setData('application/x-drag-type', 'folder');
        event.dataTransfer.setData('application/x-drag-id', String(folder.id));
        event.dataTransfer.setData('application/x-drag-visibility', source.scope);
        event.dataTransfer.setData('application/x-drag-team-id', source.teamId === null ? '' : String(source.teamId));
        event.dataTransfer.setData('application/x-drag-owner-id', source.ownerId === null ? '' : String(source.ownerId));
        event.dataTransfer.effectAllowed = 'move';
    }, [folder]);

    return { ...target, onDragStart };
}
