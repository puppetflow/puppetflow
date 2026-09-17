import { useState } from 'react';
import { router } from '@inertiajs/react';
import Button from '@/Shared/UI/Button/Button';
import Input from '@/Shared/UI/Input/Input';
import Modal from '@/Shared/UI/Modal/Modal';
import { useExplorerConfig } from '../../ExplorerContext';
import type { DeletableFolder } from '../../types';

interface Props {
    folder: DeletableFolder;
    onClose: () => void;
}

export default function RenameFolderModal({ folder, onClose }: Props) {
    const { endpoints } = useExplorerConfig();
    const [name, setName] = useState(folder.name);
    const [renaming, setRenaming] = useState(false);

    const close = () => {
        if (!renaming) onClose();
    };

    const rename = () => {
        if (!name.trim() || name === folder.name) {
            onClose();
            return;
        }

        setRenaming(true);
        router.put(`${endpoints.folders}/${folder.id}`, { name }, {
            onSuccess: onClose,
            onFinish: () => setRenaming(false),
        });
    };

    return (
        <Modal
            isOpen
            onClose={close}
            title="Rename Folder"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={renaming}>Cancel</Button>
                    <Button onClick={rename} loading={renaming}>Rename</Button>
                </>
            }
        >
            <Input
                label="Folder name"
                value={name}
                onChange={event => setName(event.target.value)}
                autoFocus
                onKeyDown={event => event.key === 'Enter' && rename()}
            />
        </Modal>
    );
}
