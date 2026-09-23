import styled from 'styled-components';
import {
    Dropdown,
    Empty,
    Option,
    Picker,
    SearchInput,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/ExpressionInput/shared.styled';

export const SelectPicker = styled(Picker)``;

export const SelectTrigger = styled.button`
    width: 100%;
    min-height: 38px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 11px;
    border-radius: ${({ theme }) => theme.radius.md};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 12px;
    background: ${({ theme }) => theme.colors.bg.primary};
    cursor: pointer;

    > [data-select-label] {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: left;
        pointer-events: none;
    }

    > svg {
        flex-shrink: 0;
        color: ${({ theme }) => theme.colors.text.tertiary};
    }

    &:disabled {
        cursor: default;
        opacity: 0.55;
    }
`;

export const SelectDropdown = styled(Dropdown)``;

export const SelectSearchInput = styled(SearchInput)``;

export const SelectOption = styled(Option)<{ $active?: boolean; $selected?: boolean }>`
    background: ${({ theme, $active, $selected }) => (
        $active && !$selected
            ? `color-mix(in srgb, ${theme.colors.bg.hover} 55%, transparent)`
            : 'transparent'
    )};
    outline: none;

    strong {
        flex: 1 1 auto;
        font-weight: ${({ $selected }) => ($selected ? 700 : 400)};
        cursor: inherit;
        pointer-events: none;
    }

    span {
        cursor: inherit;
        pointer-events: none;
    }

    /* Explanation on the left, real value as a code tag on the right. */
    > [data-select-description] {
        font-weight: ${({ $selected }) => ($selected ? 600 : 400)};
        color: ${({ theme }) => theme.colors.text.secondary};
        white-space: normal;
        line-height: 1.3;
    }

    > [data-select-value] {
        padding: 1px 6px;
        border-radius: ${({ theme }) => theme.radius.sm};
        background: ${({ theme }) => theme.colors.bg.hover};
        color: ${({ theme }) => theme.colors.text.primary};
        font-family: ${({ theme }) => theme.font.mono};
        font-size: 11px;
    }

    > [data-select-check] {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: inherit;
    }

    &:hover {
        background: ${({ theme }) => `color-mix(in srgb, ${theme.colors.bg.hover} 55%, transparent)`};
    }
`;

export const SelectEmpty = styled(Empty)``;

export const OptionIcon = styled.span`
    flex: 0 0 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    pointer-events: none;

    img {
        width: 14px;
        height: 14px;
        border-radius: 3px;
        object-fit: cover;
    }
`;
