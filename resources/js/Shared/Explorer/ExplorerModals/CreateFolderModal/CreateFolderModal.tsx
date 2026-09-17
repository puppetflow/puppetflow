import { useState } from 'react';
import { router } from '@inertiajs/react';
import Modal from '@/Shared/UI/Modal/Modal';
import Input from '@/Shared/UI/Input/Input';
import Button from '@/Shared/UI/Button/Button';
import { useToast } from '@/App/Hooks/useToast';
import { useExplorer, useExplorerView } from '../../ExplorerContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

// Creates a folder in the current explorer location (personal, on behalf, workspace or team).
export default function CreateFolderModal({ isOpen, onClose }: Props) {
    const { config, data: { currentFolder, filters } } = useExplorer();
    const { isWorkspaceView, teamId } = useExplorerView();
    const { toast } = useToast();
    const [newFolderName, setNewFolderName] = useState('');
    const [saving, setSaving] = useState(false);
    const handleClose = () => {
        setNewFolderName('');
        onClose();
    };

    const handleCreateFolder = () => {
        if (!newFolderName.trim() || saving) return;
        setSaving(true);
        router.post(config.endpoints.folders, {
            name: newFolderName,
            parent_id: currentFolder?.id || null,
            ...(isWorkspaceView && { is_shared: true }),
            ...(isWorkspaceView && !currentFolder && teamId && { team_id: teamId }),
            ...(!isWorkspaceView && filters.owner_id && { owner_id: filters.owner_id }),
        }, {
            onSuccess: () => {
                handleClose();
            },
            onError: () => toast('The folder could not be created.', 'error'),
            onFinish: () => setSaving(false),
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="New Folder"
            footer={
                <>
                    <Button variant="secondary" onClick={handleClose}>Cancel</Button>
                    <Button onClick={handleCreateFolder} loading={saving}>Create</Button>
                </>
            }
        >
            <Input
                label="Folder name"
                value={newFolderName}
                onChange={event => setNewFolderName(event.target.value)}
                placeholder="My folder"
                autoFocus
                onKeyDown={event => event.key === 'Enter' && handleCreateFolder()}
            />
        </Modal>
    );
}
