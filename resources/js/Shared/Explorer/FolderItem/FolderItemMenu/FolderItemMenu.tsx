import { useRef, useState } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { useActionMenuDismiss } from '@/Shared/Hooks/useActionMenuDismiss';
import { useMenuFlip } from '@/Shared/Hooks/useMenuFlip';
import FolderMenuItems from '../../FolderMenuItems';
import * as S from './styled';

interface Props {
    onRename: () => void;
    onDelete: () => void;
}

export default function FolderItemMenu({ onRename, onDelete }: Props) {
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const flipUp = useMenuFlip(open, popupRef);

    useActionMenuDismiss({
        open,
        refs: [menuRef],
        onDismiss: () => setOpen(false),
        closeOnScroll: false,
    });

    const close = (action: () => void) => () => {
        setOpen(false);
        action();
    };

    return (
        <S.Wrapper ref={menuRef}>
            <S.Button onClick={event => { event.preventDefault(); event.stopPropagation(); setOpen(value => !value); }}>
                <Icon icon="lucide:ellipsis-vertical" width={14} />
            </S.Button>
            {open && (
                <S.Menu ref={popupRef} $up={flipUp}>
                    <FolderMenuItems onRename={close(onRename)} onDelete={close(onDelete)} />
                </S.Menu>
            )}
        </S.Wrapper>
    );
}
