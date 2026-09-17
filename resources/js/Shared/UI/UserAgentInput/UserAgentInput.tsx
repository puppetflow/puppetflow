import React, { useState } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import UserAgentPickerModal from './UserAgentPickerModal/UserAgentPickerModal';
import * as S from './styled';

interface UserAgentInputProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    error?: string;
    hint?: React.ReactNode;
    disabled?: boolean;
    id?: string;
}

export default function UserAgentInput({ label, value, onChange, placeholder, error, hint, disabled, id }: UserAgentInputProps) {
    const generatedId = React.useId();
    const controlId = id ?? generatedId;
    const [pickerOpen, setPickerOpen] = useState(false);

    return (
        <S.Wrapper>
            {label && <S.Label htmlFor={controlId}>{label}</S.Label>}
            <S.Row>
                <S.Field
                    id={controlId}
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={512}
                    $hasError={!!error}
                    value={value}
                    placeholder={placeholder}
                    disabled={disabled}
                    onChange={e => onChange(e.target.value)}
                />
                <S.PickerButton
                    type="button"
                    title="Choose a user agent"
                    aria-label="Choose a user agent"
                    disabled={disabled}
                    onClick={() => setPickerOpen(true)}
                >
                    <Icon icon="lucide:list-tree" width={15} height={15} />
                </S.PickerButton>
            </S.Row>
            {(error || hint) && (
                <S.Footer>
                    {error ? <S.Error>{error}</S.Error> : <S.Hint>{hint}</S.Hint>}
                </S.Footer>
            )}
            <UserAgentPickerModal
                isOpen={pickerOpen}
                onClose={() => setPickerOpen(false)}
                onSelect={userAgent => {
                    onChange(userAgent);
                    setPickerOpen(false);
                }}
            />
        </S.Wrapper>
    );
}
