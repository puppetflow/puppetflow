import styled from 'styled-components';

export {
    Footer,
    Form as ImportForm,
    FormPanel,
    FormScroller,
    Layout as ImportLayout,
    PreviewPanel,
} from '@/Shared/UI/PreviewModalLayout/styled';

export const ResourceImportCard = styled.div`
    padding: 12px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.primary};
`;

export const ResourceImportHeader = styled.label`
    display: flex;
    align-items: flex-start;
    gap: 10px;
    color: ${({ theme }) => theme.colors.text.primary};
    cursor: pointer;
`;

export const ResourceImportText = styled.span`
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

export const ResourceImportTitle = styled.strong`
    font-size: 13px;
`;

export const ResourceImportDescription = styled.span`
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: 12px;
`;

export const ResourceImportDetails = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 12px 0 0 42px;
    padding-top: 12px;
    border-top: 1px solid ${({ theme }) => theme.colors.border.default};
`;

export const DataTableImportItem = styled.div`
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
`;

export const DataTableImportName = styled.strong`
    overflow: hidden;
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export const DataTableImportColumns = styled.span`
    flex-shrink: 0;
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 11px;
`;

export const DataTableImportMeta = styled.span`
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 5px;
`;

export const SchemaInfo = styled.span`
    position: relative;
    display: inline-flex;

    &:hover > [role='tooltip'],
    &:focus-within > [role='tooltip'] {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
    }
`;

export const SchemaInfoButton = styled.button`
    display: inline-flex;
    width: 16px;
    height: 16px;
    align-items: center;
    justify-content: center;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.bg.secondary};
    color: ${({ theme }) => theme.colors.text.tertiary};
    cursor: help;

    &:hover,
    &:focus-visible {
        border-color: ${({ theme }) => theme.colors.accent.primary};
        color: ${({ theme }) => theme.colors.accent.primary};
        outline: none;
    }
`;

export const SchemaTooltip = styled.span`
    position: absolute;
    right: -8px;
    bottom: calc(100% + 9px);
    z-index: 30;
    display: block;
    width: 240px;
    padding: 10px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.elevated};
    box-shadow: ${({ theme }) => theme.shadow.lg};
    opacity: 0;
    transform: translateY(4px);
    pointer-events: none;
    transition: opacity ${({ theme }) => theme.transition.fast}, transform ${({ theme }) => theme.transition.fast};

    &::after {
        content: '';
        position: absolute;
        right: 11px;
        bottom: -5px;
        width: 9px;
        height: 9px;
        transform: rotate(45deg);
        border-right: 1px solid ${({ theme }) => theme.colors.border.default};
        border-bottom: 1px solid ${({ theme }) => theme.colors.border.default};
        background: ${({ theme }) => theme.colors.bg.elevated};
    }
`;

export const SchemaTooltipTitle = styled.strong`
    display: block;
    margin-bottom: 8px;
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 11px;
`;

export const SchemaColumnList = styled.span`
    display: flex;
    max-height: 180px;
    flex-direction: column;
    gap: 3px;
    overflow-y: auto;
`;

export const SchemaColumn = styled.span`
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 5px 7px;
    border-radius: ${({ theme }) => theme.radius.sm};
    background: ${({ theme }) => theme.colors.bg.secondary};
`;

export const SchemaColumnName = styled.span`
    overflow: hidden;
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export const SchemaColumnType = styled.span`
    flex-shrink: 0;
    color: ${({ theme }) => theme.colors.accent.primary};
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 9px;
    font-weight: 600;
`;

export const MailboxMapping = styled.label`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 6px;
`;

export const MailboxMappingLabel = styled.span`
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 12px;
    font-weight: 600;
`;

export const PreviewPlaceholder = styled.div`
    display: flex;
    flex: 1;
    min-height: 0;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    padding: 32px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    text-align: center;
`;

export const PreviewPlaceholderIcon = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;

    span {
        padding: 6px 9px;
        border: 1px solid ${({ theme }) => theme.colors.border.default};
        border-radius: ${({ theme }) => theme.radius.md};
        background: ${({ theme }) => theme.colors.bg.tertiary};
        font-family: ${({ theme }) => theme.font.mono};
        font-size: 11px;
        font-weight: 650;
    }

    span:nth-child(2) {
        padding: 0;
        border: 0;
        background: transparent;
        color: ${({ theme }) => theme.colors.accent.primary};
        font-family: inherit;
        font-size: 15px;
    }
`;

export const PreviewPlaceholderTitle = styled.strong`
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 14px;
`;

export const PreviewPlaceholderText = styled.p`
    max-width: 320px;
    margin: 6px 0 0;
    font-size: 12px;
    line-height: 1.5;
`;
