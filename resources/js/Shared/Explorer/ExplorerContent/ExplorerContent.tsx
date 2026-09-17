import type { ExplorerItem, ExplorerToolbarFilter } from '../types';
import ExplorerNavigation from './ExplorerNavigation/ExplorerNavigation';
import ExplorerToolbar from './ExplorerToolbar/ExplorerToolbar';
import ExplorerResults from './ExplorerResults/ExplorerResults';
import BatchDeleteModal from './BatchDeleteModal/BatchDeleteModal';
import VisibilityMoveModal from './VisibilityMoveModal/VisibilityMoveModal';
import * as S from './styled';
import { useExplorerDrop } from './useExplorerDrop';
import { useExplorerSelection } from './useExplorerSelection';

export default function ExplorerContent<TItem extends ExplorerItem>({
    toolbarFilters,
}: {
    toolbarFilters?: ExplorerToolbarFilter[];
}) {
    const selection = useExplorerSelection<TItem>();
    const dnd = useExplorerDrop();

    return (
        <S.Container>
            <ExplorerNavigation onDrop={dnd.drop} />
            <ExplorerToolbar selection={selection} filters={toolbarFilters} />
            <ExplorerResults selection={selection} onDrop={dnd.drop} />
            <BatchDeleteModal selection={selection} />
            <VisibilityMoveModal
                pendingMove={dnd.pendingMove}
                onClose={dnd.closePendingMove}
                onConfirm={dnd.confirmPendingMove}
            />
        </S.Container>
    );
}
