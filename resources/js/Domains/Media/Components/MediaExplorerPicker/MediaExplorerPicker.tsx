import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
    ExplorerFolderTree,
    ExplorerTeamTree,
    ExplorerUserTree,
} from '@/Shared/Explorer/types';
import type { MediaTreeItem } from '@/Domains/Media/types';
import { mediaIcon, mediaIconColor } from '@/Domains/Media/types';
import { useAuth } from '@/App/Hooks/usePageProps';
import Button from '@/Shared/UI/Button/Button';
import { Icon } from '@/Shared/UI/Icon/Icon';
import Modal from '@/Shared/UI/Modal/Modal';
import * as S from './styled';

interface PickerData {
    folderTree: ExplorerFolderTree<MediaTreeItem>[];
    rootItems: MediaTreeItem[];
    workspaceTree: ExplorerFolderTree<MediaTreeItem>[];
    workspaceRootItems: MediaTreeItem[];
    teamTrees: ExplorerTeamTree<MediaTreeItem>[];
    userTrees: ExplorerUserTree<MediaTreeItem>[];
}

interface Location {
    key: string;
    label: string;
    icon: string;
    items: MediaTreeItem[];
}

interface Props {
    zIndex?: number;
    onClose: () => void;
    onSelect: (item: MediaTreeItem) => void;
}

function findFolder(
    folders: ExplorerFolderTree<MediaTreeItem>[],
    key: string,
): ExplorerFolderTree<MediaTreeItem> | null {
    for (const folder of folders) {
        if (`folder:${folder.id}` === key) return folder;
        const child = findFolder(folder.children, key);
        if (child) return child;
    }
    return null;
}

function resolveLocation(data: PickerData, key = 'personal'): Location {
    if (key === 'workspace') {
        return { key, label: 'Workspace', icon: 'lucide:building-2', items: data.workspaceRootItems };
    }

    const team = data.teamTrees.find(item => `team:${item.id}` === key);
    if (team) return { key, label: team.name, icon: 'lucide:users', items: team.rootItems };

    const user = data.userTrees.find(item => `user:${item.id}` === key);
    if (user) return { key, label: user.name, icon: 'lucide:user-round', items: user.rootItems };

    const folder = findFolder([
        ...data.folderTree,
        ...data.workspaceTree,
        ...data.teamTrees.flatMap(item => item.tree),
        ...data.userTrees.flatMap(item => item.tree),
    ], key);
    if (folder) return { key, label: folder.name, icon: 'lucide:folder', items: folder.items };

    return { key: 'personal', label: 'Personal', icon: 'lucide:user', items: data.rootItems };
}

function FolderRows({
    folders,
    depth,
    activeKey,
    onOpen,
}: {
    folders: ExplorerFolderTree<MediaTreeItem>[];
    depth: number;
    activeKey: string;
    onOpen: (location: Location) => void;
}) {
    return folders.map(folder => {
        const key = `folder:${folder.id}`;
        return (
            <div key={key}>
                <S.TreeRow
                    type="button"
                    $depth={depth}
                    $active={activeKey === key}
                    onClick={() => onOpen({
                        key,
                        label: folder.name,
                        icon: 'lucide:folder',
                        items: folder.items,
                    })}
                >
                    <Icon icon="lucide:folder" width={14} />
                    <span>{folder.name}</span>
                    <small>{folder.items.length}</small>
                </S.TreeRow>
                <FolderRows
                    folders={folder.children}
                    depth={depth + 1}
                    activeKey={activeKey}
                    onOpen={onOpen}
                />
            </div>
        );
    });
}

export default function MediaExplorerPicker({ zIndex, onClose, onSelect }: Props) {
    const { user } = useAuth();
    const [data, setData] = useState<PickerData | null>(null);
    const [location, setLocation] = useState<Location | null>(null);
    const [selected, setSelected] = useState<MediaTreeItem | null>(null);
    const [search, setSearch] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(
        user?.explorer_view_mode === 'list' ? 'list' : 'grid',
    );

    const loadData = useCallback(async (signal?: AbortSignal) => {
        setRefreshing(true);
        setError(null);
        try {
            const response = await fetch('/media-library/picker', {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                signal,
            });
            if (!response.ok) throw new Error('The Media Library could not be loaded.');
            const payload = await response.json() as PickerData;
            setData(payload);
            setLocation(current => resolveLocation(payload, current?.key));
            setSelected(null);
        } catch (exception) {
            if (exception instanceof DOMException && exception.name === 'AbortError') return;
            setError(exception instanceof Error ? exception.message : 'The Media Library could not be loaded.');
        } finally {
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        void loadData(controller.signal);
        return () => controller.abort();
    }, [loadData]);

    const open = (next: Location) => {
        setLocation(next);
        setSelected(null);
        setSearch('');
    };
    const items = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        return (location?.items ?? []).filter(item => (
            query === '' || item.name.toLocaleLowerCase().includes(query)
        ));
    }, [location, search]);

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Choose from Media Library"
            width="960px"
            zIndex={zIndex}
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button disabled={!selected} onClick={() => selected && onSelect(selected)}>
                        Choose media
                    </Button>
                </>
            )}
        >
            <S.Layout>
                <S.Sidebar>
                    {!data && !error && <S.State>Loading library...</S.State>}
                    {error && <S.State $error>{error}</S.State>}
                    {data && (
                        <>
                            <S.SectionLabel>Library</S.SectionLabel>
                            <S.TreeRow
                                type="button"
                                $depth={0}
                                $active={location?.key === 'personal'}
                                onClick={() => open({
                                    key: 'personal',
                                    label: 'Personal',
                                    icon: 'lucide:user',
                                    items: data.rootItems,
                                })}
                            >
                                <Icon icon="lucide:user" width={14} />
                                <span>Personal</span>
                                <small>{data.rootItems.length}</small>
                            </S.TreeRow>
                            <FolderRows folders={data.folderTree} depth={1} activeKey={location?.key ?? ''} onOpen={open} />
                            <S.TreeRow
                                type="button"
                                $depth={0}
                                $active={location?.key === 'workspace'}
                                onClick={() => open({
                                    key: 'workspace',
                                    label: 'Workspace',
                                    icon: 'lucide:building-2',
                                    items: data.workspaceRootItems,
                                })}
                            >
                                <Icon icon="lucide:building-2" width={14} />
                                <span>Workspace</span>
                                <small>{data.workspaceRootItems.length}</small>
                            </S.TreeRow>
                            <FolderRows folders={data.workspaceTree} depth={1} activeKey={location?.key ?? ''} onOpen={open} />
                            {data.teamTrees.map(team => (
                                <div key={team.id}>
                                    <S.TreeRow
                                        type="button"
                                        $depth={1}
                                        $active={location?.key === `team:${team.id}`}
                                        onClick={() => open({
                                            key: `team:${team.id}`,
                                            label: team.name,
                                            icon: 'lucide:users',
                                            items: team.rootItems,
                                        })}
                                    >
                                        <Icon icon="lucide:users" width={14} />
                                        <span>{team.name}</span>
                                        <small>{team.rootItems.length}</small>
                                    </S.TreeRow>
                                    <FolderRows folders={team.tree} depth={2} activeKey={location?.key ?? ''} onOpen={open} />
                                </div>
                            ))}
                            {data.userTrees.map(userTree => (
                                <div key={userTree.id}>
                                    <S.TreeRow
                                        type="button"
                                        $depth={0}
                                        $active={location?.key === `user:${userTree.id}`}
                                        onClick={() => open({
                                            key: `user:${userTree.id}`,
                                            label: userTree.name,
                                            icon: 'lucide:user-round',
                                            items: userTree.rootItems,
                                        })}
                                    >
                                        <Icon icon="lucide:user-round" width={14} />
                                        <span>{userTree.name}</span>
                                        <small>{userTree.rootItems.length}</small>
                                    </S.TreeRow>
                                    <FolderRows folders={userTree.tree} depth={1} activeKey={location?.key ?? ''} onOpen={open} />
                                </div>
                            ))}
                        </>
                    )}
                </S.Sidebar>
                <S.Content>
                    <S.ContentHeader>
                        <S.Location>
                            <Icon icon={location?.icon ?? 'lucide:folder'} width={15} />
                            <strong>{location?.label ?? 'Media'}</strong>
                        </S.Location>
                        <S.HeaderActions>
                            <S.Search>
                                <Icon icon="lucide:search" width={14} />
                                <input
                                    value={search}
                                    onChange={event => setSearch(event.target.value)}
                                    placeholder="Search this folder..."
                                    aria-label="Search this folder"
                                />
                            </S.Search>
                            <S.HeaderButton
                                type="button"
                                $loading={refreshing}
                                disabled={refreshing}
                                title="Refresh Media Library"
                                aria-label="Refresh Media Library"
                                onClick={() => void loadData()}
                            >
                                <Icon icon="lucide:refresh-cw" width={14} />
                            </S.HeaderButton>
                            <S.ViewToggle
                                type="button"
                                $active={viewMode === 'grid'}
                                title="Grid view"
                                aria-label="Grid view"
                                onClick={() => setViewMode('grid')}
                            >
                                <Icon icon="lucide:layout-grid" width={14} />
                            </S.ViewToggle>
                            <S.ViewToggle
                                type="button"
                                $active={viewMode === 'list'}
                                title="List view"
                                aria-label="List view"
                                onClick={() => setViewMode('list')}
                            >
                                <Icon icon="lucide:list" width={14} />
                            </S.ViewToggle>
                        </S.HeaderActions>
                    </S.ContentHeader>
                    {location && items.length === 0 ? (
                        <S.Empty>{search ? 'No matching media in this folder.' : 'This folder has no media.'}</S.Empty>
                    ) : (
                        <S.Results $viewMode={viewMode}>
                            {items.map(item => (
                                <S.MediaTile
                                    key={item.id}
                                    $viewMode={viewMode}
                                    type="button"
                                    $selected={selected?.id === item.id}
                                    onClick={() => setSelected(item)}
                                    onDoubleClick={() => onSelect(item)}
                                >
                                    <S.Preview $viewMode={viewMode}>
                                        {item.thumbnail_url
                                            ? <img src={item.thumbnail_url} alt="" loading="lazy" />
                                            : (
                                                <Icon
                                                    icon={mediaIcon(item.mime_type)}
                                                    width={30}
                                                    style={{ color: mediaIconColor(item.mime_type) }}
                                                />
                                            )}
                                    </S.Preview>
                                    <span title={item.name}>{item.name}</span>
                                    {selected?.id === item.id && <Icon icon="lucide:check" width={13} />}
                                </S.MediaTile>
                            ))}
                        </S.Results>
                    )}
                </S.Content>
            </S.Layout>
        </Modal>
    );
}
