import { useCallback, useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { useAuth } from '@/App/Hooks/usePageProps';
import { useToast } from '@/App/Hooks/useToast';
import { useExplorer } from '../ExplorerContext';
import type { ExplorerFolder, ExplorerItem } from '../types';
import {
    allFolderTrees,
    countFolderDescendants,
    findFolderNode,
    getDefaultFolderTree,
    toggleSetValue,
} from './utils';

export type ExplorerSelection<TItem extends ExplorerItem> = ReturnType<typeof useExplorerSelection<TItem>>;

// Bulk selection of the visible items and folders, with the batch delete flow.
export function useExplorerSelection<TItem extends ExplorerItem>() {
    const { config, data } = useExplorer<TItem>();
    const { user } = useAuth();
    const { toast } = useToast();
    const items = data.items.data;
    const { folders } = data;
    const [selectedItemIds, setSelectedItemIds] = useState<Set<Id>>(() => new Set());
    const [selectedFolderIds, setSelectedFolderIds] = useState<Set<Id>>(() => new Set());
    const [deletingSelected, setDeletingSelected] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [confirmNestedDelete, setConfirmNestedDelete] = useState(false);

    const selectedItems = items.filter(item => selectedItemIds.has(item.id));
    const selectedFolders = folders.filter(folder => selectedFolderIds.has(folder.id));
    const selectedCount = selectedItemIds.size + selectedFolderIds.size;
    const selectionActive = selectedCount > 0;

    const canSelectItem = useCallback(
        (item: TItem) => config.canManageItem(item, user),
        [config, user],
    );

    const selectableItems = items.filter(canSelectItem);
    const selectableFolders = folders.filter(folder => !(folder.team_id && !folder.parent_id));
    const selectableVisibleCount = selectableItems.length + selectableFolders.length;
    const allVisibleSelected = selectableVisibleCount > 0
        && selectableItems.every(item => selectedItemIds.has(item.id))
        && selectableFolders.every(folder => selectedFolderIds.has(folder.id));

    const selectedFolderImpacts = selectedFolders.map(folder => ({
        folder,
        counts: countFolderDescendants(
            findFolderNode(allFolderTrees(data), folder.id) ?? getDefaultFolderTree<TItem>(folder),
        ),
    }));
    const hasSelectedFolderWithChildren = selectedFolderImpacts.some(
        ({ counts }) => counts.folders > 0 || counts.items > 0,
    );
    const selectedFolderTotals = selectedFolderImpacts.reduce(
        (acc, { counts }) => ({
            folders: acc.folders + counts.folders,
            items: acc.items + counts.items,
        }),
        { folders: 0, items: 0 },
    );

    useEffect(() => {
        setSelectedItemIds(previous => {
            const visibleIds = new Set(items.map(item => item.id));
            const next = new Set([...previous].filter(id => visibleIds.has(id)));
            return next.size === previous.size ? previous : next;
        });
        setSelectedFolderIds(previous => {
            const visibleIds = new Set(folders.map(folder => folder.id));
            const next = new Set([...previous].filter(id => visibleIds.has(id)));
            return next.size === previous.size ? previous : next;
        });
    }, [items, folders]);

    const clearSelection = useCallback(() => {
        setSelectedItemIds(new Set());
        setSelectedFolderIds(new Set());
        setConfirmNestedDelete(false);
    }, []);

    useEffect(() => {
        if (!selectionActive) return;

        const handleEscapeSelection = (event: KeyboardEvent) => {
            const hasOpenModal = document.querySelector('[data-modal-overlay]') !== null;
            if (event.key !== 'Escape' || hasOpenModal) return;
            clearSelection();
        };
        document.addEventListener('keydown', handleEscapeSelection);
        return () => document.removeEventListener('keydown', handleEscapeSelection);
    }, [clearSelection, selectionActive]);

    const toggleSelectAllVisible = useCallback(() => {
        setSelectedItemIds(previous => {
            const next = new Set(previous);
            selectableItems.forEach(item => {
                if (allVisibleSelected) next.delete(item.id);
                else next.add(item.id);
            });
            return next;
        });
        setSelectedFolderIds(previous => {
            const next = new Set(previous);
            selectableFolders.forEach(folder => {
                if (allVisibleSelected) next.delete(folder.id);
                else next.add(folder.id);
            });
            return next;
        });
    }, [allVisibleSelected, selectableItems, selectableFolders]);

    const toggleItemSelection = useCallback((item: TItem) => {
        setSelectedItemIds(previous => toggleSetValue(previous, item.id));
    }, []);

    const toggleFolderSelection = useCallback((folder: ExplorerFolder) => {
        setSelectedFolderIds(previous => toggleSetValue(previous, folder.id));
    }, []);

    const openDeleteModal = useCallback(() => {
        if (selectedCount === 0) return;
        setConfirmNestedDelete(false);
        setDeleteModalOpen(true);
    }, [selectedCount]);

    const closeDeleteModal = useCallback(() => {
        setDeleteModalOpen(false);
        setConfirmNestedDelete(false);
    }, []);

    const confirmDeleteSelected = useCallback(() => {
        if (selectedCount === 0 || (hasSelectedFolderWithChildren && !confirmNestedDelete)) return;
        setDeletingSelected(true);

        router.post(config.endpoints.batchDelete, {
            ids: selectedItems.map(item => item.id),
            folder_ids: selectedFolders.map(folder => folder.id),
        }, {
            preserveState: false,
            onSuccess: () => {
                setSelectedItemIds(new Set());
                setSelectedFolderIds(new Set());
                closeDeleteModal();
            },
            onError: () => toast('The selected items could not be deleted.', 'error'),
            onFinish: () => setDeletingSelected(false),
        });
    }, [
        closeDeleteModal,
        config.endpoints.batchDelete,
        confirmNestedDelete,
        hasSelectedFolderWithChildren,
        selectedCount,
        selectedItems,
        selectedFolders,
        toast,
    ]);

    return {
        selectedItemIds,
        selectedFolderIds,
        selectedItems,
        selectedFolders,
        selectedCount,
        selectionActive,
        selectableVisibleCount,
        allVisibleSelected,
        deletingSelected,
        deleteModalOpen,
        confirmNestedDelete,
        selectedFolderTotals,
        hasSelectedFolderWithChildren,
        clearSelection,
        toggleSelectAllVisible,
        toggleItemSelection,
        toggleFolderSelection,
        openDeleteModal,
        closeDeleteModal,
        confirmDeleteSelected,
        setConfirmNestedDelete,
    };
}
