import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import type { NodalSelectOption } from '@/Domains/Flow/Pages/FlowEditor/types';
import type { ScalarNodeParameterValue } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import { useAnchoredDropdownPosition } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/hooks/useAnchoredDropdownPosition';
import { dropdownStyle } from '../utils';
import * as Shared from '../shared.styled';
import * as S from './styled';

export interface SelectInputAction {
    label: ReactNode;
    /** Resolves with the value to select, or null when cancelled. */
    onAction: () => Promise<string | null>;
}

interface SelectInputProps {
    options: NodalSelectOption[];
    searchThreshold: number;
    value: string;
    placeholder?: string;
    allowCustomValue?: boolean;
    customValueLabel?: string;
    readOnly?: boolean;
    action?: SelectInputAction;
    browseAction?: () => Promise<string | null>;
    onChange: (value: ScalarNodeParameterValue) => void;
}

function OptionIcon({ option }: { option: NodalSelectOption }) {
    if (!option.iconUrl && !option.icon) return null;

    return (
        <S.OptionIcon aria-hidden style={option.iconColor ? { color: option.iconColor } : undefined}>
            {option.iconUrl
                ? <img src={option.iconUrl} alt="" loading="lazy" />
                : <Icon icon={option.icon!} width={14} height={14} />}
        </S.OptionIcon>
    );
}

export default function SelectInput({
    options,
    searchThreshold,
    value,
    placeholder,
    allowCustomValue = false,
    customValueLabel = 'tab name',
    readOnly,
    action,
    browseAction,
    onChange,
}: SelectInputProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [actionRunning, setActionRunning] = useState(false);
    const [browseRunning, setBrowseRunning] = useState(false);
    const actionRunningRef = useRef(false);
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const { dropdownRect, updateDropdownPosition } = useAnchoredDropdownPosition(
        triggerRef,
        open,
        { maxHeight: 190 },
    );
    const selectedOption = options.find(option => option.value === value);
    const showSearch = allowCustomValue || options.length >= searchThreshold;
    const filteredOptions = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return options;

        return options.filter(option => (
            option.label.toLowerCase().includes(normalizedQuery)
            || option.value.toLowerCase().includes(normalizedQuery)
        ));
    }, [options, query]);
    const selectableOptions = useMemo(() => {
        const customValue = query.trim();
        const customOption = allowCustomValue
            && customValue
            && !options.some(option => option.value === customValue)
            ? {
                value: customValue,
                label: `Use "${customValue}"`,
                detail: `Custom ${customValueLabel}`,
            }
            : null;

        return customOption ? [customOption, ...filteredOptions] : filteredOptions;
    }, [allowCustomValue, customValueLabel, filteredOptions, options, query]);

    useEffect(() => {
        if (!open) return;

        const customValueIsFirst = allowCustomValue
            && Boolean(query.trim())
            && selectableOptions[0]?.value === query.trim();
        if (customValueIsFirst) {
            setActiveIndex(0);
            return;
        }
        const selectedIndex = selectableOptions.findIndex(option => option.value === value);
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }, [allowCustomValue, open, query, selectableOptions, value]);

    useEffect(() => {
        if (open) {
            optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
        }
    }, [activeIndex, open]);

    const close = () => {
        setOpen(false);
        setQuery('');
    };

    const selectOption = (option: NodalSelectOption) => {
        onChange({ mode: 'fixed', value: option.value });
        close();
    };

    const runAction = async () => {
        if (!action || actionRunningRef.current) return;
        actionRunningRef.current = true;
        setActionRunning(true);
        try {
            const created = await action.onAction();
            if (created) {
                onChange({ mode: 'fixed', value: created });
                close();
            }
            window.requestAnimationFrame(() => triggerRef.current?.focus());
        } finally {
            actionRunningRef.current = false;
            setActionRunning(false);
        }
    };

    const browse = async () => {
        if (!browseAction || browseRunning) return;
        close();
        setBrowseRunning(true);
        try {
            const picked = await browseAction();
            if (picked) onChange({ mode: 'fixed', value: picked });
        } finally {
            setBrowseRunning(false);
            window.requestAnimationFrame(() => triggerRef.current?.focus());
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (readOnly) return;

        if (!open) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter') {
                event.preventDefault();
                setQuery('');
                updateDropdownPosition();
                setOpen(true);
            }
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            close();
            return;
        }

        if (selectableOptions.length === 0) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex(current => Math.min(current + 1, selectableOptions.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex(current => Math.max(current - 1, 0));
        } else if (event.key === 'Home') {
            event.preventDefault();
            setActiveIndex(0);
        } else if (event.key === 'End') {
            event.preventDefault();
            setActiveIndex(selectableOptions.length - 1);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            selectOption(selectableOptions[activeIndex] ?? selectableOptions[0]);
        }
    };

    return (
        <S.SelectPicker
            onKeyDown={handleKeyDown}
            onBlurCapture={event => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                if (actionRunningRef.current) return;
                close();
            }}
        >
            <S.SelectTrigger
                type="button"
                ref={triggerRef}
                disabled={readOnly}
                onClick={() => {
                    setQuery('');
                    updateDropdownPosition();
                    setOpen(current => !current);
                }}
            >
                {selectedOption && <OptionIcon option={selectedOption} />}
                <span data-select-label>{(selectedOption?.label ?? value) || placeholder || 'Select a value...'}</span>
                <Icon icon="lucide:chevron-down" width={14} height={14} />
            </S.SelectTrigger>
            {open && !readOnly && !actionRunning && dropdownRect && (
                <S.SelectDropdown
                    data-node-field-dropdown="true"
                    style={dropdownStyle(dropdownRect)}
                >
                    {showSearch && (
                        <S.SelectSearchInput
                            autoFocus
                            value={query}
                            placeholder={allowCustomValue ? `Search or enter a ${customValueLabel}...` : 'Search option...'}
                            onChange={event => {
                                setQuery(event.target.value);
                                setActiveIndex(0);
                            }}
                            onKeyDown={event => {
                                if (event.key === 'Escape') {
                                    event.preventDefault();
                                    close();
                                }
                            }}
                        />
                    )}
                    {action && (
                        <Shared.DropdownActionRow>
                            <Shared.DropdownAction
                                type="button"
                                onMouseDown={event => event.preventDefault()}
                                onClick={() => void runAction()}
                            >
                                {action.label}
                            </Shared.DropdownAction>
                        </Shared.DropdownActionRow>
                    )}
                    {browseAction && (
                        <Shared.DropdownActionRow>
                            <Shared.DropdownAction
                                type="button"
                                $loading={browseRunning}
                                disabled={browseRunning}
                                onMouseDown={event => event.preventDefault()}
                                onClick={() => void browse()}
                            >
                                <Icon icon={browseRunning ? 'lucide:loader-circle' : 'lucide:folder-search'} width={13} />
                                Browse library
                            </Shared.DropdownAction>
                        </Shared.DropdownActionRow>
                    )}
                    {selectableOptions.length > 0 ? (
                        selectableOptions.map((option, optionIndex) => (
                            <S.SelectOption
                                key={option.value}
                                ref={element => {
                                    optionRefs.current[optionIndex] = element;
                                }}
                                type="button"
                                $active={selectableOptions[activeIndex]?.value === option.value}
                                $selected={option.value === value}
                                aria-selected={option.value === value}
                                onMouseDown={event => event.preventDefault()}
                                onMouseEnter={() => setActiveIndex(optionIndex)}
                                onClick={() => selectOption(option)}
                            >
                                <OptionIcon option={option} />
                                <strong>{option.label}</strong>
                                {option.detail && <span>{option.detail}</span>}
                                {option.value === value && (
                                    <span data-select-check>
                                        <Icon icon="lucide:check" width={13} height={13} />
                                    </span>
                                )}
                            </S.SelectOption>
                        ))
                    ) : (
                        <S.SelectEmpty>No option found.</S.SelectEmpty>
                    )}
                </S.SelectDropdown>
            )}
        </S.SelectPicker>
    );
}
