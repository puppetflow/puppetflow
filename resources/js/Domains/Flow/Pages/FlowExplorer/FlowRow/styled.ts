import styled from 'styled-components';
import { TreeItemIconSlot, TreeItemRow } from '@/Shared/Explorer/TreeSidebar/components/shared.styled';

export const IconSlot = styled(TreeItemIconSlot)`
    > span:first-child {
        display: inline-flex;
    }
`;

// The flow icon gives way to the overflow button on hover.
export const Row = styled(TreeItemRow)`
    &:hover {
        ${IconSlot} > span:first-child {
            display: none;
        }
    }
`;

export const ImportedBadge = styled.span`
    position: absolute;
    left: -15px;
    top: 2px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 12px;
    height: 12px;
    border-radius: 4px;
    padding: 1px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    background: ${({ theme }) => theme.colors.bg.tertiary};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
`;
