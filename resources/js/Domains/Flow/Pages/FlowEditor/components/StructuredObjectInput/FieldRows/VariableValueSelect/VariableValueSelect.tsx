import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { useClickOutside } from '@/Shared/Hooks/useClickOutside';
import { getVisibilityMeta } from '@/Shared/Utils/visibility';
import QuickCreateVariableModal from '@/Domains/Variable/Pages/VariableFormModal/QuickCreateVariableModal';
import { MCP_CREDENTIALS_UI } from '@/Domains/Variable/types';
import { useQuickRequirementCreation } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/contexts/QuickRequirementCreationContext';
import {
    getVariableSuggestionIcon,
    type VariableSuggestion,
} from '@/Domains/Flow/Pages/FlowEditor/utils/variableSuggestions';
import type { VariableSuggestionsState } from '../hooks/useVariableSuggestions';
import * as S from './styled';

function variableTypeLabel(type: string): string {
    return type === 'mcp_credentials' ? MCP_CREDENTIALS_UI.label : type;
}

interface VariableValueSelectProps {
    value: string;
    readOnly: boolean;
    variableSuggestions: VariableSuggestionsState;
    onOpen?: () => void;
    createLabel?: string;
    onCreate?: () => void;
    onChange: (value: string) => void;
}

function VariableTypeIcon({
    variable,
    size = 13,
}: {
    variable: VariableSuggestion | undefined;
    size?: number;
}) {
    if (!variable) return null;
    const icon = getVariableSuggestionIcon(variable);
    return (
        <Icon
            icon={icon.icon}
            width={size}
            height={size}
            style={{ color: icon.color }}
        />
    );
}

export default function VariableValueSelect({
    value,
    readOnly,
    variableSuggestions,
    onOpen,
    createLabel = 'Add variable',
    onCreate,
    onChange,
}: VariableValueSelectProps) {
    const quickRequirementCreation = useQuickRequirementCreation();
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const searchRef = useRef<HTMLInputElement | null>(null);
    const [open, setOpen] = useState(false);
    const [quickCreateOpen, setQuickCreateOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [dropdownRect, setDropdownRect] = useState<{
        top: number;
        left: number;
        width: number;
        maxHeight: number;
        placement: 'above' | 'below';
    } | null>(null);
    const {
        suggestions,
        loading,
        loadFailed,
        refresh: refreshSuggestions,
    } = variableSuggestions;
    // Opening refreshes the list in the background; only the first load has nothing to show.
    const initialLoading = loading && suggestions.length === 0;
    const variableById = useMemo(
        () => new Map(suggestions.map(variable => [String(variable.id), variable])),
        [suggestions],
    );
    const selectedVariable = variableById.get(value);
    const filteredSuggestions = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return suggestions;
        return suggestions.filter(variable => (
            variable.key.toLowerCase().includes(query)
            || variable.type.toLowerCase().includes(query)
            || variable.scope?.toLowerCase().includes(query)
        ));
    }, [search, suggestions]);

    const refresh = (focusSearch = false) => {
        void refreshSuggestions()
            .catch(() => undefined)
            .finally(() => {
                if (focusSearch) {
                    requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
                }
            });
    };

    useEffect(() => {
        if (open) searchRef.current?.focus({ preventScroll: true });
    }, [open]);

    const close = () => {
        setOpen(false);
        setDropdownRect(null);
        setSearch('');
    };

    useClickOutside({
        refs: [wrapperRef, panelRef],
        onOutside: close,
        enabled: open,
        eventType: 'pointerdown',
        capture: true,
    });

    const updateDropdownPosition = (trigger: HTMLElement) => {
        const rect = trigger.getBoundingClientRect();
        const width = Math.min(Math.max(rect.width, 320), window.innerWidth - 16);
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
        const spaceBelow = window.innerHeight - rect.bottom - 8;
        const spaceAbove = rect.top - 8;
        const placement = spaceBelow < 260 && spaceAbove > spaceBelow ? 'above' : 'below';
        const availableHeight = placement === 'above' ? spaceAbove : spaceBelow;
        setDropdownRect({
            top: placement === 'above' ? rect.top - 4 : rect.bottom + 4,
            left,
            width,
            maxHeight: Math.min(260, Math.max(140, availableHeight - 4)),
            placement,
        });
    };

    useEffect(() => {
        if (!open) return;
        const updatePosition = () => {
            if (triggerRef.current) updateDropdownPosition(triggerRef.current);
        };

        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [open]);

    const toggle = (trigger: HTMLElement) => {
        if (open) {
            close();
            return;
        }

        onOpen?.();
        setOpen(true);
        updateDropdownPosition(trigger);
        setSearch('');
        refresh();
    };

    const selectVariable = (nextValue: string) => {
        onChange(nextValue);
        close();
    };

    const handleVariableCreated = (variable: VariableSuggestion) => {
        void refreshSuggestions()
            .then(() => {
                onChange(String(variable.id));
                setQuickCreateOpen(false);
            })
            .catch(() => undefined);
    };

    return (
        <S.Wrapper ref={wrapperRef}>
            <S.Trigger
                ref={triggerRef}
                type="button"
                disabled={readOnly}
                $open={open}
                $hasValue={Boolean(selectedVariable)}
                $variableType={selectedVariable?.type}
                onClick={event => toggle(event.currentTarget)}
            >
                {initialLoading ? (
                    <S.IconSlot $loading>
                        <Icon icon="lucide:loader-circle" width={15} height={15} />
                    </S.IconSlot>
                ) : selectedVariable && (
                    <S.IconSlot>
                        <VariableTypeIcon variable={selectedVariable} size={15} />
                    </S.IconSlot>
                )}
                <S.ValueLabel>
                    {initialLoading
                        ? 'Loading...'
                        : selectedVariable?.key || 'Select variable...'}
                </S.ValueLabel>
                <Icon icon="lucide:chevron-down" width={13} height={13} />
            </S.Trigger>
            {open && dropdownRect && !readOnly && createPortal(
                <S.Panel
                    ref={panelRef}
                    data-structured-input-variable-panel
                    $top={dropdownRect.top}
                    $left={dropdownRect.left}
                    $width={dropdownRect.width}
                    $maxHeight={dropdownRect.maxHeight}
                    $placement={dropdownRect.placement}
                    onKeyDown={event => {
                        if (event.key !== 'Escape') return;
                        event.preventDefault();
                        event.stopPropagation();
                        close();
                        triggerRef.current?.focus({ preventScroll: true });
                    }}
                >
                    <S.SearchRow>
                        <S.Search
                            ref={searchRef}
                            value={search}
                            placeholder="Search variable..."
                            onChange={event => setSearch(event.target.value)}
                            onKeyDown={event => {
                                if (event.key === 'Escape') {
                                    event.preventDefault();
                                    close();
                                } else if (event.key === 'Enter' && filteredSuggestions[0]) {
                                    event.preventDefault();
                                    selectVariable(String(filteredSuggestions[0].id));
                                }
                            }}
                        />
                        <S.RefreshButton
                            type="button"
                            title="Refresh variables"
                            aria-label="Refresh variables"
                            disabled={loading}
                            $loading={loading}
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => refresh(true)}
                        >
                            <Icon icon="lucide:refresh-cw" width={13} height={13} />
                        </S.RefreshButton>
                    </S.SearchRow>
                    <S.ActionRow>
                        <S.CreateButton
                            type="button"
                            onClick={() => {
                                close();
                                if (onCreate) onCreate();
                                else setQuickCreateOpen(true);
                            }}
                        >
                            <Icon icon="lucide:plus" width={13} height={13} />
                            {createLabel}
                        </S.CreateButton>
                        {value && (
                            <S.ClearButton
                                type="button"
                                title="Clear selection"
                                aria-label="Clear selection"
                                onMouseDown={event => event.preventDefault()}
                                onClick={() => selectVariable('')}
                            >
                                <Icon icon="lucide:trash-2" width={13} height={13} />
                            </S.ClearButton>
                        )}
                    </S.ActionRow>
                    <S.List>
                        {initialLoading ? (
                            <S.Empty>Loading variables...</S.Empty>
                        ) : loadFailed ? (
                            <S.Empty>Unable to load variables.</S.Empty>
                        ) : filteredSuggestions.length > 0 ? filteredSuggestions.map(variable => {
                            const visibility = getVisibilityMeta(variable.scope, variable.team_name);
                            return (
                                <S.ItemRow
                                    key={variable.id}
                                    $active={String(variable.id) === value}
                                    $editable={Boolean(variable.can_manage)}
                                >
                                    <S.Item
                                        type="button"
                                        onClick={() => selectVariable(String(variable.id))}
                                    >
                                        <S.ItemMain>
                                            <VariableTypeIcon variable={variable} />
                                            <strong>{variable.key}</strong>
                                        </S.ItemMain>
                                        <S.ItemDetail data-item-detail>
                                            {visibility && (
                                                <Icon icon={visibility.icon} width={11} height={11} />
                                            )}
                                            {visibility
                                                ? `${visibility.label} - ${variableTypeLabel(variable.type)}`
                                                : variableTypeLabel(variable.type)}
                                        </S.ItemDetail>
                                    </S.Item>
                                    {variable.can_manage && (
                                        <S.ItemEdit
                                            type="button"
                                            title={`Edit ${variable.key}`}
                                            aria-label={`Edit ${variable.key}`}
                                            onClick={() => {
                                                close();
                                                void quickRequirementCreation.edit('variable', variable.id)
                                                    .then(() => refreshSuggestions())
                                                    .catch(() => undefined);
                                            }}
                                        >
                                            <Icon icon="lucide:pencil" width={13} height={13} />
                                        </S.ItemEdit>
                                    )}
                                </S.ItemRow>
                            );
                        }) : (
                            <S.Empty>No variable found.</S.Empty>
                        )}
                    </S.List>
                </S.Panel>,
                document.body,
            )}
            {!onCreate && (
                <QuickCreateVariableModal
                    isOpen={quickCreateOpen}
                    onClose={() => setQuickCreateOpen(false)}
                    onCreated={handleVariableCreated}
                />
            )}
        </S.Wrapper>
    );
}
