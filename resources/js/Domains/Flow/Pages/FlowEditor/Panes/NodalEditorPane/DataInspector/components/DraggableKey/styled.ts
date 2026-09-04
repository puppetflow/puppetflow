import styled from 'styled-components';

export const JsonKey = styled.span<{ $draggable: boolean }>`
    color: ${({ theme }) => theme.colors.accent.primary};
    cursor: ${({ $draggable }) => $draggable ? 'grab' : 'default'};
    border-radius: ${({ theme }) => theme.radius.sm};

    &:hover {
        background: ${({ theme, $draggable }) => $draggable ? `${theme.colors.accent.primary}14` : 'transparent'};
    }
`;
