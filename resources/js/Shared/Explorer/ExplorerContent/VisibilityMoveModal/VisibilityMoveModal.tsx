import Modal from '@/Shared/UI/Modal/Modal';
import Button from '@/Shared/UI/Button/Button';
import { useExplorerConfig } from '../../ExplorerContext';
import type { PendingMove } from '../../types';
import { scopeLabel } from '../utils';
import * as S from './styled';

interface Props {
    pendingMove: PendingMove | null;
    onClose: () => void;
    onConfirm: (move: PendingMove) => void;
}

export default function VisibilityMoveModal({ pendingMove, onClose, onConfirm }: Props) {
    const { labels } = useExplorerConfig();
    const changesOwner = pendingMove?.fromScope === 'owner'
        && pendingMove.target.scope === 'owner'
        && pendingMove.target.ownerId !== null
        && String(pendingMove.fromOwnerId) !== String(pendingMove.target.ownerId);

    return (
        <Modal
            isOpen={Boolean(pendingMove)}
            onClose={onClose}
            title={changesOwner ? 'Change owner?' : 'Change visibility?'}
            width="420px"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => pendingMove && onConfirm(pendingMove)}>
                        Move &amp; change {changesOwner ? 'owner' : 'visibility'}
                    </Button>
                </>
            }
        >
            {pendingMove && (
                <S.Warning>
                    This {pendingMove.resource === 'folder' ? 'folder' : labels.item} is moving from <strong>{scopeLabel(pendingMove.fromScope)}</strong> to <strong>{scopeLabel(pendingMove.target.scope)}</strong>{changesOwner ? ' with a different owner' : ''}.
                    <br /><br />
                    Its {changesOwner ? 'owner' : 'visibility'} must be changed to keep it accessible in the destination folder.
                </S.Warning>
            )}
        </Modal>
    );
}
