import styled from 'styled-components';
import { MenuPanel } from '../../menu.styled';

export const Wrapper = styled.div.attrs<{ 'data-folder-item-menu'?: string }>({ 'data-folder-item-menu': '' })`
    position: relative;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity ${({ theme }) => theme.transition.fast};
`;

export const Button = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 22px;
    border: none;
    background: none;
    border-radius: ${({ theme }) => theme.radius.sm};
    color: ${({ theme }) => theme.colors.text.tertiary};
    cursor: pointer;
    transition: all ${({ theme }) => theme.transition.fast};

    &:hover {
        color: ${({ theme }) => theme.colors.text.primary};
        background: ${({ theme }) => theme.colors.bg.hover};
    }
`;

export const Menu = styled(MenuPanel)<{ $up?: boolean }>`
    position: absolute;
    ${({ $up }) => $up ? 'bottom: 100%;' : 'top: 100%;'}
    right: 0;
`;
