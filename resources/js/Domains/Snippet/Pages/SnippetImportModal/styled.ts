import styled from 'styled-components';

export {
    Footer,
    Form as ImportForm,
    FormPanel,
    FormScroller,
    Layout as ImportLayout,
    PreviewPanel,
} from '@/Shared/UI/PreviewModalLayout/styled';

export const Status = styled.div<{ $error?: boolean }>`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 10px;
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme, $error }) => $error ? `${theme.colors.accent.error}12` : theme.colors.bg.tertiary};
    color: ${({ theme, $error }) => $error ? theme.colors.accent.error : theme.colors.text.secondary};
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
