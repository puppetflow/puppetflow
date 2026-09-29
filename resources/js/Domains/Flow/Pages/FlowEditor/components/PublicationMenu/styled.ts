import styled from 'styled-components';

export const Wrapper = styled.div`
    position: relative;
`;

export const Trigger = styled.button<{ $error: boolean }>`
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    padding: 0 10px;
    border: 1px solid ${({ theme, $error }) => (
        $error
            ? theme.colors.accent.error
            : theme.colors.border.default
    )};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.primary};
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;

    &:disabled {
        cursor: default;
        opacity: 0.7;
    }
`;

// Keeps the regular content in the layout so the trigger width does not change while busy.
export const TriggerContent = styled.span<{ $hidden: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    visibility: ${({ $hidden }) => ($hidden ? 'hidden' : 'visible')};
`;

export const Spinner = styled.span`
    position: absolute;
    top: 50%;
    left: 50%;
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: publication-spin 0.6s linear infinite;

    @keyframes publication-spin {
        from { transform: translate(-50%, -50%) rotate(0deg); }
        to { transform: translate(-50%, -50%) rotate(360deg); }
    }
`;

export const OutOfSyncDot = styled.span`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.accent.warning};
    flex-shrink: 0;
`;

// Read-only status row explaining why the trigger shows the out-of-sync dot.
export const StatusItem = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 9px;
    border-radius: 6px;
    background: ${({ theme }) => theme.colors.bg.tertiary};
    color: ${({ theme }) => theme.colors.accent.warning};
    font-size: 12px;
    line-height: 1.35;

    svg {
        flex-shrink: 0;
        margin-top: 1px;
    }
`;

export const StatusText = styled.span`
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: ${({ theme }) => theme.colors.text.primary};

    small {
        color: ${({ theme }) => theme.colors.text.secondary};
        font-size: 11px;
    }
`;

export const Menu = styled.div`
    position: fixed;
    z-index: 2000;
    min-width: 210px;
    padding: 5px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.secondary};
    box-shadow: ${({ theme }) => theme.shadow.lg};
`;

export const MenuItem = styled.button<{ $danger?: boolean }>`
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 9px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: ${({ theme, $danger }) => $danger ? theme.colors.accent.error : theme.colors.text.primary};
    font-size: 12px;
    text-align: left;
    cursor: pointer;

    &:hover:not(:disabled) {
        background: ${({ theme }) => theme.colors.bg.tertiary};
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.45;
    }
`;

export const Divider = styled.div`
    height: 1px;
    margin: 4px 2px;
    background: ${({ theme }) => theme.colors.border.default};
`;
