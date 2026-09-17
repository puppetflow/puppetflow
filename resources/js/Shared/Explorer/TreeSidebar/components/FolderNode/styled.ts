import styled from 'styled-components';
import { TreeIconSlot, TreeRow } from '../shared.styled';

// Hovering a folder swaps its icon for the overflow menu button.
export const Row = styled(TreeRow)`
    &:hover {
        ${TreeIconSlot} > svg {
            display: none;
        }
    }
`;
