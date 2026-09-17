import { useCallback, useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { useToast } from '@/App/Hooks/useToast';
import { useExplorerConfig } from '../ExplorerContext';
import type { DropTarget, PendingMove } from '../types';
import { getFolderMovePayload, getMovePayload, isExplorerDrag, isSameDropScope } from './utils';
import { useGlobalDragReset } from '../useGlobalDragReset';

// Shared drop handling: dragged folders are re-parented, dragged items are
// moved and a confirmation is requested when the move changes their scope.
export function useExplorerDrop() {
    const { dragType, endpoints } = useExplorerConfig();
    const { toast } = useToast();
    const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

    const executeMove = useCallback((itemId: Id, target: DropTarget, changeVisibility: boolean) => {
        router.patch(endpoints.moveItem(itemId), getMovePayload(target, changeVisibility), {
            preserveState: true,
            onError: () => toast('The item could not be moved.', 'error'),
        });
    }, [endpoints, toast]);

    const executeFolderMove = useCallback((folderId: Id, target: DropTarget, changeAssignment: boolean) => {
        router.patch(
            `${endpoints.folders}/${folderId}/move`,
            getFolderMovePayload(target, changeAssignment),
            {
                preserveState: true,
                onError: () => toast('The folder could not be moved.', 'error'),
            },
        );
    }, [endpoints.folders, toast]);

    const drop = useCallback((event: React.DragEvent, target: DropTarget) => {
        event.preventDefault();
        const type = event.dataTransfer.getData('application/x-drag-type');
        const draggedId = event.dataTransfer.getData('application/x-drag-id');
        if (!type || !draggedId) return;

        if (type === 'folder') {
            if (draggedId === String(target.folderId ?? '')) return;

            const folderScope = event.dataTransfer.getData('application/x-drag-visibility');
            const folderTeamId = event.dataTransfer.getData('application/x-drag-team-id');
            const folderOwnerId = event.dataTransfer.getData('application/x-drag-owner-id');
            if (
                isSameDropScope(folderScope, folderTeamId, folderOwnerId, target)
                || !endpoints.folderScopeMoves
            ) {
                executeFolderMove(draggedId, target, false);
            } else {
                setPendingMove({
                    itemId: draggedId,
                    target,
                    fromScope: folderScope || 'owner',
                    fromOwnerId: folderOwnerId || null,
                    resource: 'folder',
                });
            }
            return;
        }
        if (type !== dragType) return;

        const itemScope = event.dataTransfer.getData('application/x-drag-visibility');
        const itemTeamId = event.dataTransfer.getData('application/x-drag-team-id');
        const itemOwnerId = event.dataTransfer.getData('application/x-drag-owner-id');
        if (isSameDropScope(itemScope, itemTeamId, itemOwnerId, target)) {
            executeMove(draggedId, target, false);
        } else {
            setPendingMove({
                itemId: draggedId,
                target,
                fromScope: itemScope || 'owner',
                fromOwnerId: itemOwnerId || null,
                resource: 'item',
            });
        }
    }, [dragType, endpoints.folderScopeMoves, executeFolderMove, executeMove]);

    const confirmPendingMove = useCallback((move: PendingMove) => {
        if (move.resource === 'folder') {
            executeFolderMove(move.itemId, move.target, true);
        } else {
            executeMove(move.itemId, move.target, true);
        }
        setPendingMove(null);
    }, [executeFolderMove, executeMove]);

    return {
        pendingMove,
        drop,
        confirmPendingMove,
        closePendingMove: useCallback(() => setPendingMove(null), []),
    };
}

interface DropTargetOptions {
    /** Let the event reach parent drop zones (default: stop it). */
    bubble?: boolean;
}

// Drag-over highlight and drop wiring for a single drop target element.
// OS file drags are ignored so they reach the domain's upload zone untouched.
export function useDropTarget(onDrop: (event: React.DragEvent) => void, { bubble = false }: DropTargetOptions = {}) {
    const [dragOver, setDragOver] = useState(false);
    useGlobalDragReset(useCallback(() => setDragOver(false), []));

    const handlers = useMemo(() => ({
        onDragOver: (event: React.DragEvent) => {
            if (!isExplorerDrag(event)) return;
            event.preventDefault();
            if (!bubble) event.stopPropagation();
            event.dataTransfer.dropEffect = 'move';
            setDragOver(true);
        },
        onDragLeave: (event: React.DragEvent) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(false);
        },
        onDrop: (event: React.DragEvent) => {
            if (!isExplorerDrag(event)) return;
            if (!bubble) event.stopPropagation();
            setDragOver(false);
            onDrop(event);
        },
    }), [bubble, onDrop]);

    return { dragOver, handlers };
}
