import styled from 'styled-components';

export {
    SelectRoot as Root,
    SelectTrigger as Trigger,
    SelectValue as Value,
    SelectValueLabel as ValueLabel,
    SelectIconSlot as IconSlot,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodeConfigModal/components/CustomSelect/styled';

export const Panel = styled.div`
    position: fixed;
    z-index: 10000;
    min-width: 0;
    max-width: calc(100vw - 24px);
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 5px;
    border-radius: ${({ theme }) => theme.radius.md};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.bg.primary};
    box-shadow: ${({ theme }) => theme.shadow.lg};
    overscroll-behavior: contain;
`;

export const Submenu = styled(Panel)<{ $positioned?: boolean }>`
    z-index: 10001;
    width: max-content;
    min-width: 200px;
    max-width: min(320px, calc(100vw - 24px));
    visibility: ${({ $positioned }) => ($positioned ? 'visible' : 'hidden')};
`;

export const Item = styled.button<{ $active?: boolean; $selected?: boolean }>`
    width: 100%;
    min-width: 0;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 8px 9px;
    border-radius: ${({ theme }) => theme.radius.sm};
    color: ${({ theme }) => theme.colors.text.primary};
    background: ${({ theme, $active }) => (
        $active
            ? `color-mix(in srgb, ${theme.colors.bg.hover} 55%, transparent)`
            : 'transparent'
    )};
    font-size: 12px;
    font-weight: ${({ $selected }) => ($selected ? 700 : 400)};
    text-align: left;
    cursor: pointer;

    > svg {
        flex-shrink: 0;
        color: ${({ theme }) => theme.colors.text.tertiary};
    }
`;

export const ItemLabel = styled.span`
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: inherit;
    pointer-events: none;
`;

export const ItemChevron = styled.span`
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    color: ${({ theme }) => theme.colors.text.tertiary};
    cursor: inherit;
    pointer-events: none;
`;

export const ItemCheck = styled.span`
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    color: ${({ theme }) => theme.colors.text.primary};
    cursor: inherit;
    pointer-events: none;
`;

export const SubmenuHeading = styled.div`
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px 7px;
    margin-bottom: 2px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.default};
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;

    svg {
        flex-shrink: 0;
    }
`;
