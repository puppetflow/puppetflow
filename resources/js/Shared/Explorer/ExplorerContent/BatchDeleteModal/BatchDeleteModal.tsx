import { Icon } from '@/Shared/UI/Icon/Icon';
import Modal from '@/Shared/UI/Modal/Modal';
import Button from '@/Shared/UI/Button/Button';
import { ConfirmFlowList, ConfirmFlowItem, ConfirmationFlowItemLabel } from '@/Shared/Hooks/useConfirm';
import { useExplorerConfig } from '../../ExplorerContext';
import type { ExplorerItem } from '../../types';
import type { ExplorerSelection } from '../useExplorerSelection';
import * as S from './styled';

interface Props<TItem extends ExplorerItem> {
    selection: ExplorerSelection<TItem>;
}

export default function BatchDeleteModal<TItem extends ExplorerItem>({ selection }: Props<TItem>) {
    const { labels, renderItemIcon } = useExplorerConfig<TItem>();
    const {
        deleteModalOpen: isOpen,
        deletingSelected: deleting,
        selectedCount,
        selectedItems,
        selectedFolders,
        selectedFolderTotals: folderTotals,
        hasSelectedFolderWithChildren: hasNestedItems,
        confirmNestedDelete: nestedDeleteConfirmed,
        setConfirmNestedDelete: onNestedDeleteConfirmedChange,
        closeDeleteModal: onClose,
        confirmDeleteSelected: onConfirm,
    } = selection;

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                if (!deleting) onClose();
            }}
            title={selectedCount === 1 ? 'Delete Item' : 'Delete Items'}
            width="440px"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={deleting}>
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        onClick={onConfirm}
                        loading={deleting}
                        disabled={hasNestedItems && !nestedDeleteConfirmed}
                    >
                        <Icon icon="lucide:trash-2" width={14} />
                        Delete ({selectedCount})
                    </Button>
                </>
            }
        >
            <S.Body>
                <S.Intro>
                    Delete {selectedCount === 1 ? 'this item' : `these ${selectedCount} items`}? This action cannot be undone.
                </S.Intro>

                <ConfirmFlowList>
                    {selectedFolders.map(folder => (
                        <ConfirmFlowItem key={`folder-${folder.id}`} as="div">
                            <ConfirmationFlowItemLabel>
                                <Icon icon="lucide:folder" width={16} height={16} />
                                <span>{folder.name}</span>
                            </ConfirmationFlowItemLabel>
                        </ConfirmFlowItem>
                    ))}
                    {selectedItems.map(item => (
                        <ConfirmFlowItem key={`item-${item.id}`} as="div">
                            <ConfirmationFlowItemLabel>
                                {renderItemIcon(item)}
                                <span>{item.name}</span>
                            </ConfirmationFlowItemLabel>
                        </ConfirmFlowItem>
                    ))}
                </ConfirmFlowList>

                {hasNestedItems && (
                    <>
                        <S.Warning>
                            <Icon icon="lucide:alert-triangle" width={16} height={16} />
                            <span>
                                The selected folder{selectedFolders.length > 1 ? 's contain' : ' contains'}{' '}
                                {folderTotals.items > 0 && (
                                    <strong>{folderTotals.items} {folderTotals.items > 1 ? labels.items : labels.item}</strong>
                                )}
                                {folderTotals.items > 0 && folderTotals.folders > 0 && ' and '}
                                {folderTotals.folders > 0 && (
                                    <strong>{folderTotals.folders} sub-folder{folderTotals.folders > 1 ? 's' : ''}</strong>
                                )}
                                . Everything inside will be deleted too.
                            </span>
                        </S.Warning>

                        <S.CheckLabel>
                            <input
                                type="checkbox"
                                checked={nestedDeleteConfirmed}
                                onChange={event => onNestedDeleteConfirmedChange(event.target.checked)}
                            />
                            <span>I understand that selected folders and their children will be permanently deleted.</span>
                        </S.CheckLabel>
                    </>
                )}
            </S.Body>
        </Modal>
    );
}
