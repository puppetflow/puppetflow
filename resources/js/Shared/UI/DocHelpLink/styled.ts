import styled from 'styled-components';

export const Link = styled.a`
    display: inline-flex;
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: ${({ theme }) => theme.colors.text.tertiary};
    text-decoration: none;
    cursor: pointer !important;
    transition:
        background ${({ theme }) => theme.transition.fast},
        color ${({ theme }) => theme.transition.fast};

    &:hover {
        background: ${({ theme }) => theme.colors.bg.hover};
        color: ${({ theme }) => theme.colors.text.primary};
    }

    &:focus-visible {
        outline: 2px solid ${({ theme }) => theme.colors.border.focus};
        outline-offset: 2px;
    }
`;

