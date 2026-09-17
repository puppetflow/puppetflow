import { useState } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { router } from '@inertiajs/react';
import Modal from '@/Shared/UI/Modal/Modal';
import Button from '@/Shared/UI/Button/Button';
import { useExplorer } from '../../ExplorerContext';
import type { DeletableFolder } from '../../types';
import { allFolderTrees, countFolderDescendants, findFolderNode } from '../../ExplorerContent/utils';
import * as S from './styled';

interface Props {
    folder: DeletableFolder | null;
    onClose: () => void;
}

export default function DeleteFolderModal({ folder, onClose }: Props) {
    const { config, data } = useExplorer();
    const { labels, endpoints } = config;
    const [deleting, setDeleting] = useState(false);
    const treeNode = folder ? findFolderNode(allFolderTrees(data), folder.id) : null;
    const { items: itemsCount, folders: subFoldersCount } = treeNode
        ? countFolderDescendants(treeNode)
        : { folders: 0, items: 0 };

    const handleDeleteFolder = () => {
        if (!folder) return;
        setDeleting(true);
        router.delete(`${endpoints.folders}/${folder.id}`, {
            onSuccess: onClose,
            onFinish: () => setDeleting(false),
        });
    };

    return (
        <Modal
            isOpen={!!folder}
            onClose={() => !deleting && onClose()}
            title="Delete Folder"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={deleting}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={handleDeleteFolder} loading={deleting}>
                        <Icon icon="lucide:trash-2" width={14} height={14} />
                        {deleting ? 'Deleting...' : 'Delete'}
                    </Button>
                </>
            }
        >
            <S.Body>
                <S.Icon>
                    <Icon icon="lucide:trash-2" width={28} height={28} />
                </S.Icon>
                <S.Title>
                    Delete &ldquo;{folder?.name}&rdquo;?
                </S.Title>
                {itemsCount > 0 || subFoldersCount > 0 ? (
                    <>
                        <S.Text>
                            This folder contains{' '}
                            {itemsCount > 0 && (
                                <strong>{itemsCount} {itemsCount > 1 ? labels.items : labels.item}</strong>
                            )}
                            {itemsCount > 0 && subFoldersCount > 0 && ' and '}
                            {subFoldersCount > 0 && (
                                <strong>{subFoldersCount} sub-folder{subFoldersCount > 1 ? 's' : ''}</strong>
                            )}
                            . Everything inside will be permanently deleted.
                        </S.Text>
                        <S.Warning>
                            <Icon icon="lucide:alert-triangle" width={16} height={16} />
                            <span>{labels.deleteFolderWarning}</span>
                        </S.Warning>
                    </>
                ) : (
                    <S.Text>
                        This empty folder will be permanently deleted. This action cannot be undone.
                    </S.Text>
                )}
            </S.Body>
        </Modal>
    );
}
