import { useMemo, useRef, useState } from 'react';
import { useSearchablePopover } from '@/Shared/Hooks/useSearchablePopover';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { countries, countryFlag } from './countries';
import * as S from './styled';

interface CountryComboboxProps {
    value: string;
    scanning: boolean;
    disabled?: boolean;
    scanDisabled?: boolean;
    onChange: (value: string) => void;
    onScan: () => void;
}

export default function CountryCombobox({
    value,
    scanning,
    disabled = false,
    scanDisabled = false,
    onChange,
    onScan,
}: CountryComboboxProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const selected = countries.find(country => country.code === value);
    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return countries;

        return countries.filter(country => (
            country.name.toLowerCase().includes(query)
            || country.code.toLowerCase().includes(query)
        ));
    }, [search]);

    useSearchablePopover({
        open,
        onDismiss: () => setOpen(false),
        reset: () => setSearch(''),
        focusRef: searchRef,
        containerRefs: [wrapperRef],
        eventType: 'mousedown',
    });

    const select = (code: string) => {
        onChange(code);
        setOpen(false);
        setSearch('');
    };

    return (
        <S.CountryField ref={wrapperRef}>
            <S.CountryLabel>Country (Optional)</S.CountryLabel>
            <S.CountryControls>
                <S.CountryTrigger
                    type="button"
                    $open={open}
                    $hasValue={Boolean(selected)}
                    disabled={disabled}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    onClick={() => {
                        setOpen(current => !current);
                        setSearch('');
                    }}
                >
                    <S.CountryFlag aria-hidden>{selected ? countryFlag(selected.code) : '🌐'}</S.CountryFlag>
                    <S.CountryValue>{selected?.name || 'Select a country'}</S.CountryValue>
                    <Icon icon="lucide:chevron-down" width={14} />
                </S.CountryTrigger>
                <S.CountryScanButton
                    type="button"
                    disabled={disabled || scanDisabled || scanning}
                    aria-label="Detect proxy country"
                    title="Detect country from proxy"
                    onClick={onScan}
                >
                    {scanning
                        ? <S.CountrySpinner aria-hidden />
                        : <Icon icon="lucide:scan-search" width={16} />}
                </S.CountryScanButton>
            </S.CountryControls>
            {open && (
                <S.CountryPanel>
                    <S.CountrySearch
                        ref={searchRef}
                        value={search}
                        placeholder="Search countries..."
                        aria-label="Search countries"
                        onChange={event => setSearch(event.target.value)}
                    />
                    <S.CountryList role="listbox">
                        {value && !search && (
                            <S.CountryOption
                                type="button"
                                role="option"
                                aria-selected={false}
                                onClick={() => select('')}
                            >
                                <S.CountryFlag aria-hidden>🌐</S.CountryFlag>
                                No country
                            </S.CountryOption>
                        )}
                        {filtered.map(country => (
                            <S.CountryOption
                                key={country.code}
                                type="button"
                                role="option"
                                $active={country.code === value}
                                aria-selected={country.code === value}
                                onClick={() => select(country.code)}
                            >
                                <S.CountryFlag aria-hidden>{countryFlag(country.code)}</S.CountryFlag>
                                <span>{country.name}</span>
                                <S.CountryCode>{country.code}</S.CountryCode>
                            </S.CountryOption>
                        ))}
                        {filtered.length === 0 && (
                            <S.CountryEmpty>No countries found</S.CountryEmpty>
                        )}
                    </S.CountryList>
                </S.CountryPanel>
            )}
        </S.CountryField>
    );
}
