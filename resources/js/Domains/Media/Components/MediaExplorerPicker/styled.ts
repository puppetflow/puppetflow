import styled, { css, keyframes } from 'styled-components';

const spin = keyframes`
    to {
        transform: rotate(360deg);
    }
`;

export const Layout = styled.div`
    height: min(620px, 72vh);
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr);
    overflow: hidden;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.lg};
    background: ${({ theme }) => theme.colors.bg.primary};

    @media (max-width: 720px) {
        height: 72vh;
        grid-template-columns: 190px minmax(0, 1fr);
    }
`;

export const Sidebar = styled.nav`
    min-width: 0;
    padding: 12px 8px;
    border-right: 1px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.bg.secondary};
    overflow: auto;
`;

export const SectionLabel = styled.div`
    padding: 4px 9px 8px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
`;

export const TreeRow = styled.button<{ $depth: number; $active: boolean }>`
    width: 100%;
    height: 28px;
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr) auto;
    align-items: center;
    gap: 7px;
    padding: 0 8px 0 ${({ $depth }) => 8 + $depth * 14}px;
    margin: 1px 0;
    border: 0;
    border-radius: ${({ theme }) => theme.radius.sm};
    color: ${({ theme, $active }) => $active ? theme.colors.text.primary : theme.colors.text.secondary};
    background: ${({ theme, $active }) => $active ? theme.colors.bg.active : 'transparent'};
    font-size: 11px;
    text-align: left;
    cursor: pointer;

    &:hover {
        color: ${({ theme }) => theme.colors.text.primary};
        background: ${({ theme }) => theme.colors.bg.hover};
    }

    span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    small {
        color: ${({ theme }) => theme.colors.text.tertiary};
        font-size: 9px;
    }
`;

export const Content = styled.section`
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
`;

export const ContentHeader = styled.header`
    min-height: 54px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 9px 14px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.default};
`;

export const HeaderActions = styled.div`
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
`;

export const Location = styled.div`
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 12px;

    strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
`;

export const Search = styled.label`
    position: relative;
    width: min(260px, 40vw);

    svg {
        position: absolute;
        top: 50%;
        left: 10px;
        color: ${({ theme }) => theme.colors.text.tertiary};
        transform: translateY(-50%);
    }

    input {
        width: 100%;
        height: 34px;
        padding: 0 10px 0 32px;
        border: 1px solid ${({ theme }) => theme.colors.border.default};
        border-radius: ${({ theme }) => theme.radius.md};
        color: ${({ theme }) => theme.colors.text.primary};
        background: ${({ theme }) => theme.colors.bg.secondary};
        font-size: 11px;

        &:focus {
            outline: none;
            border-color: ${({ theme }) => theme.colors.border.focus};
        }
    }
`;

export const ViewToggle = styled.button<{ $active: boolean }>`
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border: 1px solid ${({ theme, $active }) =>
        $active ? theme.colors.border.light : theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    color: ${({ theme, $active }) =>
        $active ? theme.colors.text.primary : theme.colors.text.tertiary};
    background: ${({ theme, $active }) =>
        $active ? theme.colors.bg.active : theme.colors.bg.secondary};
    cursor: pointer;

    &:hover {
        color: ${({ theme }) => theme.colors.text.primary};
        border-color: ${({ theme }) => theme.colors.border.light};
    }
`;

export const HeaderButton = styled.button<{ $loading: boolean }>`
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    color: ${({ theme }) => theme.colors.text.tertiary};
    background: ${({ theme }) => theme.colors.bg.secondary};
    cursor: pointer;

    svg {
        ${({ $loading }) => $loading && css`animation: ${spin} 0.8s linear infinite;`}
    }

    &:hover:not(:disabled) {
        color: ${({ theme }) => theme.colors.text.primary};
        border-color: ${({ theme }) => theme.colors.border.light};
    }

    &:disabled {
        cursor: default;
        opacity: 0.65;
    }
`;

export const Results = styled.div<{ $viewMode: 'grid' | 'list' }>`
    display: grid;
    grid-template-columns: ${({ $viewMode }) =>
        $viewMode === 'grid' ? 'repeat(auto-fill, minmax(130px, 1fr))' : 'minmax(0, 1fr)'};
    grid-auto-rows: min-content;
    gap: 10px;
    padding: 14px;
    overflow: auto;
`;

export const MediaTile = styled.button<{ $selected: boolean; $viewMode: 'grid' | 'list' }>`
    position: relative;
    min-width: 0;
    min-height: ${({ $viewMode }) => $viewMode === 'list' ? '54px' : 'auto'};
    display: ${({ $viewMode }) => $viewMode === 'list' ? 'grid' : 'block'};
    grid-template-columns: ${({ $viewMode }) => $viewMode === 'list' ? '52px minmax(0, 1fr)' : 'none'};
    align-items: center;
    padding: ${({ $viewMode }) => $viewMode === 'list' ? '5px' : '0 0 9px'};
    border: 1px solid ${({ theme, $selected }) => $selected ? theme.colors.accent.primary : theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    color: ${({ theme }) => theme.colors.text.primary};
    background: ${({ theme }) => theme.colors.bg.secondary};
    overflow: hidden;
    cursor: pointer;

    &:hover {
        border-color: ${({ theme }) => theme.colors.border.light};
    }

    &:focus-visible {
        outline: 2px solid ${({ theme }) => theme.colors.accent.primary};
        outline-offset: 2px;
    }

    > span {
        display: block;
        padding: ${({ $viewMode }) => $viewMode === 'list' ? '0 34px 0 10px' : '8px 9px 0'};
        font-size: 11px;
        font-weight: 600;
        text-align: left;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    > svg {
        position: absolute;
        top: 7px;
        right: 7px;
        padding: 2px;
        border-radius: 50%;
        color: ${({ theme }) => theme.colors.text.inverse};
        background: ${({ theme }) => theme.colors.accent.primary};
    }
`;

export const Preview = styled.div<{ $viewMode: 'grid' | 'list' }>`
    width: ${({ $viewMode }) => $viewMode === 'list' ? '52px' : '100%'};
    height: ${({ $viewMode }) => $viewMode === 'list' ? '42px' : '92px'};
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.text.tertiary};
    background: ${({ theme }) => theme.colors.bg.tertiary};
    border-radius: ${({ theme, $viewMode }) => $viewMode === 'list' ? theme.radius.sm : '0'};

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
`;

export const Empty = styled.div`
    display: grid;
    place-items: center;
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 12px;
`;

export const State = styled.div<{ $error?: boolean }>`
    padding: 12px;
    color: ${({ theme, $error }) => $error ? theme.colors.accent.error : theme.colors.text.tertiary};
    font-size: 11px;
`;
