import styled from 'styled-components';

export const Sections = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

export const Section = styled.section`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

export const SectionTitle = styled.h4`
    margin: 0;
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
`;

export const StorageTable = styled.table`
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    overflow: hidden;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 12px;
`;

export const StorageRow = styled.tr<{ $total?: boolean }>`
    background: ${({ theme, $total }) => (
        $total ? theme.colors.bg.secondary : theme.colors.bg.primary
    )};
    font-weight: ${({ $total }) => ($total ? 600 : 400)};

    &:not(:last-child) > * {
        border-bottom: 1px solid ${({ theme }) => theme.colors.border.default};
    }
`;

export const StorageLabel = styled.td`
    padding: 10px 12px;
`;

export const StorageValue = styled.td`
    padding: 10px 12px;
    text-align: right;
    font-family: ${({ theme }) => theme.font.mono};
    font-variant-numeric: tabular-nums;
`;
