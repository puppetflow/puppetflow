import styled from 'styled-components';

export {
    Footer,
    Form,
    FormPanel,
    FormScroller,
    Layout,
    PreviewPanel,
} from '@/Shared/UI/PreviewModalLayout/styled';

export const OwnerSection = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

export const OwnerLabel = styled.span`
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: 12px;
    font-weight: 600;
`;

export const DependencyIcon = styled.span`
    display: inline-flex;
    margin-right: 6px;
    color: ${({ theme }) => theme.colors.accent.primary};
    vertical-align: -2px;
`;

export const DependencyState = styled.span<{ $installed: boolean }>`
    flex-shrink: 0;
    padding: 2px 7px;
    border-radius: ${({ theme }) => theme.radius.sm};
    background: ${({ theme, $installed }) => ($installed ? theme.colors.accent.success : theme.colors.accent.info)}22;
    color: ${({ theme, $installed }) => ($installed ? theme.colors.accent.success : theme.colors.accent.info)};
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
`;

export const ErrorBox = styled.div`
    padding: 10px 12px;
    border: 1px solid ${({ theme }) => theme.colors.accent.error}40;
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.accent.errorBg};
    color: ${({ theme }) => theme.colors.accent.error};
    font-size: 13px;
`;

