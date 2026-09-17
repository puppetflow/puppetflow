import {
    Fragment,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type FocusEvent,
    type KeyboardEvent,
    type MouseEvent,
    type ReactNode,
} from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { useActiveOptionScroll } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/hooks/useActiveOptionScroll';
import { useAnchoredDropdownPosition } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/hooks/useAnchoredDropdownPosition';
import * as S from './styled';

export interface CustomSelectOption<T extends Id = string> {
    value: T;
    label: string;
    editable?: boolean;
    detail?: string;
    detailBadge?: string;
    detailIcon?: string;
    icon?: string;
    /** Image rendered instead of the icon (thumbnails). */
    iconUrl?: string | null;
    iconText?: string;
    iconColor?: string;
    group?: string;
    groupLabel?: string;
    groupIcon?: string;
    dividerBefore?: boolean;
}

export interface CustomSelectAction<T extends Id = string> {
    label: ReactNode;
    onAction: () => Promise<T | null>;
}

interface CustomSelectProps<T extends Id> {
    value: T;
    options: CustomSelectOption<T>[];
    placeholder?: string;
    ariaLabel?: string;
    disabled?: boolean;
    compact?: boolean;
    compactHeight?: number;
    invalid?: boolean;
    showOptionValue?: boolean;
    searchThreshold?: number;
    headerSlot?: ReactNode;
    footerHint?: ReactNode;
    actionSlot?: CustomSelectAction<T>;
    browseAction?: () => Promise<T | null>;
    onRefresh?: () => void | Promise<void>;
    loading?: boolean;
    refreshing?: boolean;
    dropdownMinWidth?: number;
    onClear?: () => void;
    onEditOption?: (option: CustomSelectOption<T>) => void | Promise<void>;
    onChange: (value: T) => void;
}

const SELECT_DROPDOWN_MAX_HEIGHT = 260;
const SELECT_DROPDOWN_MIN_WIDTH = 240;
const SELECT_DROPDOWN_GAP = 5;

function OptionIcon({ option }: { option: Pick<CustomSelectOption<Id>, 'icon' | 'iconUrl' | 'iconText' | 'iconColor'> }) {
    if (!option.iconUrl && !option.icon && !option.iconText) return null;

    return (
        <S.SelectIconSlot>
            {option.iconUrl
                ? <S.SelectImageIcon src={option.iconUrl} alt="" loading="lazy" />
                : option.icon
                    ? <Icon icon={option.icon} width={15} height={15} style={{ color: option.iconColor }} />
                    : <S.SelectTextIcon aria-hidden>{option.iconText}</S.SelectTextIcon>}
        </S.SelectIconSlot>
    );
}

export default function CustomSelect<T extends Id>({
    value,
    options,
    placeholder = 'Select a value...',
    ariaLabel,
    disabled,
    compact,
    compactHeight,
    invalid,
    showOptionValue = true,
    searchThreshold = 0,
    headerSlot,
    footerHint,
    actionSlot,
    browseAction,
    onRefresh,
    loading,
    refreshing,
    dropdownMinWidth,
    onClear,
    onEditOption,
    onChange,
}: CustomSelectProps<T>) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [actionLoading, setActionLoading] = useState(false);
    const [browseLoading, setBrowseLoading] = useState(false);
    const actionRunningRef = useRef(false);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const { dropdownRect, updateDropdownPosition } = useAnchoredDropdownPosition(
        triggerRef,
        open,
        {
            maxHeight: SELECT_DROPDOWN_MAX_HEIGHT,
            gap: SELECT_DROPDOWN_GAP,
            clampLeft: true,
            minWidth: dropdownMinWidth ?? SELECT_DROPDOWN_MIN_WIDTH,
            viewportPadding: 12,
        },
    );
    const selectedOption = options.find(option => option.value === value);
    const showSearch = options.length >= searchThreshold;
    const refreshInActionRow = Boolean(actionSlot && onRefresh && !showSearch && !headerSlot);
    const clearInHeader = Boolean(onClear && value && !actionSlot);
    const filteredOptions = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return options;

        return options.filter(option => (
            `${option.label} ${option.value} ${option.detail ?? ''} ${option.groupLabel ?? option.group ?? ''}`
                .toLowerCase()
                .includes(normalizedQuery)
        ));
    }, [options, query]);
    useActiveOptionScroll({
        open,
        queryDependency: query,
        activeIndex,
        setActiveIndex,
        optionRefs,
    });

    const close = () => {
        setOpen(false);
        setQuery('');
    };

    const openSelect = () => {
        if (disabled || loading) return;

        updateDropdownPosition();
        setOpen(true);
        setActiveIndex(Math.max(0, filteredOptions.findIndex(option => option.value === value)));
        void onRefresh?.();
        if (showSearch) {
            window.requestAnimationFrame(() => searchInputRef.current?.focus());
        }
    };

    const selectOption = (option: CustomSelectOption<T> | undefined) => {
        if (!option) return;
        onChange(option.value);
        close();
    };

    const restoreDropdownFocus = () => {
        window.requestAnimationFrame(() => {
            if (showSearch) {
                searchInputRef.current?.focus();
            } else {
                triggerRef.current?.focus();
            }
        });
    };

    const handleAction = async () => {
        if (!actionSlot || actionRunningRef.current) return;

        actionRunningRef.current = true;
        setActionLoading(true);
        try {
            const createdValue = await actionSlot.onAction();
            if (createdValue) {
                onChange(createdValue);
                close();
                window.requestAnimationFrame(() => triggerRef.current?.focus());
                return;
            }

            restoreDropdownFocus();
        } finally {
            actionRunningRef.current = false;
            setActionLoading(false);
        }
    };

    const handleBrowse = async () => {
        if (!browseAction || browseLoading) return;
        close();
        setBrowseLoading(true);
        try {
            const pickedValue = await browseAction();
            if (pickedValue) onChange(pickedValue);
        } finally {
            setBrowseLoading(false);
            window.requestAnimationFrame(() => triggerRef.current?.focus());
        }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        if (disabled || loading) return;
        const fromSearchInput = event.target === searchInputRef.current;

        if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
            event.preventDefault();
            openSelect();
            return;
        }

        if (!open) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex(current => Math.min(current + 1, filteredOptions.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex(current => Math.max(current - 1, 0));
        } else if (event.key === 'Home' && !fromSearchInput) {
            event.preventDefault();
            setActiveIndex(0);
        } else if (event.key === 'End' && !fromSearchInput) {
            event.preventDefault();
            setActiveIndex(Math.max(0, filteredOptions.length - 1));
        } else if (event.key === 'Enter' || (event.key === ' ' && !fromSearchInput)) {
            event.preventDefault();
            selectOption(filteredOptions[activeIndex] ?? filteredOptions[0]);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            close();
        }
    };

    return (
        <S.SelectRoot
            $compact={compact}
            onBlurCapture={(event: FocusEvent<HTMLDivElement>) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                if (actionRunningRef.current) return;
                close();
            }}
        >
            <S.SelectTrigger
                type="button"
                ref={triggerRef}
                $open={open}
                $compact={compact}
                $compactHeight={compactHeight}
                $hasValue={Boolean(selectedOption)}
                $invalid={invalid}
                aria-label={ariaLabel}
                aria-invalid={invalid}
                aria-busy={loading}
                disabled={disabled}
                onKeyDown={handleKeyDown}
                onClick={() => {
                    if (disabled || loading) return;
                    if (open) {
                        close();
                        return;
                    }
                    openSelect();
                }}
            >
                <S.SelectValue>
                    {loading ? (
                        <>
                            <S.SelectLoadingIcon>
                                <Icon icon="lucide:loader-circle" width={15} height={15} />
                            </S.SelectLoadingIcon>
                            <S.SelectValueLabel>Loading...</S.SelectValueLabel>
                        </>
                    ) : selectedOption ? (
                        <OptionIcon option={selectedOption} />
                    ) : null}
                    {!loading && (
                        <S.SelectValueLabel>{selectedOption?.label ?? placeholder}</S.SelectValueLabel>
                    )}
                </S.SelectValue>
                <Icon icon="lucide:chevron-down" width={compact ? 12 : 14} height={compact ? 12 : 14} />
            </S.SelectTrigger>
            {open && !disabled && !actionLoading && dropdownRect && (
                <S.SelectDropdown
                    data-node-field-dropdown="true"
                    $compact={compact}
                    style={{
                        top: dropdownRect.top,
                        left: dropdownRect.left,
                        right: 'auto',
                        width: dropdownRect.width,
                        maxHeight: dropdownRect.maxHeight,
                        transform: dropdownRect.placement === 'above' ? 'translateY(-100%)' : undefined,
                    }}
                >
                    {(showSearch || headerSlot || clearInHeader || (onRefresh && !refreshInActionRow)) && (
                        <S.SelectDropdownHeader>
                            {showSearch && (
                                <S.SelectSearchInput
                                    ref={searchInputRef}
                                    value={query}
                                    placeholder="Search option..."
                                    onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
                                    onKeyDown={handleKeyDown}
                                />
                            )}
                            {headerSlot}
                            {onRefresh && (
                                <S.SelectHeaderButton
                                    type="button"
                                    title="Refresh options"
                                    aria-label="Refresh options"
                                    disabled={refreshing}
                                    $loading={refreshing}
                                    onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()}
                                    onClick={() => void onRefresh()}
                                >
                                    <Icon icon="lucide:refresh-cw" width={13} height={13} />
                                </S.SelectHeaderButton>
                            )}
                            {clearInHeader && (
                                <S.SelectHeaderButton
                                    type="button"
                                    title="Clear selection"
                                    aria-label="Clear selection"
                                    onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()}
                                    onClick={() => {
                                        onClear?.();
                                        close();
                                    }}
                                >
                                    <Icon icon="lucide:trash-2" width={13} height={13} />
                                </S.SelectHeaderButton>
                            )}
                        </S.SelectDropdownHeader>
                    )}
                    {(actionSlot || refreshInActionRow || (onClear && value && !clearInHeader)) && (
                        <S.SelectActionRow>
                            {actionSlot && (
                                <S.SelectAction
                                    type="button"
                                    $loading={actionLoading}
                                    disabled={actionLoading}
                                    onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()}
                                    onClick={() => void handleAction()}
                                >
                                    {actionLoading && <Icon icon="lucide:loader-circle" width={13} height={13} />}
                                    {actionSlot.label}
                                </S.SelectAction>
                            )}
                            {refreshInActionRow && (
                                <S.SelectHeaderButton
                                    type="button"
                                    title="Refresh options"
                                    aria-label="Refresh options"
                                    disabled={refreshing}
                                    $loading={refreshing}
                                    onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()}
                                    onClick={() => void onRefresh?.()}
                                >
                                    <Icon icon="lucide:refresh-cw" width={13} height={13} />
                                </S.SelectHeaderButton>
                            )}
                            {onClear && value && (
                                <S.SelectClearButton
                                    type="button"
                                    title="Clear selection"
                                    aria-label="Clear selection"
                                    onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()}
                                    onClick={() => {
                                        onClear();
                                        close();
                                    }}
                                >
                                    <Icon icon="lucide:trash-2" width={13} height={13} />
                                </S.SelectClearButton>
                            )}
                        </S.SelectActionRow>
                    )}
                    {browseAction && (
                        <S.SelectActionRow>
                            <S.SelectAction
                                type="button"
                                $loading={browseLoading}
                                disabled={browseLoading}
                                onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()}
                                onClick={() => void handleBrowse()}
                            >
                                <Icon icon={browseLoading ? 'lucide:loader-circle' : 'lucide:folder-search'} width={13} />
                                Browse library
                            </S.SelectAction>
                        </S.SelectActionRow>
                    )}
                    <S.SelectOptions>
                        {refreshing && options.length === 0 ? (
                            <S.SelectLoading>
                                <Icon icon="lucide:loader-circle" width={16} height={16} />
                            </S.SelectLoading>
                        ) : filteredOptions.length > 0 ? filteredOptions.map((option, optionIndex) => (
                            <Fragment key={option.value}>
                                {option.dividerBefore && optionIndex > 0 && (
                                    <S.SelectOptionDivider aria-hidden />
                                )}
                                {option.group && option.group !== filteredOptions[optionIndex - 1]?.group && (
                                    <S.SelectOptionGroup>
                                        {option.groupIcon && <Icon icon={option.groupIcon} width={13} height={13} />}
                                        {option.groupLabel ?? option.group}
                                    </S.SelectOptionGroup>
                                )}
                                <S.SelectOptionRow
                                    $active={optionIndex === activeIndex}
                                    $editable={Boolean(option.editable && onEditOption)}
                                    onMouseEnter={() => setActiveIndex(optionIndex)}
                                >
                                    <S.SelectOption
                                        ref={(element: HTMLButtonElement | null) => {
                                            optionRefs.current[optionIndex] = element;
                                        }}
                                        type="button"
                                        $selected={option.value === value}
                                        aria-selected={option.value === value}
                                        onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()}
                                        onClick={() => {
                                            selectOption(option);
                                        }}
                                    >
                                        <S.SelectOptionMain>
                                            <OptionIcon option={option} />
                                            <strong>{option.label}</strong>
                                        </S.SelectOptionMain>
                                        {option.detail ? (
                                            <S.SelectOptionDetail
                                                data-option-detail
                                                $inline={Boolean(option.detailBadge)}
                                            >
                                                {option.detailBadge && (
                                                    <S.SelectOptionBadge>{option.detailBadge}</S.SelectOptionBadge>
                                                )}
                                                {option.detailIcon && (
                                                    <Icon icon={option.detailIcon} width={11} height={11} />
                                                )}
                                                <S.SelectOptionDetailText>{option.detail}</S.SelectOptionDetailText>
                                            </S.SelectOptionDetail>
                                        ) : showOptionValue && option.value !== option.label ? (
                                            <S.SelectOptionDetail data-option-detail>{option.value}</S.SelectOptionDetail>
                                        ) : null}
                                        {option.value === value && (
                                            <S.SelectCheck>
                                                <Icon icon="lucide:check" width={13} height={13} />
                                            </S.SelectCheck>
                                        )}
                                    </S.SelectOption>
                                    {option.editable && onEditOption && (
                                        <S.SelectOptionEdit
                                            type="button"
                                            $selected={option.value === value}
                                            title={`Edit ${option.label}`}
                                            aria-label={`Edit ${option.label}`}
                                            onMouseDown={(event: MouseEvent<HTMLButtonElement>) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                            }}
                                            onClick={event => {
                                                event.stopPropagation();
                                                close();
                                                void onEditOption(option);
                                            }}
                                        >
                                            <Icon icon="lucide:pencil" width={13} height={13} />
                                        </S.SelectOptionEdit>
                                    )}
                                </S.SelectOptionRow>
                            </Fragment>
                        )) : (
                            <S.SelectEmpty>No option found.</S.SelectEmpty>
                        )}
                    </S.SelectOptions>
                    {footerHint && (
                        <S.SelectFooterHint>{footerHint}</S.SelectFooterHint>
                    )}
                </S.SelectDropdown>
            )}
        </S.SelectRoot>
    );
}
