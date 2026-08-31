import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from '@/Shared/UI/Button/Button';
import { Icon } from '@/Shared/UI/Icon/Icon';
import AvatarSelectionToggle from '@/Shared/UI/AvatarSelectionToggle/AvatarSelectionToggle';
import SelectAllVisible from '@/Shared/UI/TableFilters/SelectAllVisible';
import TableCellContent from '@/Shared/UI/TableCellContent/TableCellContent';
import { useActionMenuDismiss } from '@/Shared/Hooks/useActionMenuDismiss';
import { useAnchoredDropdownPosition } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/hooks/useAnchoredDropdownPosition';
import { csrfHeaders } from '@/Shared/Utils/csrf';
import LocalTableFilterToolbar from '@/Shared/UI/TableFilters/LocalTableFilterToolbar';
import { matchesOwnershipScope } from '@/Shared/UI/TableFilters/options';
import { useCollapsedGroups } from '@/Shared/UI/TableFilters/useCollapsedGroups';
import { groupHierarchicalItems } from '@/Shared/Utils/groupHierarchicalItems';
import type { WorkspaceProxy } from '@/Domains/Workspace/types';
import WorkspaceProxyFormModal from './WorkspaceProxyFormModal';
import { countryFlag, getCountryName } from './countries';
import * as S from './styled';

interface Props {
    proxies: WorkspaceProxy[];
    teams: { id: Id; name: string }[];
    readOnly?: boolean;
}

async function requestJson(url: string, options: RequestInit): Promise<void> {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...csrfHeaders(),
            ...(options.headers || {}),
        },
    });
    const payload = await response.json().catch(() => ({})) as {
        message?: string;
        errors?: Record<string, string[]>;
    };
    if (!response.ok) {
        const validationMessage = payload.errors
            ? Object.values(payload.errors).flat().find(message => typeof message === 'string')
            : null;
        throw new Error(validationMessage || payload.message || 'Proxy request failed.');
    }
}

function endpoint(proxy: WorkspaceProxy): string {
    const host = proxy.host.includes(':') ? `[${proxy.host}]` : proxy.host;
    return `${proxy.scheme}://${host}:${proxy.port}`;
}

function visibilityIcon(proxy: WorkspaceProxy): string {
    if (proxy.visibility === 'team') return 'lucide:users-round';
    if (proxy.visibility === 'workspace') return 'lucide:building-2';
    return 'lucide:user';
}

function visibilityLabel(proxy: WorkspaceProxy): string {
    if (proxy.visibility === 'workspace') return 'Workspace';
    if (proxy.visibility === 'team') return `Team: ${proxy.team?.name || '-'}`;
    return 'Personal';
}

function ProxyActions({
    busy,
    onEdit,
    onDelete,
}: {
    busy: boolean;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const { dropdownRect, updateDropdownPosition } = useAnchoredDropdownPosition(
        triggerRef,
        open,
        {
            maxHeight: 160,
            minHeight: 44,
            minWidth: 150,
            clampLeft: true,
        },
    );

    useActionMenuDismiss({
        open,
        refs: [triggerRef, menuRef],
        onDismiss: () => setOpen(false),
        closeOnScroll: false,
        eventType: 'mousedown',
        eventCapture: false,
    });

    return (
        <S.Actions>
            <S.OverflowWrapper>
                <S.OverflowButton
                    type="button"
                    ref={triggerRef}
                    disabled={busy}
                    aria-label="Proxy actions"
                    aria-expanded={open}
                    onClick={() => {
                        if (!open) updateDropdownPosition();
                        setOpen(current => !current);
                    }}
                >
                    <Icon icon={busy ? 'lucide:loader-circle' : 'lucide:more-horizontal'} width={16} />
                </S.OverflowButton>
                {open && dropdownRect && createPortal(
                    <S.OverflowMenu
                        ref={menuRef}
                        style={{
                            top: dropdownRect.top,
                            left: dropdownRect.left,
                            width: dropdownRect.width,
                            transform: dropdownRect.placement === 'above'
                                ? 'translateY(-100%)'
                                : undefined,
                        }}
                    >
                        <S.MenuItem
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                onEdit();
                            }}
                        >
                            <Icon icon="lucide:pencil" width={14} />
                            Edit
                        </S.MenuItem>
                        <S.DangerMenuItem
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                onDelete();
                            }}
                        >
                            <Icon icon="lucide:trash-2" width={14} />
                            Delete
                        </S.DangerMenuItem>
                    </S.OverflowMenu>,
                    document.body,
                )}
            </S.OverflowWrapper>
        </S.Actions>
    );
}

export default function ProxiesSection({ proxies, teams, readOnly = false }: Props) {
    const [items, setItems] = useState(proxies);
    const [editing, setEditing] = useState<WorkspaceProxy | null>(null);
    const [open, setOpen] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
    const [deletingSelected, setDeletingSelected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const collapsedGroups = useCollapsedGroups('workspace-proxies-collapsed-groups');
    const [search, setSearch] = useState('');
    const [scope, setScope] = useState<string | null>(null);

    const groups = useMemo(
        () => Array.from(new Set(items.map(item => item.group).filter(Boolean) as string[])).sort(),
        [items],
    );
    const filteredItems = useMemo(() => {
        const query = search.trim().toLowerCase();

        return items.filter(item => {
            if (!matchesOwnershipScope(item, scope)) return false;
            if (!query) return true;

            return [
                item.label,
                item.host,
                String(item.port),
                item.scheme,
                item.country_code,
                item.country_code ? getCountryName(item.country_code) : null,
                item.group,
                item.owner?.name,
                item.team?.name,
            ].some(value => value?.toLowerCase().includes(query));
        });
    }, [items, scope, search]);
    const groupedItems = useMemo(() => groupHierarchicalItems(
        [...filteredItems].sort((first, second) => (
            (first.group ?? '\uffff').localeCompare(second.group ?? '\uffff')
            || first.label.localeCompare(second.label)
        )),
        item => item.group,
    ), [filteredItems]);
    const selectableIds = readOnly
        ? []
        : filteredItems.filter(item => !item.is_readonly).map(item => item.id);
    const allVisibleSelected = selectableIds.length > 0
        && selectableIds.every(id => selectedIds.has(id));

    useEffect(() => {
        const availableIds = new Set(items.map(item => item.id));
        setSelectedIds(current => {
            const next = new Set([...current].filter(id => availableIds.has(id)));
            return next.size === current.size ? current : next;
        });
    }, [items]);

    const openCreate = () => {
        setEditing(null);
        setError(null);
        setOpen(true);
    };

    const openEdit = (proxy: WorkspaceProxy) => {
        setEditing(proxy);
        setError(null);
        setOpen(true);
    };

    const handleSaved = (saved: WorkspaceProxy) => {
        setItems(current => (
            editing
                ? current.map(item => item.id === saved.id ? saved : item)
                : [...current, saved]
        ));
        setOpen(false);
    };

    const remove = async (proxy: WorkspaceProxy) => {
        if (!window.confirm(`Delete proxy "${proxy.label}"?`)) return;
        setBusyId(proxy.id);
        setError(null);
        try {
            await requestJson(`/workspace/proxies/${proxy.id}`, { method: 'DELETE' });
            setItems(current => current.filter(item => item.id !== proxy.id));
            setSelectedIds(current => {
                const next = new Set(current);
                next.delete(proxy.id);
                return next;
            });
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Unable to delete this proxy.');
        } finally {
            setBusyId(null);
        }
    };

    const toggleSelected = (proxyId: number) => {
        setSelectedIds(current => {
            const next = new Set(current);
            if (next.has(proxyId)) next.delete(proxyId);
            else next.add(proxyId);
            return next;
        });
    };

    const toggleAllVisible = () => {
        setSelectedIds(current => {
            const next = new Set(current);
            selectableIds.forEach(id => {
                if (allVisibleSelected) next.delete(id);
                else next.add(id);
            });
            return next;
        });
    };

    const removeSelected = async () => {
        const selected = items.filter(item => selectedIds.has(item.id));
        if (
            selected.length === 0
            || !window.confirm(`Delete ${selected.length} selected ${selected.length === 1 ? 'proxy' : 'proxies'}?`)
        ) return;

        setDeletingSelected(true);
        setError(null);
        const deletedIds: number[] = [];
        try {
            for (const item of selected) {
                await requestJson(`/workspace/proxies/${item.id}`, { method: 'DELETE' });
                deletedIds.push(item.id);
            }
            setSelectedIds(new Set());
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Unable to delete the selected proxies.');
        } finally {
            if (deletedIds.length > 0) {
                const deleted = new Set(deletedIds);
                setItems(current => current.filter(item => !deleted.has(item.id)));
                setSelectedIds(current => new Set([...current].filter(id => !deleted.has(id))));
            }
            setDeletingSelected(false);
        }
    };

    return (
        <S.Rows>
            <S.Card>
                <S.CardHeader>
                    <S.CardTitle>
                        <Icon icon="lucide:network" width={15} height={15} />
                        Proxy servers
                    </S.CardTitle>
                    {!readOnly && (
                        <S.HeaderActions>
                            {selectedIds.size > 0 && (
                                <Button
                                    size="sm"
                                    variant="danger"
                                    loading={deletingSelected}
                                    onClick={() => { void removeSelected(); }}
                                >
                                    <Icon icon="lucide:trash-2" width={14} />
                                    Delete ({selectedIds.size})
                                </Button>
                            )}
                            <Button size="sm" disabled={deletingSelected} onClick={openCreate}>
                                <Icon icon="lucide:plus" width={14} />
                                <S.AddButtonLabel>Add proxy</S.AddButtonLabel>
                            </Button>
                        </S.HeaderActions>
                    )}
                </S.CardHeader>
                <S.SectionHint>
                    Configure and organize the proxy servers available to flows in this workspace.
                </S.SectionHint>
                <LocalTableFilterToolbar
                    search={search}
                    scope={scope}
                    teams={teams}
                    searchPlaceholder="Search proxies..."
                    personalScopeLabel="Personal proxies"
                    onSearchChange={setSearch}
                    onScopeChange={setScope}
                />
                {selectableIds.length > 0 && (
                    <S.ProxySelectionBar>
                        <SelectAllVisible
                            allSelected={allVisibleSelected}
                            itemLabel="proxies"
                            onToggle={toggleAllVisible}
                        />
                    </S.ProxySelectionBar>
                )}
                {error && !open && <S.Error>{error}</S.Error>}
                {filteredItems.length === 0 ? (
                    <S.EmptyState>
                        {items.length === 0
                            ? 'No proxy servers configured.'
                            : 'No proxy servers match these filters.'}
                    </S.EmptyState>
                ) : (
                    <S.TableWrapper $hasSelection={selectableIds.length > 0}>
                        <S.Table>
                            <thead>
                                <tr>
                                    <th>Proxy</th>
                                    <th>Endpoint</th>
                                    <th>Protocol</th>
                                    <th>Authentication</th>
                                    <th>Visibility</th>
                                    <th>Owner</th>
                                    <th aria-label="Actions" />
                                </tr>
                            </thead>
                            <tbody>
                                {groupedItems.map(section => {
                                    const lastHeader = section.headers[section.headers.length - 1];
                                    const itemIndent = lastHeader ? (lastHeader.depth + 1) * 16 : 0;
                                    const hideItems = section.group
                                        ? collapsedGroups.isGroupHidden(section.group)
                                        : false;
                                    const visibleHeaders = section.headers.filter(header => {
                                        const parentKey = header.key.split('/').slice(0, -1).join('/');
                                        return !parentKey || !collapsedGroups.isGroupHidden(parentKey);
                                    });
                                    if (hideItems && visibleHeaders.length === 0) return null;

                                    return (
                                        <Fragment key={section.group ?? 'ungrouped'}>
                                        {visibleHeaders.map(header => (
                                            <S.GroupRow key={header.key}>
                                                <td colSpan={7}>
                                                    <TableCellContent>
                                                        <S.GroupButton
                                                            type="button"
                                                            $depth={header.depth}
                                                            aria-expanded={!collapsedGroups.collapsedGroups.has(header.key)}
                                                            onClick={() => collapsedGroups.toggleGroup(header.key)}
                                                        >
                                                            <Icon
                                                                icon={collapsedGroups.collapsedGroups.has(header.key)
                                                                    ? 'lucide:chevron-right'
                                                                    : 'lucide:chevron-down'}
                                                                width={13}
                                                            />
                                                            <Icon icon="lucide:folder" width={13} />
                                                            {header.label}
                                                            <S.GroupCount>{header.count}</S.GroupCount>
                                                        </S.GroupButton>
                                                    </TableCellContent>
                                                </td>
                                            </S.GroupRow>
                                        ))}
                                        {!hideItems && section.items.map(proxy => (
                                            <S.Row key={proxy.id} $indent={itemIndent}>
                                                <td>
                                                    <TableCellContent>
                                                        <S.ProxyIdentity>
                                                            {!readOnly && !proxy.is_readonly ? (
                                                                <AvatarSelectionToggle
                                                                    selected={selectedIds.has(proxy.id)}
                                                                    onChange={() => toggleSelected(proxy.id)}
                                                                    label={`${selectedIds.has(proxy.id) ? 'Deselect' : 'Select'} ${proxy.label}`}
                                                                    size={24}
                                                                >
                                                                    <S.CountryAvatar
                                                                        title={proxy.country_code
                                                                            ? getCountryName(proxy.country_code) || proxy.country_code
                                                                            : 'Country not set'}
                                                                    >
                                                                        {proxy.country_code ? countryFlag(proxy.country_code) : '🌐'}
                                                                    </S.CountryAvatar>
                                                                </AvatarSelectionToggle>
                                                            ) : (
                                                                <S.CountryAvatar
                                                                    title={proxy.country_code
                                                                        ? getCountryName(proxy.country_code) || proxy.country_code
                                                                        : 'Country not set'}
                                                                >
                                                                    {proxy.country_code ? countryFlag(proxy.country_code) : '🌐'}
                                                                </S.CountryAvatar>
                                                            )}
                                                            <S.ProxyName>{proxy.label}</S.ProxyName>
                                                            {proxy.is_readonly && (
                                                                <S.ManagedBadge title="Configured by the server environment">
                                                                    <Icon icon="lucide:lock-keyhole" width={10} />
                                                                    Managed
                                                                </S.ManagedBadge>
                                                            )}
                                                        </S.ProxyIdentity>
                                                    </TableCellContent>
                                                </td>
                                                <td><TableCellContent><S.Endpoint>{endpoint(proxy)}</S.Endpoint></TableCellContent></td>
                                                <td>
                                                    <TableCellContent>
                                                        <S.InlineCell>
                                                            <Icon icon="lucide:globe-2" width={13} />
                                                            {proxy.scheme.toUpperCase()}
                                                        </S.InlineCell>
                                                    </TableCellContent>
                                                </td>
                                                <td>
                                                    <TableCellContent>
                                                        {proxy.has_authentication
                                                            ? (
                                                                <S.InlineCell>
                                                                    <Icon icon="lucide:key-round" width={13} />
                                                                    Credentials
                                                                </S.InlineCell>
                                                            )
                                                            : <S.Muted>None</S.Muted>}
                                                    </TableCellContent>
                                                </td>
                                                <td>
                                                    <TableCellContent>
                                                        <S.ScopeBadge $scope={proxy.visibility}>
                                                            <Icon icon={visibilityIcon(proxy)} width={10} />
                                                            {visibilityLabel(proxy)}
                                                        </S.ScopeBadge>
                                                    </TableCellContent>
                                                </td>
                                                <td>
                                                    <TableCellContent>
                                                        <S.OwnerName>{proxy.is_readonly ? 'Managed' : (proxy.owner?.name || '-')}</S.OwnerName>
                                                    </TableCellContent>
                                                </td>
                                                <td>
                                                    <TableCellContent $align="end">
                                                        {!readOnly && !proxy.is_readonly && (
                                                            <ProxyActions
                                                                busy={deletingSelected || busyId === proxy.id}
                                                                onEdit={() => openEdit(proxy)}
                                                                onDelete={() => { void remove(proxy); }}
                                                            />
                                                        )}
                                                    </TableCellContent>
                                                </td>
                                            </S.Row>
                                        ))}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </S.Table>
                    </S.TableWrapper>
                )}
            </S.Card>

            <WorkspaceProxyFormModal
                isOpen={open}
                proxy={editing}
                teams={teams}
                groups={groups}
                onClose={() => setOpen(false)}
                onSaved={handleSaved}
            />
        </S.Rows>
    );
}
