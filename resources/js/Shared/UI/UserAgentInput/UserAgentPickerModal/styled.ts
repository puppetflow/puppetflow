import styled, { css } from 'styled-components';

export const Layout = styled.div`
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
`;

export const Columns = styled.div`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    min-width: 0;

    @media (max-width: 768px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
`;

export const Column = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
`;

export const ColumnTitle = styled.div`
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: ${({ theme }) => theme.colors.text.tertiary};
    padding: 0 2px;
`;

export const OptionList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    height: 260px;
    overflow-y: auto;
    padding: 4px;
    background: ${({ theme }) => theme.colors.bg.primary};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
`;

export const Option = styled.button<{ $active?: boolean }>`
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    text-align: left;
    background: ${({ theme, $active }) => $active ? theme.colors.bg.active : 'transparent'};
    border: 1px solid ${({ theme, $active }) => $active ? theme.colors.border.light : 'transparent'};
    border-radius: ${({ theme }) => theme.radius.sm};
    color: ${({ theme }) => theme.colors.text.primary};
    cursor: pointer;
    transition: background ${({ theme }) => theme.transition.fast};

    &:hover {
        background: ${({ theme, $active }) => $active ? theme.colors.bg.active : theme.colors.bg.hover};
    }

    &:focus-visible {
        outline: none;
        border-color: ${({ theme }) => theme.colors.border.focus};
    }

    ${({ $active }) => $active && css`
        font-weight: 500;
    `}
`;

export const OptionIcon = styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    color: ${({ theme }) => theme.colors.text.secondary};
`;

export const OptionText = styled.span`
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
`;

export const OptionLabel = styled.span`
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export const OptionHint = styled.span`
    font-size: 10px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export const Preview = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    background: ${({ theme }) => theme.colors.bg.primary};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    min-width: 0;
`;

export const PreviewHeader = styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
`;

export const PreviewHeading = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
`;

export const PreviewTitle = styled.span`
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: ${({ theme }) => theme.colors.text.tertiary};
`;

export const PreviewSummary = styled.span`
    font-size: 11px;
    color: ${({ theme }) => theme.colors.text.secondary};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export const PreviewValue = styled.code`
    display: block;
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 11.5px;
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.text.primary};
    word-break: break-all;
    white-space: pre-wrap;
`;

export const ShuffleButton = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    font-size: 11px;
    background: transparent;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.sm};
    color: ${({ theme }) => theme.colors.text.secondary};
    cursor: pointer;
    transition: background ${({ theme }) => theme.transition.fast}, color ${({ theme }) => theme.transition.fast};

    &:hover {
        background: ${({ theme }) => theme.colors.bg.hover};
        color: ${({ theme }) => theme.colors.text.primary};
    }
`;
