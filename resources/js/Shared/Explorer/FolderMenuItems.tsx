import { Icon } from '@/Shared/UI/Icon/Icon';
import { MenuDivider, MenuItem } from './menu.styled';

interface Props {
    onRename: () => void;
    onDelete: () => void;
}

function select(event: React.MouseEvent, action: () => void) {
    // Menus live inside folder links: keep the click from navigating.
    event.preventDefault();
    event.stopPropagation();
    action();
}

// Rename / Delete entries shared by the sidebar folder nodes and the folder cards.
export default function FolderMenuItems({ onRename, onDelete }: Props) {
    return (
        <>
            <MenuItem onClick={event => select(event, onRename)}>
                <Icon icon="lucide:pencil" width={13} />
                Rename
            </MenuItem>
            <MenuDivider />
            <MenuItem $danger onClick={event => select(event, onDelete)}>
                <Icon icon="lucide:trash-2" width={13} />
                Delete
            </MenuItem>
        </>
    );
}
