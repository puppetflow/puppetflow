import styled from 'styled-components';

export const Form = styled.form`
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
`;

export const Layout = styled.div`
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

export const DestinationFields = styled.div`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;

    @media (max-width: 680px) {
        grid-template-columns: 1fr;
    }
`;

export const ErrorBox = styled.div`
    padding: 10px 12px;
    border: 1px solid ${({ theme }) => theme.colors.accent.error}40;
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.accent.errorBg};
    color: ${({ theme }) => theme.colors.accent.error};
    font-size: 13px;
`;

export const Footer = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 12px 18px;
    border-top: 1px solid ${({ theme }) => theme.colors.border.default};
    flex-shrink: 0;
`;
