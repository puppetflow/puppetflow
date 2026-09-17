import styled from 'styled-components';
import { MenuPanel } from '../../../menu.styled';

export const Button = styled.button.attrs<{ 'data-sidebar-overflow-button'?: string }>({ 'data-sidebar-overflow-button': '' })`
    display: none;
    align-items: center;
    justify-content: center;
    width: 15px;
    height: 15px;
    border: none;
    background: none;
    border-radius: 3px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    cursor: pointer;
    flex-shrink: 0;

    &:hover {
        color: ${({ theme }) => theme.colors.text.primary};
    }

    svg {
        width: 13px;
        height: 13px;
    }
`;

// Portaled next to the button, so it escapes the sidebar's overflow clipping.
export const Menu = styled(MenuPanel)`
    position: fixed;
    z-index: 100;
`;
