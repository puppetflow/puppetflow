import styled from 'styled-components';

export const WorkspaceList = styled.div`
    display: grid;
    gap: 8px;
`;

export const WorkspaceOption = styled.button<{ $active: boolean }>`
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 14px;
    border: 1px solid ${({ $active, theme }) => $active ? theme.colors.brand : theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ $active, theme }) => $active
        ? `color-mix(in srgb, ${theme.colors.brand} 10%, ${theme.colors.bg.primary})`
        : theme.colors.bg.primary};
    color: ${({ theme }) => theme.colors.text.primary};
    cursor: pointer;
    font: inherit;
    text-align: left;
    transition:
        border-color ${({ theme }) => theme.transition.fast},
        background ${({ theme }) => theme.transition.fast};

    &:hover {
        border-color: ${({ $active, theme }) => $active ? theme.colors.brand : theme.colors.border.light};
        background: ${({ $active, theme }) => $active
            ? `color-mix(in srgb, ${theme.colors.brand} 14%, ${theme.colors.bg.primary})`
            : theme.colors.bg.hover};
    }

    &:focus-visible {
        outline: 2px solid ${({ theme }) => theme.colors.brand};
        outline-offset: 2px;
    }
`;

export const SelectionMark = styled.span`
    width: 16px;
    height: 16px;
    flex: 0 0 auto;
    border: 1px solid ${({ theme }) => theme.colors.border.light};
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.bg.secondary};
    transition: border-color ${({ theme }) => theme.transition.fast};

    button[aria-checked='true'] & {
        border: 5px solid ${({ theme }) => theme.colors.brand};
    }
`;

export const WorkspaceText = styled.span`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2px;

    strong {
        overflow: hidden;
        color: ${({ theme }) => theme.colors.text.primary};
        font-size: 13px;
        font-weight: 600;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    span {
        color: ${({ theme }) => theme.colors.text.tertiary};
        font-family: ${({ theme }) => theme.font.mono};
        font-size: 11px;
    }
`;

export const Notice = styled.p`
    margin: 0;
    padding: 12px 14px;
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.tertiary};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: 12px;
    line-height: 1.5;
`;

export const ErrorText = styled.span`
    color: ${({ theme }) => theme.colors.accent.error};
    font-size: 12px;
`;

export const Identity = styled.span`
    strong {
        color: ${({ theme }) => theme.colors.text.secondary};
        font-weight: 500;
    }
`;
