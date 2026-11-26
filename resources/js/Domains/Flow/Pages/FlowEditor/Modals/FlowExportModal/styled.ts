import styled from 'styled-components';

export {
    DataTableImportColumns as ResourceMeta,
    DataTableImportItem as ResourceItem,
    DataTableImportName as ResourceName,
    ResourceImportCard as ResourceCard,
    ResourceImportDescription as ResourceDescription,
    ResourceImportDetails as ResourceDetails,
    ResourceImportHeader as ResourceHeader,
    ResourceImportText as ResourceText,
    ResourceImportTitle as ResourceTitle,
    SnippetImportIcon as ResourceIcon,
} from '@/Domains/Flow/Pages/FlowImportModal/styled';

export const Body = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

export const Summary = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.secondary};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: 12px;

    strong {
        color: ${({ theme }) => theme.colors.text.primary};
    }
`;
