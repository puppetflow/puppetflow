import styled from 'styled-components';

// Popup menu primitives shared by the tree sidebar and the folder cards.
export const MenuPanel = styled.div`
    z-index: 50;
    min-width: 150px;
    padding: 4px;
    background: ${({ theme }) => theme.colors.bg.secondary};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    box-shadow: ${({ theme }) => theme.shadow.lg};
    animation: explorerMenuIn 100ms ease;

    @keyframes explorerMenuIn {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;

export const MenuItem = styled.button<{ $danger?: boolean }>`
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    border: none;
    background: none;
    border-radius: ${({ theme }) => theme.radius.sm};
    font-size: 12px;
    white-space: nowrap;
    color: ${({ theme, $danger }) => $danger ? theme.colors.accent.error : theme.colors.text.primary};
    cursor: pointer;
    transition: background ${({ theme }) => theme.transition.fast};

    svg {
        flex-shrink: 0;
        color: ${({ theme, $danger }) => $danger ? theme.colors.accent.error : theme.colors.text.tertiary};
    }

    &:hover {
        background: ${({ theme, $danger }) => $danger ? theme.colors.accent.errorBg : theme.colors.bg.hover};
    }
`;

export const MenuDivider = styled.div`
    height: 1px;
    margin: 4px 0;
    background: ${({ theme }) => theme.colors.border.default};
`;
