import styled from 'styled-components';

export const Button = styled.button<{ $color?: string }>`
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    overflow: hidden;
    padding: 0;
    border-radius: 50%;
    border: 2px solid ${({ theme }) => theme.colors.bg.primary};
    color: ${({ $color, theme }) => $color ?? theme.colors.text.tertiary};
    background: ${({ theme }) => theme.colors.bg.secondary};
    box-shadow: 0 0 0 1px ${({ theme }) => theme.colors.border.default}, ${({ theme }) => theme.shadow.sm};
    cursor: pointer;
`;
