import styled from 'styled-components';
import { controlStyles } from '@/Shared/UI/Input/shared.styled';

export const Wrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    min-width: 0;
`;

export const Label = styled.label`
    font-size: 12px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text.secondary};
`;

export const Row = styled.div`
    display: flex;
    align-items: stretch;
    gap: 6px;
    width: 100%;
    min-width: 0;
`;

export const Field = styled.input<{ $hasError?: boolean }>`
    ${controlStyles}
    flex: 1;
    min-width: 0;
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 12px;
    transition: border-color ${({ theme }) => theme.transition.fast};

    &::placeholder {
        color: ${({ theme }) => theme.colors.text.tertiary};
        font-family: ${({ theme }) => theme.font.sans};
        font-size: 13px;
    }

    &:focus {
        outline: none;
        border-color: ${({ theme }) => theme.colors.border.focus};
        box-shadow: 0 0 0 3px ${({ theme }) => `${theme.colors.border.focus}26`};
    }

    &:disabled {
        background: ${({ theme }) => theme.colors.bg.tertiary};
        cursor: not-allowed;
        opacity: 0.7;
    }
`;

export const PickerButton = styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 36px;
    background: ${({ theme }) => theme.colors.bg.tertiary};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    color: ${({ theme }) => theme.colors.text.secondary};
    cursor: pointer;
    transition: background ${({ theme }) => theme.transition.fast}, color ${({ theme }) => theme.transition.fast}, border-color ${({ theme }) => theme.transition.fast};

    &:hover:not(:disabled) {
        background: ${({ theme }) => theme.colors.bg.hover};
        color: ${({ theme }) => theme.colors.text.primary};
        border-color: ${({ theme }) => theme.colors.border.light};
    }

    &:focus-visible {
        outline: none;
        border-color: ${({ theme }) => theme.colors.border.focus};
        box-shadow: 0 0 0 3px ${({ theme }) => `${theme.colors.border.focus}26`};
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.6;
    }
`;

export const Footer = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    min-width: 0;
`;

export const Error = styled.span`
    font-size: 11px;
    color: ${({ theme }) => theme.colors.accent.error};
`;

export const Hint = styled.span`
    min-width: 0;
    font-size: 11px;
    line-height: 1.35;
    color: ${({ theme }) => theme.colors.text.tertiary};
`;
