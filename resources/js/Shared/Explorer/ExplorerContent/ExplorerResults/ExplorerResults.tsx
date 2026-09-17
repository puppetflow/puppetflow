import { Fragment } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { router } from '@inertiajs/react';
import EmptyState from '@/Shared/UI/EmptyState/EmptyState';
import { handleLinkClick } from '@/Shared/Utils/navigation';
import FolderItem from '../../FolderItem/FolderItem';
import FolderIcon from '../../FolderItem/FolderIcon/FolderIcon';
import * as FolderS from '../../FolderItem/styled';
import { useExplorer, useExplorerConfig, useExplorerView } from '../../ExplorerContext';
import type { DropTarget, ExplorerFolderTree, ExplorerItem, ExplorerTeamTree } from '../../types';
import { countTreeItems, getLocationUrl } from '../utils';
import { useDropTarget } from '../useExplorerDrop';
import type { ExplorerSelection } from '../useExplorerSelection';
import * as S from './styled';

type DropHandler = (event: React.DragEvent, target: DropTarget) => void;

interface Props<TItem extends ExplorerItem> {
    selection: ExplorerSelection<TItem>;
    onDrop: DropHandler;
}

interface ParentFolderProps {
    url: string;
    target: DropTarget;
    onDrop: DropHandler;
}

function ParentFolder({ url, target, onDrop }: ParentFolderProps) {
    const { dragOver, handlers } = useDropTarget(event => onDrop(event, target));

    return (
        <S.ParentFolder href={url} $dragOver={dragOver} onClick={event => handleLinkClick(event, url)} {...handlers}>
            <S.ParentFolderIcon>
                <Icon icon="lucide:corner-left-up" />
            </S.ParentFolderIcon>
            <S.ParentFolderName>..</S.ParentFolderName>
        </S.ParentFolder>
    );
}

interface VirtualTeamFolderProps<TItem extends ExplorerItem> {
    team: ExplorerTeamTree<TItem>;
    onDrop: DropHandler;
}

// Teams without a physical root folder (media) are listed as virtual folders at the workspace root.
function VirtualTeamFolder<TItem extends ExplorerItem>({ team, onDrop }: VirtualTeamFolderProps<TItem>) {
    const { basePath } = useExplorerConfig();
    const url = `${basePath}?view=workspace&team_id=${team.id}`;
    const { dragOver, handlers } = useDropTarget(
        event => onDrop(event, { folderId: null, scope: 'team', teamId: team.id, ownerId: null }),
    );

    return (
        <FolderS.Item href={url} $dragOver={dragOver} onClick={event => handleLinkClick(event, url)} {...handlers}>
            <FolderIcon team shared />
            <FolderS.NameGroup>
                <FolderS.Name>{team.name}</FolderS.Name>
            </FolderS.NameGroup>
        </FolderS.Item>
    );
}

function countItems<TItem extends ExplorerItem>(trees: ExplorerFolderTree<TItem>[]): number {
    return trees.reduce(
        (total, node) => total + countTreeItems(node) + countItems(node.children),
        0,
    );
}

export default function ExplorerResults<TItem extends ExplorerItem>({ selection, onDrop }: Props<TItem>) {
    const { config, data } = useExplorer<TItem>();
    const { basePath, labels } = config;
    const { items, folders, currentFolder, userTrees, teamTrees, filters } = data;
    const { isWorkspaceView, isUsersView, teamId, viewMode, resolveDropTarget } = useExplorerView();
    const parentFolderId = currentFolder?.parent_id ?? null;
    const showFolders = filters.search_everywhere !== '1';
    const searchActive = Boolean(filters.search);
    const virtualTeams = isWorkspaceView && !currentFolder && teamId === null
        ? teamTrees.filter(team => team.root_folder_id === null)
        : [];
    const root = useDropTarget(
        event => onDrop(event, resolveDropTarget(currentFolder?.id ?? null)),
        { bubble: true },
    );

    if (isUsersView) {
        return (
            <S.DropZone $active={false}>
                {userTrees.length > 0 ? (
                    <S.FoldersGrid>
                        {userTrees.map(user => {
                            const userUrl = `${basePath}?owner_id=${user.id}`;
                            const itemCount = user.rootItems.length + countItems(user.tree);
                            return (
                                <FolderS.Item
                                    key={`user-${user.id}`}
                                    href={userUrl}
                                    onClick={event => handleLinkClick(event, userUrl)}
                                >
                                    <Icon icon="lucide:user" width={20} height={20} />
                                    <FolderS.NameGroup>
                                        <FolderS.Name>{user.name}</FolderS.Name>
                                        <FolderS.OwnerName>
                                            {itemCount} {itemCount === 1 ? labels.item : labels.items}
                                        </FolderS.OwnerName>
                                    </FolderS.NameGroup>
                                </FolderS.Item>
                            );
                        })}
                    </S.FoldersGrid>
                ) : (
                    <EmptyState
                        icon={<Icon icon="lucide:users" width={48} height={48} />}
                        title="No users"
                        description={`No other user has personal ${labels.items} in this workspace`}
                    />
                )}
            </S.DropZone>
        );
    }

    const itemCards = items.data.map(item => (
        <Fragment key={item.id}>
            {config.renderItemCard({
                item,
                variant: viewMode,
                selectionActive: selection.selectionActive,
                selected: selection.selectedItemIds.has(item.id),
                onToggleSelect: selection.toggleItemSelection,
            })}
        </Fragment>
    ));

    return (
        <S.DropZone $active={root.dragOver} {...root.handlers}>
            {showFolders && (currentFolder || folders.length > 0 || virtualTeams.length > 0) && (
                <S.FoldersGrid>
                    {currentFolder && (
                        <ParentFolder
                            url={getLocationUrl(basePath, parentFolderId, filters)}
                            target={resolveDropTarget(parentFolderId)}
                            onDrop={onDrop}
                        />
                    )}
                    {virtualTeams.map(team => (
                        <VirtualTeamFolder key={`team-${team.id}`} team={team} onDrop={onDrop} />
                    ))}
                    {folders.map(folder => (
                        <FolderItem
                            key={folder.id}
                            folder={folder}
                            onDrop={onDrop}
                            selectionActive={selection.selectionActive}
                            selected={selection.selectedFolderIds.has(folder.id)}
                            onToggleSelect={selection.toggleFolderSelection}
                        />
                    ))}
                </S.FoldersGrid>
            )}

            {items.data.length > 0 ? (
                <>
                    {viewMode === 'grid'
                        ? <S.FlowsGrid $columns={config.gridColumns ?? 5}>{itemCards}</S.FlowsGrid>
                        : <S.FlowsList>{itemCards}</S.FlowsList>}

                    {items.last_page > 1 && (
                        <S.Pagination>
                            {items.links.map((link, index) => (
                                <S.PageLink
                                    key={index}
                                    $active={link.active}
                                    disabled={!link.url}
                                    onClick={() => link.url && router.visit(link.url, { preserveState: true })}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </S.Pagination>
                    )}
                </>
            ) : (!showFolders || (folders.length === 0 && virtualTeams.length === 0)) && (
                <EmptyState
                    icon={<Icon icon="lucide:layout-grid" width={48} height={48} />}
                    title={searchActive ? `No ${labels.items} found` : (isWorkspaceView ? 'Nothing shared yet' : labels.emptyTitle)}
                    description={searchActive
                        ? 'Try a different search term'
                        : (isWorkspaceView ? labels.sharedEmptyDescription : labels.emptyDescription)}
                    action={
                        !searchActive && !isWorkspaceView && config.renderEmptyAction
                            ? config.renderEmptyAction()
                            : undefined
                    }
                />
            )}
        </S.DropZone>
    );
}
