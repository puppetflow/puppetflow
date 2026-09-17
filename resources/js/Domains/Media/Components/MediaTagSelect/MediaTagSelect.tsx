import { useMemo, useRef, useState } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import * as S from './styled';

interface Props {
    value: string[];
    suggestions: string[];
    disabled?: boolean;
    onChange: (tags: string[]) => void;
}

const MAX_TAGS = 50;

function normalized(tag: string): string {
    return tag.trim().slice(0, 100);
}

export default function MediaTagSelect({
    value,
    suggestions,
    disabled = false,
    onChange,
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const selected = useMemo(
        () => new Set(value.map(tag => tag.toLocaleLowerCase())),
        [value],
    );
    const matches = useMemo(() => {
        const search = query.trim().toLocaleLowerCase();
        return suggestions
            .filter(tag => !selected.has(tag.toLocaleLowerCase()))
            .filter(tag => search === '' || tag.toLocaleLowerCase().includes(search))
            .slice(0, 12);
    }, [query, selected, suggestions]);
    const customTag = normalized(query);
    const canAddCustom = customTag !== ''
        && !selected.has(customTag.toLocaleLowerCase())
        && !matches.some(tag => tag.toLocaleLowerCase() === customTag.toLocaleLowerCase());
    const suggestionOffset = canAddCustom ? 1 : 0;
    const optionCount = matches.length + (canAddCustom ? 1 : 0);

    const add = (rawTag: string) => {
        const tag = normalized(rawTag);
        if (
            tag === ''
            || value.length >= MAX_TAGS
            || selected.has(tag.toLocaleLowerCase())
        ) return;
        onChange([...value, tag]);
        setQuery('');
        setActiveIndex(0);
        setOpen(true);
        inputRef.current?.focus();
    };

    const remove = (tag: string) => {
        onChange(value.filter(candidate => candidate !== tag));
        inputRef.current?.focus();
    };

    const selectActive = () => {
        if (canAddCustom && activeIndex === 0) {
            add(customTag);
            return;
        }
        const suggestion = matches[activeIndex - suggestionOffset];
        if (suggestion) add(suggestion);
    };

    return (
        <S.Wrapper
            onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
            }}
        >
            <S.Label htmlFor="media-tags">Tags</S.Label>
            <S.Control
                $focused={open}
                $disabled={disabled}
                onClick={() => !disabled && inputRef.current?.focus()}
            >
                {value.map(tag => (
                    <S.Chip key={tag}>
                        <span>{tag}</span>
                        {!disabled && (
                            <S.Remove
                                type="button"
                                onClick={event => {
                                    event.stopPropagation();
                                    remove(tag);
                                }}
                                aria-label={`Remove ${tag}`}
                            >
                                <Icon icon="lucide:x" width={11} />
                            </S.Remove>
                        )}
                    </S.Chip>
                ))}
                {!disabled && value.length < MAX_TAGS && (
                    <S.Input
                        id="media-tags"
                        ref={inputRef}
                        value={query}
                        maxLength={100}
                        placeholder={value.length === 0 ? 'Search or add a tag...' : 'Add tag...'}
                        role="combobox"
                        aria-expanded={open}
                        aria-controls="media-tag-options"
                        onFocus={() => setOpen(true)}
                        onChange={event => {
                            setQuery(event.target.value);
                            setActiveIndex(0);
                            setOpen(true);
                        }}
                        onKeyDown={event => {
                            if (event.key === 'ArrowDown' && optionCount > 0) {
                                event.preventDefault();
                                setActiveIndex(index => Math.min(index + 1, optionCount - 1));
                            } else if (event.key === 'ArrowUp' && optionCount > 0) {
                                event.preventDefault();
                                setActiveIndex(index => Math.max(index - 1, 0));
                            } else if (event.key === 'Enter' || event.key === ',') {
                                event.preventDefault();
                                if (optionCount > 0) selectActive();
                            } else if (event.key === 'Backspace' && query === '' && value.length > 0) {
                                remove(value[value.length - 1]);
                            } else if (event.key === 'Escape') {
                                setOpen(false);
                            }
                        }}
                    />
                )}
            </S.Control>
            {!disabled && open && optionCount > 0 && (
                <S.Options id="media-tag-options" role="listbox">
                    {canAddCustom && (
                        <S.Option
                            type="button"
                            role="option"
                            aria-selected={activeIndex === 0}
                            $active={activeIndex === 0}
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => add(customTag)}
                        >
                            <Icon icon="lucide:plus" width={13} />
                            <span>Add “{customTag}”</span>
                        </S.Option>
                    )}
                    {matches.map((tag, index) => (
                        <S.Option
                            key={tag}
                            type="button"
                            role="option"
                            aria-selected={index + suggestionOffset === activeIndex}
                            $active={index + suggestionOffset === activeIndex}
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => add(tag)}
                        >
                            <Icon icon="lucide:tag" width={13} />
                            <span>{tag}</span>
                        </S.Option>
                    ))}
                </S.Options>
            )}
            <S.Hint>{value.length}/{MAX_TAGS} tags</S.Hint>
        </S.Wrapper>
    );
}
