import styled from 'styled-components';

export const Header = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 9px 10px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.default};

    strong {
        font-size: 12px;
        color: ${({ theme }) => theme.colors.text.primary};
    }
`;

export const SourceControl = styled.div`
    flex: 0 0 100%;
    min-width: 0;
`;

export const Actions = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
`;

export const ActionButton = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    border-radius: ${({ theme }) => theme.radius.sm};
    font-size: 10px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text.secondary};
    background: ${({ theme }) => theme.colors.bg.primary};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    cursor: pointer;

    &:hover {
        color: ${({ theme }) => theme.colors.text.primary};
        background: ${({ theme }) => theme.colors.bg.hover};
    }
`;

export const SystemToggle = styled.button<{ $active: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 23px;
    padding: 3px 5px;
    border: 1px solid ${({ theme, $active }) => (
        $active ? theme.colors.accent.primary : theme.colors.border.default
    )};
    border-radius: ${({ theme }) => theme.radius.sm};
    color: ${({ theme, $active }) => (
        $active ? theme.colors.accent.primary : theme.colors.text.tertiary
    )};
    background: ${({ theme, $active }) => (
        $active ? `${theme.colors.accent.primary}14` : theme.colors.bg.primary
    )};
    cursor: pointer;
    transition: border-color 120ms ease, color 120ms ease, background 120ms ease;

    &:hover,
    &:focus-visible {
        color: ${({ theme }) => theme.colors.text.primary};
        border-color: ${({ theme }) => theme.colors.text.tertiary};
        outline: none;
    }
`;

export const SystemMark = styled.span`
    width: 9px;
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 10px;
    font-weight: 800;
    line-height: 1;
    text-align: center;
`;

export const ToggleTrack = styled.span<{ $active: boolean }>`
    position: relative;
    width: 18px;
    height: 10px;
    border-radius: 999px;
    background: ${({ theme, $active }) => (
        $active ? theme.colors.accent.primary : theme.colors.border.hardened
    )};
    transition: background 120ms ease;
`;

export const ToggleThumb = styled.span<{ $active: boolean }>`
    position: absolute;
    top: 2px;
    left: 2px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.bg.primary};
    transform: translateX(${({ $active }) => ($active ? '8px' : '0')});
    transition: transform 120ms ease;
`;

export const Tooltip = styled.div`
    position: fixed;
    z-index: 1400;
    width: 280px;
    padding: 9px 11px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    color: ${({ theme }) => theme.colors.text.secondary};
    background: ${({ theme }) => theme.colors.bg.primary};
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.24);
    font-size: 11px;
    line-height: 1.45;
    pointer-events: none;

    &::before {
        content: '';
        position: absolute;
        top: -5px;
        left: 18px;
        width: 9px;
        height: 9px;
        border-top: 1px solid ${({ theme }) => theme.colors.border.default};
        border-left: 1px solid ${({ theme }) => theme.colors.border.default};
        background: ${({ theme }) => theme.colors.bg.primary};
        transform: rotate(45deg);
    }
`;

export const TooltipTitle = styled.strong`
    display: block;
    margin-bottom: 2px;
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 11px;
`;

export const Tabs = styled.div`
    display: inline-flex;
    gap: 2px;
`;

export const Tab = styled.button<{ $active?: boolean }>`
    padding: 3px 5px;
    border-radius: ${({ theme }) => theme.radius.sm};
    font-size: 10px;
    text-transform: capitalize;
    color: ${({ theme, $active }) => ($active ? theme.colors.text.primary : theme.colors.text.tertiary)};
    background: ${({ theme, $active }) => ($active ? theme.colors.bg.hover : 'transparent')};
    cursor: pointer;
`;
