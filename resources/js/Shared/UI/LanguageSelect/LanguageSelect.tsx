import { useMemo } from 'react';
import CustomSelect, { type CustomSelectOption } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodeConfigModal/components/CustomSelect/CustomSelect';
import * as Shared from '@/Shared/UI/Input/shared.styled';
import {
    BROWSER_LANGUAGE_OPTIONS,
    browserLanguageFlag,
    normalizeBrowserLanguage,
} from '@/Shared/Utils/browserLanguages';

interface LanguageSelectProps {
    label?: string;
    // Stored Accept-Language list, empty string to inherit.
    value: string;
    onChange: (value: string) => void;
    // Shown for the empty option, e.g. "Inherit (French (France))".
    inheritLabel: string;
    // Value inherited when empty; used to show its flag on the inherit option.
    inheritedValue?: string | null;
    error?: string;
    disabled?: boolean;
}

export default function LanguageSelect({ label, value, onChange, inheritLabel, inheritedValue, error, disabled }: LanguageSelectProps) {
    const normalized = normalizeBrowserLanguage(value);
    const inherited = normalizeBrowserLanguage(inheritedValue);

    const options = useMemo<CustomSelectOption[]>(() => {
        const presets = BROWSER_LANGUAGE_OPTIONS.map(option => ({
            value: option.value,
            label: option.label,
            detail: option.value,
            iconText: browserLanguageFlag(option.value),
        }));
        const list: CustomSelectOption[] = [
            inherited
                ? { value: '', label: inheritLabel, iconText: browserLanguageFlag(inherited) }
                : { value: '', label: inheritLabel, icon: 'lucide:corner-left-up' },
            { ...presets[0], dividerBefore: true },
            ...presets.slice(1),
        ];
        // Keep values set through the API visible instead of silently resetting them.
        if (normalized && !BROWSER_LANGUAGE_OPTIONS.some(option => option.value === normalized)) {
            list.push({
                value: normalized,
                label: 'Custom',
                detail: normalized,
                iconText: browserLanguageFlag(normalized),
                dividerBefore: true,
            });
        }
        return list;
    }, [inheritLabel, inherited, normalized]);

    return (
        <Shared.Wrapper $fullWidth>
            {label && <Shared.Label as="span">{label}</Shared.Label>}
            <CustomSelect
                value={normalized}
                options={options}
                searchThreshold={0}
                showOptionValue={false}
                placeholder={inheritLabel}
                ariaLabel={label ?? 'Browser language'}
                invalid={Boolean(error)}
                disabled={disabled}
                onChange={onChange}
            />
            {error && <Shared.Error>{error}</Shared.Error>}
        </Shared.Wrapper>
    );
}
