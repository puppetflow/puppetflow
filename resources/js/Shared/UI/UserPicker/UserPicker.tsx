import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { useSearchablePopover } from '@/Shared/Hooks/useSearchablePopover';
import { useUserPickerOptions, type PickerUser } from './hooks/useUserPickerOptions';
import * as S from './styled';

export type { PickerUser } from './hooks/useUserPickerOptions';

interface UserPickerProps {
    label?: string;
    value: Id | null;
    onChange: (userId: Id | null) => void;
    onSelect?: (user: PickerUser | null) => void;
    placeholder?: string;
    disabled?: boolean;
    clearable?: boolean;
    fetchUrl?: string;
    portal?: boolean;
}

export default function UserPicker({ label, value, onChange, onSelect, placeholder = 'Select a user…', disabled, clearable = true, fetchUrl = '/workspace/users-search', portal = false }: UserPickerProps) {
    const [open, setOpen] = useState(false);
    const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const {
        search,
        setSearch,
        users,
        loading,
        refresh,
        selectedUser,
        setSelectedUser,
    } = useUserPickerOptions(open, value, fetchUrl);

    useSearchablePopover({
        open,
        onDismiss: () => setOpen(false),
        reset: () => setSearch(''),
        focusRef: searchRef,
        containerRefs: [wrapperRef, dropdownRef],
        eventType: 'mousedown',
    });

    useEffect(() => {
        if (disabled) setOpen(false);
    }, [disabled]);

    useEffect(() => {
        if (!open || !portal) return;

        const updateDropdownRect = () => {
            setDropdownRect(wrapperRef.current?.getBoundingClientRect() ?? null);
        };

        updateDropdownRect();
        window.addEventListener('resize', updateDropdownRect);
        window.addEventListener('scroll', updateDropdownRect, true);

        return () => {
            window.removeEventListener('resize', updateDropdownRect);
            window.removeEventListener('scroll', updateDropdownRect, true);
        };
    }, [open, portal]);

    const handleSelect = (user: PickerUser) => {
        setSelectedUser(user);
        onChange(user.id);
        onSelect?.(user);
        setOpen(false);
        setSearch('');
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedUser(null);
        onChange(null);
        onSelect?.(null);
    };

    const dropdown = (
        <S.Dropdown
            ref={dropdownRef}
            $portaled={portal}
            style={portal ? {
                top: (dropdownRect?.bottom ?? 0) + 4,
                left: dropdownRect?.left ?? 0,
                minWidth: dropdownRect?.width,
            } : undefined}
        >
            <S.DropdownHeader>
                <S.Search
                    ref={searchRef}
                    value={search}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                    placeholder="Search by name or email…"
                />
                <S.RefreshButton
                    type="button"
                    title="Refresh users"
                    aria-label="Refresh users"
                    disabled={loading}
                    $loading={loading}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => void refresh()}
                >
                    <Icon icon="lucide:refresh-cw" width={13} height={13} />
                </S.RefreshButton>
            </S.DropdownHeader>
            {loading ? (
                <S.Loader>
                    <Icon icon="lucide:loader-circle" width={16} height={16} />
                </S.Loader>
            ) : (
                <S.List>
                    {users.length === 0 ? (
                        <S.Empty>No users found</S.Empty>
                    ) : users.map(u => (
                        <S.Item
                            key={u.id}
                            $active={u.id === value}
                            onClick={() => handleSelect(u)}
                        >
                            <Icon icon="lucide:user" width={14} />
                            {u.name}
                            <S.ItemEmail>{u.email}</S.ItemEmail>
                        </S.Item>
                    ))}
                </S.List>
            )}
        </S.Dropdown>
    );

    return (
        <S.Wrapper ref={wrapperRef}>
            {label && <S.Label>{label}</S.Label>}
            <S.Trigger
                $open={open}
                $disabled={disabled}
            >
                <S.TriggerButton
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                        if (!open && portal) {
                            setDropdownRect(wrapperRef.current?.getBoundingClientRect() ?? null);
                        }
                        setOpen(current => !current);
                    }}
                >
                    <S.TriggerContent>
                        {selectedUser ? (
                            <>
                                <Icon icon="lucide:user" width={14} />
                                {selectedUser.name}
                            </>
                        ) : (
                            <S.Placeholder>{placeholder}</S.Placeholder>
                        )}
                    </S.TriggerContent>
                </S.TriggerButton>
                {clearable && selectedUser && (
                    <S.ClearBtn type="button" disabled={disabled} onClick={handleClear} title="Clear">
                        <Icon icon="lucide:x" width={14} />
                    </S.ClearBtn>
                )}
                <Icon icon="lucide:chevron-down" width={14} />
            </S.Trigger>
            {open && (!portal || dropdownRect) && (portal ? createPortal(
                dropdown,
                document.body,
            ) : dropdown)}
        </S.Wrapper>
    );
}
