import Button from '@/Shared/UI/Button/Button';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { useExplorer } from './ExplorerContext';
import * as S from './styled';

// Header action opening the shared "New Folder" modal.
export default function NewFolderButton() {
    const { actions } = useExplorer();

    return (
        <Button variant="secondary" size="sm" onClick={actions.openCreateFolder}>
            <Icon icon="lucide:folder-plus" width={14} />
            <S.BtnLabel>New Folder</S.BtnLabel>
        </Button>
    );
}
