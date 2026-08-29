import styled from 'styled-components';

export const SettingsTabsScroller = styled.div`
    flex: 0 0 auto;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    margin-bottom: 24px;
    border-bottom: 1px solid var(--pf-border-default);
    overflow-x: auto;
    overflow-y: clip;
    -webkit-overflow-scrolling: touch;
`;

export const SettingsTabs = styled.div`
    display: inline-flex;
    min-width: max-content;
    gap: 2px;
`;

export const SettingsTab = styled.button<{ $active?: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    padding: 10px 16px;
    font-size: 13px;
    font-weight: ${({ $active }) => $active ? 600 : 500};
    white-space: nowrap;
    color: ${({ theme, $active }) => $active ? theme.colors.accent.primary : theme.colors.text.secondary};
    border-bottom: 2px solid ${({ theme, $active }) => $active ? theme.colors.accent.primary : 'transparent'};
    margin-bottom: -1px;
    transition: color ${({ theme }) => theme.transition.fast}, border-color ${({ theme }) => theme.transition.fast};

    &:hover {
        color: ${({ theme, $active }) => $active ? theme.colors.accent.primary : theme.colors.text.primary};
    }
`;

export const PageTabsDesktop = styled(SettingsTabsScroller)`
    @media (max-width: 768px) {
        display: none;
    }
`;

export const PageTabsMobile = styled.nav`
    display: none;

    @media (max-width: 768px) {
        position: fixed;
        z-index: 100;
        right: 0;
        bottom: 0;
        left: 0;
        display: flex;
        height: 52px;
        min-height: 52px;
        border-top: 1px solid ${({ theme }) => theme.colors.border.default};
        background: ${({ theme }) => theme.colors.bg.secondary};
    }
`;

export const PageTabsMobileButton = styled.button<{ $active: boolean }>`
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 0 4px;
    border: 0;
    background: transparent;
    color: ${({ $active, theme }) => $active ? theme.colors.accent.primary : theme.colors.text.tertiary};
    cursor: pointer;
    transition: color ${({ theme }) => theme.transition.fast};

    svg {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
    }

    span {
        max-width: 100%;
        overflow: hidden;
        font-size: 10px;
        font-weight: 500;
        line-height: 1;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    &:active {
        color: ${({ theme }) => theme.colors.accent.primary};
    }
`;
