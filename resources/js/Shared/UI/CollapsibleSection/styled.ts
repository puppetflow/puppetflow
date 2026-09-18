import styled, { css } from 'styled-components';

export type CollapsibleSize = 'sm' | 'md';

export const Section = styled.section<{ $open: boolean; $error: boolean }>`
    min-width: 0;
    overflow: hidden;
    background: ${({ theme }) => theme.colors.bg.secondary};
    border: 1px solid ${({ theme, $error }) => ($error ? `${theme.colors.accent.error}80` : theme.colors.border.default)};
    border-radius: ${({ theme }) => theme.radius.lg};
    transition: border-color ${({ theme }) => theme.transition.fast};

    ${({ $open, theme }) => $open && css`
        border-color: ${theme.colors.border.light};
    `}
`;

export const Header = styled.button<{ $size: CollapsibleSize }>`
    display: flex;
    align-items: center;
    gap: ${({ $size }) => ($size === 'sm' ? '10px' : '14px')};
    width: 100%;
    padding: ${({ $size }) => ($size === 'sm' ? '10px 12px' : '16px 20px')};
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    user-select: none;
    transition: background ${({ theme }) => theme.transition.fast};

    &:hover {
        background: ${({ theme }) => theme.colors.bg.hover};
    }

    &:focus-visible {
        outline: 2px solid ${({ theme }) => theme.colors.accent.primary};
        outline-offset: -2px;
    }
`;

export const IconBox = styled.span<{ $size: CollapsibleSize; $open: boolean }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: ${({ $size }) => ($size === 'sm' ? '26px' : '34px')};
    height: ${({ $size }) => ($size === 'sm' ? '26px' : '34px')};
    border-radius: ${({ theme }) => theme.radius.md};
    color: ${({ theme, $open }) => ($open ? theme.colors.accent.primary : theme.colors.text.secondary)};
    background: ${({ theme, $open }) => ($open ? `${theme.colors.accent.primary}1f` : theme.colors.bg.tertiary)};
    transition: background ${({ theme }) => theme.transition.fast}, color ${({ theme }) => theme.transition.fast};
`;

export const Heading = styled.span`
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
`;

export const Title = styled.span<{ $size: CollapsibleSize }>`
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: ${({ $size }) => ($size === 'sm' ? '12px' : '14px')};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text.primary};
    line-height: 1.3;

    /* The doc link is 28px tall by default; keep it inside the text line so every header has the same height. */
    > a {
        width: 18px;
        height: 18px;
        flex-basis: 18px;
        margin: -4px 0;

        svg {
            width: 13px;
            height: 13px;
        }
    }
`;

export const Description = styled.span<{ $size: CollapsibleSize }>`
    font-size: ${({ $size }) => ($size === 'sm' ? '11px' : '12px')};
    color: ${({ theme }) => theme.colors.text.tertiary};
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export const Badges = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
`;

export const Badge = styled.span<{ $tone: 'modified' | 'error' }>`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: ${({ theme, $tone }) => ($tone === 'error' ? theme.colors.accent.error : theme.colors.accent.warning)};
    background: ${({ theme, $tone }) => ($tone === 'error' ? theme.colors.accent.errorBg : theme.colors.accent.warningBg)};

    &::before {
        content: '';
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: currentColor;
    }
`;

export const Chevron = styled.span<{ $open: boolean }>`
    display: inline-flex;
    flex-shrink: 0;
    color: ${({ theme }) => theme.colors.text.tertiary};
    transform: rotate(${({ $open }) => ($open ? '180deg' : '0deg')});
    transition: transform ${({ theme }) => theme.transition.fast};
`;

export const Body = styled.div<{ $size: CollapsibleSize; $open: boolean }>`
    display: ${({ $open }) => ($open ? 'flex' : 'none')};
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    padding: ${({ $size }) => ($size === 'sm' ? '12px 12px 14px' : '18px 20px 22px')};
    border-top: 1px solid ${({ theme }) => theme.colors.border.default};
`;
