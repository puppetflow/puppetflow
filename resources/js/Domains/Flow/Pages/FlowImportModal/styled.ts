import styled from 'styled-components';

export {
    Footer,
    Form as ImportForm,
    FormPanel,
    FormScroller,
    Layout as ImportLayout,
    PreviewPanel,
} from '@/Shared/UI/PreviewModalLayout/styled';

export const ResourceImportOption = styled.label`
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.primary};
    color: ${({ theme }) => theme.colors.text.primary};
    cursor: pointer;
`;

export const MailboxImportOption = styled.div`
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

export const MailboxMappings = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 12px 0 0 42px;
    padding-top: 12px;
    border-top: 1px solid ${({ theme }) => theme.colors.border.default};
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
