import styled from 'styled-components';
import { TreeItemIconSlot, TreeItemRow } from '@/Shared/Explorer/TreeSidebar/components/shared.styled';

// Rendered as a button: a media row opens the metadata modal instead of navigating.
export const Row = styled(TreeItemRow)`
    width: 100%;
    text-align: left;
    background: none;
    border: 0;
    font: inherit;
`;

export const IconSlot = styled(TreeItemIconSlot)`
    > svg {
        width: 14px;
        height: 14px;
    }
`;

export const Thumbnail = styled.img`
    width: 16px;
    height: 16px;
    border-radius: 3px;
    object-fit: cover;
`;
