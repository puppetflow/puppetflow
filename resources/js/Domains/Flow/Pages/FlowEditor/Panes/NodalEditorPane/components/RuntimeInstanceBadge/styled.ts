import styled from 'styled-components';

export const Badge = styled.span<{ $size?: 'sm' | 'md' }>`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 100%;
    padding: ${({ $size = 'md' }) => ($size === 'sm' ? '2px 6px' : '4px 7px')};
    border-radius: ${({ theme }) => theme.radius.sm};
    border: 1px solid ${({ theme }) => theme.colors.accent.info};
    color: ${({ theme }) => theme.colors.accent.info};
    background: ${({ theme }) => theme.colors.accent.infoBg};
    font-size: ${({ $size = 'md' }) => ($size === 'sm' ? '10px' : '11px')};
    line-height: 1.2;
    user-select: text;
    cursor: help;

    svg,
    use {
        flex: 0 0 auto;
        pointer-events: none;
    }
`;

export const Title = styled.span`
    flex: 0 0 auto;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-size: 0.85em;
`;

export const Label = styled.strong`
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: ${({ theme }) => theme.colors.text.primary};
    font-family: ${({ theme }) => theme.font.mono};
    font-weight: 600;
`;
