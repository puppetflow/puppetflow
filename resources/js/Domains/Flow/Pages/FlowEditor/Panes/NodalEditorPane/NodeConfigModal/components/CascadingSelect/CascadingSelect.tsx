import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type FocusEvent,
    type KeyboardEvent,
    type MouseEvent,
} from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { useAnchoredDropdownPosition } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/hooks/useAnchoredDropdownPosition';
import * as S from './styled';

export interface CascadingSelectOption {
    value: string;
    label: string;
}

export interface CascadingSelectGroup {
    value: string;
    label: string;
    icon?: string;
    options: CascadingSelectOption[];
}

export interface CascadingSelectValue {
    group: string;
    option: string;
}

interface CascadingSelectProps {
    value: CascadingSelectValue | null;
    groups: CascadingSelectGroup[];
    placeholder?: string;
    ariaLabel?: string;
    disabled?: boolean;
    compact?: boolean;
    invalid?: boolean;
    onChange: (group: string, option: string) => void;
}

interface SubmenuRect {
    top: number;
    left: number;
    maxHeight: number;
}

type ActiveColumn = 'groups' | 'options';

const MENU_MAX_HEIGHT = 320;
const MENU_MAX_WIDTH = 280;
const MENU_MIN_WIDTH = 200;
const MENU_GAP = 5;
const SUBMENU_GAP = 4;
const PANEL_PADDING = 5;
const VIEWPORT_PADDING = 12;
const HOVER_INTENT_DELAY = 90;

const submenuMaxHeight = () => Math.max(120, window.innerHeight - VIEWPORT_PADDING * 2);

// Two-level select: the first panel lists groups, the second lists the options of the active group.
export default function CascadingSelect({
    value,
    groups,
    placeholder = 'Select a value...',
    ariaLabel,
    disabled,
    compact,
    invalid,
    onChange,
}: CascadingSelectProps) {
    const [open, setOpen] = useState(false);
    const [activeGroupIndex, setActiveGroupIndex] = useState(0);
    const [activeOptionIndex, setActiveOptionIndex] = useState(0);
    const [column, setColumn] = useState<ActiveColumn>('options');
    const [submenuRect, setSubmenuRect] = useState<SubmenuRect | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const submenuRef = useRef<HTMLDivElement | null>(null);
    const groupRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingGroupRef = useRef<number | null>(null);
    const { dropdownRect, updateDropdownPosition } = useAnchoredDropdownPosition(
        triggerRef,
        open,
        {
            maxHeight: MENU_MAX_HEIGHT,
            gap: MENU_GAP,
            clampLeft: true,
            minWidth: MENU_MIN_WIDTH,
            viewportPadding: VIEWPORT_PADDING,
        },
    );

    const selectedGroupIndex = groups.findIndex(group => group.value === value?.group);
    const selectedGroup = groups[selectedGroupIndex];
    const selectedOption = selectedGroup?.options.find(option => option.value === value?.option);
    const activeGroup = groups[activeGroupIndex];
    const activeOptions = activeGroup?.options ?? [];

    const clearHoverTimer = () => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
        pendingGroupRef.current = null;
    };

    useEffect(() => clearHoverTimer, []);

    const optionIndexFor = (groupIndex: number) => {
        if (groupIndex !== selectedGroupIndex) return 0;
        return Math.max(0, groups[groupIndex]?.options.findIndex(option => option.value === value?.option) ?? 0);
    };

    const activateGroup = (groupIndex: number, nextColumn: ActiveColumn) => {
        const boundedIndex = Math.max(0, Math.min(groupIndex, groups.length - 1));
        setActiveGroupIndex(boundedIndex);
        setActiveOptionIndex(optionIndexFor(boundedIndex));
        setColumn(nextColumn);
    };

    const close = () => {
        clearHoverTimer();
        setOpen(false);
        setSubmenuRect(null);
    };

    const openSelect = () => {
        if (disabled) return;

        updateDropdownPosition();
        activateGroup(Math.max(0, selectedGroupIndex), 'options');
        setOpen(true);
    };

    const selectOption = (groupIndex: number, optionIndex: number) => {
        const group = groups[groupIndex];
        const option = group?.options[optionIndex];
        if (!group || !option) return;

        onChange(group.value, option.value);
        close();
    };

    // Places the submenu next to the active group, flipping and clamping it inside the viewport.
    useLayoutEffect(() => {
        if (!open || !dropdownRect) {
            setSubmenuRect(null);
            return;
        }

        const menu = menuRef.current;
        const submenu = submenuRef.current;
        const groupItem = groupRefs.current[activeGroupIndex];
        if (!menu || !submenu || !groupItem) return;

        const menuBounds = menu.getBoundingClientRect();
        const itemBounds = groupItem.getBoundingClientRect();
        const submenuBounds = submenu.getBoundingClientRect();
        const maxHeight = submenuMaxHeight();
        const height = Math.min(submenuBounds.height, maxHeight);
        const width = submenuBounds.width;

        let left = menuBounds.right + SUBMENU_GAP;
        if (left + width > window.innerWidth - VIEWPORT_PADDING) {
            left = menuBounds.left - SUBMENU_GAP - width;
        }
        if (left < VIEWPORT_PADDING) {
            left = Math.max(VIEWPORT_PADDING, window.innerWidth - VIEWPORT_PADDING - width);
        }

        let top = itemBounds.top - PANEL_PADDING;
        top = Math.min(top, window.innerHeight - VIEWPORT_PADDING - height);
        top = Math.max(VIEWPORT_PADDING, top);

        setSubmenuRect({ top, left, maxHeight });
    }, [open, dropdownRect, activeGroupIndex, groups]);

    useEffect(() => {
        if (!open) return;
        groupRefs.current[activeGroupIndex]?.scrollIntoView({ block: 'nearest' });
    }, [open, activeGroupIndex]);

    useEffect(() => {
        if (!open || !submenuRect) return;
        optionRefs.current[activeOptionIndex]?.scrollIntoView({ block: 'nearest' });
    }, [open, submenuRect, activeOptionIndex, column]);

    const handleKeyDown = (event: KeyboardEvent) => {
        if (disabled) return;

        if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
            event.preventDefault();
            openSelect();
            return;
        }

        if (!open) return;

        const inGroups = column === 'groups';
        const lastGroup = groups.length - 1;
        const lastOption = activeOptions.length - 1;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (inGroups) activateGroup(Math.min(activeGroupIndex + 1, lastGroup), 'groups');
            else setActiveOptionIndex(current => Math.min(current + 1, lastOption));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (inGroups) activateGroup(Math.max(activeGroupIndex - 1, 0), 'groups');
            else setActiveOptionIndex(current => Math.max(current - 1, 0));
        } else if (event.key === 'Home') {
            event.preventDefault();
            if (inGroups) activateGroup(0, 'groups');
            else setActiveOptionIndex(0);
        } else if (event.key === 'End') {
            event.preventDefault();
            if (inGroups) activateGroup(lastGroup, 'groups');
            else setActiveOptionIndex(Math.max(0, lastOption));
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            if (inGroups) setColumn('options');
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            if (!inGroups) setColumn('groups');
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (inGroups) setColumn('options');
            else selectOption(activeGroupIndex, activeOptionIndex);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            close();
        }
    };

    const preventFocusLoss = (event: MouseEvent) => event.preventDefault();
    const iconSize = compact ? 12 : 14;

    return (
        <S.Root
            $compact={compact}
            onBlurCapture={(event: FocusEvent<HTMLDivElement>) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                close();
            }}
        >
            <S.Trigger
                type="button"
                ref={triggerRef}
                $open={open}
                $compact={compact}
                $hasValue={Boolean(selectedOption)}
                $invalid={invalid}
                aria-label={ariaLabel}
                aria-invalid={invalid}
                aria-haspopup="menu"
                aria-expanded={open}
                disabled={disabled}
                onKeyDown={handleKeyDown}
                onClick={() => {
                    if (disabled) return;
                    if (open) {
                        close();
                        return;
                    }
                    openSelect();
                }}
            >
                <S.Value>
                    {selectedGroup?.icon && selectedOption && (
                        <S.IconSlot>
                            <Icon icon={selectedGroup.icon} width={15} height={15} />
                        </S.IconSlot>
                    )}
                    <S.ValueLabel>{selectedOption?.label ?? placeholder}</S.ValueLabel>
                </S.Value>
                <Icon icon="lucide:chevron-down" width={iconSize} height={iconSize} />
            </S.Trigger>
            {open && !disabled && dropdownRect && (
                <>
                    <S.Panel
                        ref={menuRef}
                        role="menu"
                        data-node-field-dropdown="true"
                        style={{
                            top: dropdownRect.top,
                            left: dropdownRect.left,
                            width: Math.min(dropdownRect.width, MENU_MAX_WIDTH),
                            maxHeight: dropdownRect.maxHeight,
                            transform: dropdownRect.placement === 'above' ? 'translateY(-100%)' : undefined,
                        }}
                        onMouseDown={preventFocusLoss}
                    >
                        {groups.map((group, groupIndex) => {
                            const isSelectedGroup = groupIndex === selectedGroupIndex && Boolean(selectedOption);

                            return (
                                <S.Item
                                    key={group.value}
                                    ref={(element: HTMLButtonElement | null) => {
                                        groupRefs.current[groupIndex] = element;
                                    }}
                                    type="button"
                                    role="menuitem"
                                    aria-haspopup="menu"
                                    aria-expanded={groupIndex === activeGroupIndex}
                                    $active={groupIndex === activeGroupIndex}
                                    $selected={isSelectedGroup}
                                    onMouseDown={preventFocusLoss}
                                    // mousemove (not mouseenter) so a re-rendered item under a still cursor
                                    // does not steal the keyboard highlight.
                                    onMouseMove={() => {
                                        if (groupIndex === activeGroupIndex) {
                                            clearHoverTimer();
                                            if (column !== 'groups') setColumn('groups');
                                            return;
                                        }
                                        if (pendingGroupRef.current === groupIndex) return;

                                        clearHoverTimer();
                                        pendingGroupRef.current = groupIndex;
                                        hoverTimerRef.current = setTimeout(() => {
                                            pendingGroupRef.current = null;
                                            activateGroup(groupIndex, 'groups');
                                        }, HOVER_INTENT_DELAY);
                                    }}
                                    onMouseLeave={clearHoverTimer}
                                    onClick={() => {
                                        clearHoverTimer();
                                        activateGroup(groupIndex, 'options');
                                    }}
                                >
                                    {group.icon && <Icon icon={group.icon} width={15} height={15} />}
                                    <S.ItemLabel>{group.label}</S.ItemLabel>
                                    {isSelectedGroup && (
                                        <S.ItemCheck>
                                            <Icon icon="lucide:check" width={13} height={13} />
                                        </S.ItemCheck>
                                    )}
                                    <S.ItemChevron>
                                        <Icon icon="lucide:chevron-right" width={13} height={13} />
                                    </S.ItemChevron>
                                </S.Item>
                            );
                        })}
                    </S.Panel>
                    {activeGroup && (
                        <S.Submenu
                            ref={submenuRef}
                            role="menu"
                            aria-label={activeGroup.label}
                            data-node-field-dropdown="true"
                            $positioned={Boolean(submenuRect)}
                            style={{
                                top: submenuRect?.top ?? dropdownRect.top,
                                left: submenuRect?.left ?? VIEWPORT_PADDING,
                                maxHeight: submenuRect?.maxHeight ?? submenuMaxHeight(),
                            }}
                            onMouseDown={preventFocusLoss}
                            onMouseEnter={clearHoverTimer}
                        >
                            <S.SubmenuHeading>
                                {activeGroup.icon && <Icon icon={activeGroup.icon} width={12} height={12} />}
                                {activeGroup.label}
                            </S.SubmenuHeading>
                            {activeOptions.map((option, optionIndex) => {
                                const isSelected = activeGroupIndex === selectedGroupIndex
                                    && option.value === value?.option;

                                return (
                                    <S.Item
                                        key={option.value}
                                        ref={(element: HTMLButtonElement | null) => {
                                            optionRefs.current[optionIndex] = element;
                                        }}
                                        type="button"
                                        role="menuitemradio"
                                        aria-checked={isSelected}
                                        $active={column === 'options' && optionIndex === activeOptionIndex}
                                        $selected={isSelected}
                                        onMouseDown={preventFocusLoss}
                                        onMouseMove={() => {
                                            if (optionIndex !== activeOptionIndex) setActiveOptionIndex(optionIndex);
                                            if (column !== 'options') setColumn('options');
                                        }}
                                        onClick={() => selectOption(activeGroupIndex, optionIndex)}
                                    >
                                        <S.ItemLabel>{option.label}</S.ItemLabel>
                                        {isSelected && (
                                            <S.ItemCheck>
                                                <Icon icon="lucide:check" width={13} height={13} />
                                            </S.ItemCheck>
                                        )}
                                    </S.Item>
                                );
                            })}
                        </S.Submenu>
                    )}
                </>
            )}
        </S.Root>
    );
}
