import styled from 'styled-components';

export const ImportForm = styled.form`
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
`;

export const ImportLayout = styled.div`
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
    gap: 1px;
    background: ${({ theme }) => theme.colors.border.default};

    @media (max-width: 768px) {
        flex-direction: column;
    }
`;

export const FormPanel = styled.div`
    display: flex;
    flex-direction: column;
    width: 430px;
    min-width: 360px;
    min-height: 0;
    background: ${({ theme }) => theme.colors.bg.secondary};

    @media (max-width: 768px) {
        width: 100%;
        min-width: 0;
        max-height: 48%;
    }
`;

export const FormScroller = styled.div`
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
    gap: 16px;
    padding: 18px;
    overflow-y: auto;
`;

export const PreviewPanel = styled.section`
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
    background: ${({ theme }) => theme.colors.bg.primary};
`;

export const Footer = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 18px;
    border-top: 1px solid ${({ theme }) => theme.colors.border.default};
    flex-shrink: 0;
`;

export const ResourceImportOption = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.secondary};
    color: ${({ theme }) => theme.colors.text.primary};
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
    margin-top: -8px;
    padding: 0 12px 12px 38px;
`;

export const MailboxMapping = styled.label`
    display: grid;
    grid-template-columns: minmax(140px, 1fr) minmax(220px, 2fr);
    align-items: center;
    gap: 12px;
`;

export const MailboxMappingLabel = styled.span`
    overflow: hidden;
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export const MailboxSelect = styled.select`
    min-width: 0;
    padding: 7px 9px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.sm};
    background: ${({ theme }) => theme.colors.bg.primary};
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 12px;
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
