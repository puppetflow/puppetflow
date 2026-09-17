import { Fragment } from 'react';
import { useExplorerConfig } from '../../ExplorerContext';
import type { ExplorerFolderTree, ExplorerItem } from '../../types';
import FolderNode from './FolderNode/FolderNode';

interface Props<TItem extends ExplorerItem> {
    folders: ExplorerFolderTree<TItem>[];
    items: TItem[];
    depth: number;
    viewParam?: string;
    ownerId?: Id;
}

// One level of the tree: sub-folders followed by the domain specific item rows.
export default function TreeBranch<TItem extends ExplorerItem>({ folders, items, depth, viewParam, ownerId }: Props<TItem>) {
    const { renderTreeItem } = useExplorerConfig<TItem>();

    return (
        <>
            {folders.map(folder => (
                <FolderNode key={`folder-${folder.id}`} folder={folder} depth={depth} viewParam={viewParam} ownerId={ownerId} />
            ))}
            {renderTreeItem && items.map(item => (
                <Fragment key={`item-${item.id}`}>{renderTreeItem({ item, depth })}</Fragment>
            ))}
        </>
    );
}
