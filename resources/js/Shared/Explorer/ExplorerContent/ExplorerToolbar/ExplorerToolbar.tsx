import { useEffect, useState } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { router } from '@inertiajs/react';
import Button from '@/Shared/UI/Button/Button';
import CustomSelect from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodeConfigModal/components/CustomSelect/CustomSelect';
import { useExplorer, useExplorerView } from '../../ExplorerContext';
import type { ExplorerItem, ExplorerToolbarFilter } from '../../types';
import type { ExplorerSelection } from '../useExplorerSelection';
import * as S from './styled';

interface Props<TItem extends ExplorerItem> {
    selection: ExplorerSelection<TItem>;
    filters?: ExplorerToolbarFilter[];
}

export default function ExplorerToolbar<TItem extends ExplorerItem>({
    selection,
    filters: toolbarFilters = [],
}: Props<TItem>) {
    const { config: { basePath, labels }, data: { filters } } = useExplorer();
    const { isWorkspaceView, viewMode } = useExplorerView();
    const {
        selectionActive,
        selectedCount,
        selectableVisibleCount,
        allVisibleSelected,
        deletingSelected,
        clearSelection: onClearSelection,
        openDeleteModal: onDeleteSelected,
        toggleSelectAllVisible: onToggleSelectAllVisible,
    } = selection;
    const [search, setSearch] = useState(filters.search || '');
    const [searchEverywhere, setSearchEverywhere] = useState(filters.search_everywhere === '1');
    const [refreshingFilter, setRefreshingFilter] = useState<string | null>(null);
    const hasActiveSearch = Boolean(filters.search);
    const hasActiveToolbarFilter = toolbarFilters.some(filter => filter.value !== '');
    const hasActiveFilters = hasActiveSearch || hasActiveToolbarFilter;
    const hasEverywhereSearch = filters.search_everywhere === '1';

    useEffect(() => {
        setSearchEverywhere(filters.search_everywhere === '1');
    }, [filters.search_everywhere]);

    const getLocationData = (includeToolbarFilters = true): Record<string, Id | string | null> => {
        const data: Record<string, Id | string | null> = {
            folder_id: filters.folder_id,
            owner_id: filters.owner_id,
        };
        if (isWorkspaceView) data.view = 'workspace';
        if (isWorkspaceView && filters.team_id) data.team_id = filters.team_id;
        if (includeToolbarFilters) {
            Object.assign(data, filters.persistent_filters);
            toolbarFilters.forEach(filter => {
                if (filter.value !== '') data[filter.key] = filter.value;
            });
        }
        return data;
    };

    const handleSearch = (event: React.FormEvent) => {
        event.preventDefault();
        const data: Record<string, Id | string | null> = { ...getLocationData(), search };
        if (searchEverywhere && search.trim()) data.search_everywhere = '1';
        router.visit(basePath, { data, preserveState: true });
    };

    const resetSearch = () => {
        setSearch('');
        setSearchEverywhere(false);
        router.visit(basePath, { data: getLocationData(false), preserveState: true });
    };

    const toggleSearchEverywhere = () => {
        const next = !searchEverywhere;
        setSearchEverywhere(next);
        if (!search.trim()) return;

        const data: Record<string, Id | string | null> = { ...getLocationData(), search };
        if (next) data.search_everywhere = '1';
        router.visit(basePath, { data, preserveState: true });
    };

    const toggleViewMode = () => {
        const next = viewMode === 'grid' ? 'list' : 'grid';
        router.patch('/profile/preference', { key: 'explorer_view_mode', value: next }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    return (
        <>
            <S.Toolbar>
                <S.ToolbarLeft>
                    <S.SearchForm onSubmit={handleSearch}>
                        <S.SearchWrapper>
                            <Icon icon="lucide:search" />
                            <S.SearchInput
                                value={search}
                                onChange={event => setSearch(event.target.value)}
                                placeholder={labels.searchPlaceholder}
                            />
                        </S.SearchWrapper>
                        {toolbarFilters.map(filter => (
                            <S.ToolbarFilter key={filter.key} title={filter.label}>
                                <CustomSelect
                                    value={filter.value}
                                    options={filter.options}
                                    ariaLabel={filter.label}
                                    compact
                                    compactHeight={36}
                                    showOptionValue={false}
                                    searchThreshold={0}
                                    dropdownMinWidth={180}
                                    refreshing={refreshingFilter === filter.key}
                                    onRefresh={() => new Promise<void>(resolve => {
                                        setRefreshingFilter(filter.key);
                                        router.reload({
                                            onFinish: () => {
                                                setRefreshingFilter(null);
                                                resolve();
                                            },
                                        });
                                    })}
                                    onChange={value => {
                                        const data: Record<string, Id | string | null> = {
                                            ...getLocationData(),
                                            search,
                                            [filter.key]: value || null,
                                        };
                                        if (searchEverywhere && search.trim()) data.search_everywhere = '1';
                                        router.visit(basePath, { data, preserveState: true });
                                    }}
                                />
                            </S.ToolbarFilter>
                        ))}
                        <S.SearchScopeSwitch
                            type="button"
                            $active={searchEverywhere}
                            onClick={toggleSearchEverywhere}
                            title={searchEverywhere ? 'Search across all folders' : 'Search only in the current folder'}
                        >
                            <S.SearchScopeOption $active={!searchEverywhere}>Folder</S.SearchScopeOption>
                            <S.SearchScopeKnob>
                                <Icon icon={searchEverywhere ? 'lucide:globe-2' : 'lucide:folder'} width={12} height={12} />
                            </S.SearchScopeKnob>
                            <S.SearchScopeOption $active={searchEverywhere}>Everywhere</S.SearchScopeOption>
                        </S.SearchScopeSwitch>
                    </S.SearchForm>
                </S.ToolbarLeft>
                <S.ToolbarRight>
                    {selectionActive && (
                        <>
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={deletingSelected}
                                onClick={onClearSelection}
                            >
                                <Icon icon="lucide:x" width={14} />
                                <S.SelectionButtonLabel>Clear</S.SelectionButtonLabel>
                            </Button>
                            <Button
                                variant="danger"
                                size="sm"
                                loading={deletingSelected}
                                onClick={onDeleteSelected}
                            >
                                <Icon icon="lucide:trash-2" width={14} />
                                <S.SelectionButtonLabel>Delete ({selectedCount})</S.SelectionButtonLabel>
                            </Button>
                        </>
                    )}
                    {selectableVisibleCount > 0 && (
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={deletingSelected}
                            onClick={onToggleSelectAllVisible}
                        >
                            <Icon icon="lucide:check-square" width={14} />
                            <S.SelectionButtonLabel>
                                {allVisibleSelected ? 'Uncheck all' : 'Check all'}
                            </S.SelectionButtonLabel>
                        </Button>
                    )}
                    <S.ViewToggle $active={viewMode === 'grid'} onClick={toggleViewMode} title="Grid view">
                        <Icon icon="lucide:layout-grid" />
                    </S.ViewToggle>
                    <S.ViewToggle $active={viewMode === 'list'} onClick={toggleViewMode} title="List view">
                        <Icon icon="lucide:list" />
                    </S.ViewToggle>
                </S.ToolbarRight>
            </S.Toolbar>

            {hasActiveFilters && (
                <S.FilterResetBanner type="button" onClick={resetSearch}>
                    <Icon icon="lucide:filter-x" width={14} height={14} />
                    {hasEverywhereSearch
                        ? 'Searching everywhere. Click to reset all filters.'
                        : 'Filtered mode active. Click to reset all filters.'}
                </S.FilterResetBanner>
            )}
        </>
    );
}
