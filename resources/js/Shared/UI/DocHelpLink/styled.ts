import styled from 'styled-components';

export const Link = styled.a<{ $withText?: boolean }>`
    display: inline-flex;
    width: ${({ $withText }) => ($withText ? 'fit-content' : '28px')};
    height: ${({ $withText }) => ($withText ? 'auto' : '28px')};
    flex: ${({ $withText }) => ($withText ? '0 1 auto' : '0 0 28px')};
    align-items: center;
    justify-content: center;
    gap: ${({ $withText }) => ($withText ? '5px' : '0')};
    padding: ${({ $withText }) => ($withText ? '2px 3px' : '0')};
    border-radius: ${({ theme, $withText }) => ($withText ? theme.radius.sm : '50%')};
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 11px;
    line-height: 1.35;
    text-decoration: none;
    cursor: pointer !important;
    transition:
        background ${({ theme }) => theme.transition.fast},
        color ${({ theme }) => theme.transition.fast};

    svg {
        flex-shrink: 0;
    }

    &:hover {
        background: ${({ theme }) => theme.colors.bg.hover};
        color: ${({ theme }) => theme.colors.text.primary};
    }

    &:focus-visible {
        outline: 2px solid ${({ theme }) => theme.colors.border.focus};
        outline-offset: 2px;
    }
`;

