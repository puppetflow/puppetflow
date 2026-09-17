import styled from 'styled-components';

export const Details = styled.details`
    overflow: hidden;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.secondary};

    &[open] summary svg {
        transform: rotate(180deg);
    }
`;

export const Summary = styled.summary`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 12px;
    font-weight: 650;
    cursor: pointer;
    list-style: none;
    user-select: none;

    &::-webkit-details-marker {
        display: none;
    }

    svg {
        color: ${({ theme }) => theme.colors.text.tertiary};
        transition: transform ${({ theme }) => theme.transition.fast};
    }
`;

export const Content = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    border-top: 1px solid ${({ theme }) => theme.colors.border.light};
`;
