import styled from 'styled-components';

export const SectionHint = styled.div`
    font-size: 12px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    margin-top: -10px;
    line-height: 1.45;
`;

export const SearchWrap = styled.div`
    display: flex;
    align-items: center;
    gap: 9px;
    width: min(100%, 460px);
    min-height: 38px;
    margin-top: 18px;
    padding: 0 11px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    background: ${({ theme }) => theme.colors.bg.primary};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    transition: border-color 120ms ease, box-shadow 120ms ease;

    &:focus-within {
        color: ${({ theme }) => theme.colors.text.secondary};
        border-color: ${({ theme }) => theme.colors.accent.primary};
        box-shadow: 0 0 0 3px ${({ theme }) => `${theme.colors.accent.primary}14`};
    }
`;

export const SearchInput = styled.input`
    flex: 1;
    min-width: 0;
    height: 36px;
    color: ${({ theme }) => theme.colors.text.primary};
    background: transparent;
    border: 0;
    outline: 0;
    font: inherit;
    font-size: 12px;

    &::placeholder {
        color: ${({ theme }) => theme.colors.text.tertiary};
    }

    &::-webkit-search-cancel-button {
        display: none;
    }
`;

export const ClearSearch = styled.button`
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    flex: 0 0 24px;
    padding: 0;
    color: ${({ theme }) => theme.colors.text.tertiary};
    background: ${({ theme }) => theme.colors.bg.tertiary};
    border: 0;
    border-radius: ${({ theme }) => theme.radius.sm};
    cursor: pointer;

    &:hover {
        color: ${({ theme }) => theme.colors.text.primary};
    }
`;

export const TabsWrap = styled.div`
    margin-top: 18px;

    > div {
        margin-bottom: 0;
    }
`;

export const TabCount = styled.span`
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 10px;
    font-variant-numeric: tabular-nums;
`;

export const SettingsInlineHint = styled.div`
    font-size: 11px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    line-height: 1.4;
`;

export const FormActions = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
`;

export const Header = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin: 18px 0 14px;

    @media (max-width: 640px) {
        align-items: flex-start;
        flex-direction: column;
    }
`;

export const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    min-width: 0;

    @media (max-width: 1200px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 720px) {
        grid-template-columns: minmax(0, 1fr);
    }
`;

export const Item = styled.div<{ $enabled?: boolean }>`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    min-width: 0;
    border: 1px solid ${({ theme, $enabled }) => $enabled ? `${theme.colors.accent.primary}35` : theme.colors.border.default};
    background: ${({ theme, $enabled }) => $enabled ? `${theme.colors.accent.primary}08` : theme.colors.bg.primary};
    border-radius: ${({ theme }) => theme.radius.md};
    padding: 14px;
`;

export const Info = styled.div`
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
`;

export const Name = styled.div`
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 13px;
    font-weight: 600;
`;

export const Code = styled.code`
    width: fit-content;
    max-width: 100%;
    color: ${({ theme }) => theme.colors.text.secondary};
    background: ${({ theme }) => theme.colors.bg.tertiary};
    border-radius: ${({ theme }) => theme.radius.sm};
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 11px;
    padding: 2px 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export const Description = styled.div`
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 12px;
    line-height: 1.4;
`;

export const EmptyState = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    min-height: 88px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    border: 1px dashed ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    font-size: 12px;
`;
