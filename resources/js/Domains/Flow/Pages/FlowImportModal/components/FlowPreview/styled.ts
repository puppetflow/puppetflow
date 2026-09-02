import styled from 'styled-components';

export const Preview = styled.div`
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
`;

export const PreviewHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 45px;
    padding: 0 16px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.bg.secondary};
`;

export const PreviewHeading = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 12px;
    font-weight: 650;

    svg {
        color: ${({ theme }) => theme.colors.accent.primary};
    }
`;

export const ReadOnlyBadge = styled.span`
    padding: 3px 7px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: 999px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
`;

export const ResourceBar = styled.div`
    display: flex;
    gap: 10px;
    padding: 10px 12px;
    overflow-x: auto;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.bg.tertiary};
`;

export const ResourceSummary = styled.div`
    min-width: 210px;
    max-width: 360px;
    padding: 8px 10px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.secondary};
`;

export const ResourceSummaryTitle = styled.strong`
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 12px;
`;

export const ResourceList = styled.ul`
    margin: 4px 0 0;
    padding-left: 18px;
    max-height: 54px;
    overflow-y: auto;
`;

export const ResourceItem = styled.li`
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: 12px;
`;

export const PreviewContent = styled.div`
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
    padding: 12px;
    background: ${({ theme }) => theme.colors.bg.primary};

    > * {
        flex: 1;
        min-height: 0;
    }
`;
