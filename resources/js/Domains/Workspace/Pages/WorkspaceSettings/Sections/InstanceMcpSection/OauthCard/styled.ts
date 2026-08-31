import styled from 'styled-components';

export const SectionHint = styled.div`
    font-size: 12px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    margin-top: -10px;
    line-height: 1.45;
`;

export const Form = styled.form`
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 12px;
    min-width: 0;
`;

export const ModeLabel = styled.div`
    display: inline-flex;
    width: fit-content;
    align-items: center;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: 999px;
    background: ${({ theme }) => theme.colors.bg.tertiary};
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    margin-bottom: 12px;
    padding: 3px 8px;
    text-transform: uppercase;
`;

export const EndpointGrid = styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    min-width: 0;
`;

export const ClientForm = styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    min-width: 0;

    > button {
        justify-self: start;
    }
`;

export const ClientsPane = styled.div`
    min-width: 0;
    margin-top: 18px;
`;

export const PaneSwitcher = styled.div`
    display: inline-flex;
    max-width: 100%;
    padding: 3px;
    gap: 3px;
    overflow-x: auto;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.tertiary};
`;

export const PaneButton = styled.button<{ $active: boolean }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    flex: 1 0 auto;
    padding: 7px 11px;
    border-radius: ${({ theme }) => theme.radius.sm};
    color: ${({ theme, $active }) => $active ? theme.colors.text.primary : theme.colors.text.tertiary};
    background: ${({ theme, $active }) => $active ? theme.colors.bg.primary : 'transparent'};
    font-size: 13px;
    font-weight: ${({ $active }) => $active ? 600 : 500};
    white-space: nowrap;
    cursor: pointer;
    transition:
        color ${({ theme }) => theme.transition.fast},
        background ${({ theme }) => theme.transition.fast};

    &:hover {
        color: ${({ theme }) => theme.colors.text.primary};
    }

    &:focus-visible {
        outline: 2px solid ${({ theme }) => theme.colors.accent.primary};
        outline-offset: 1px;
    }
`;

export const PaneCount = styled.span`
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 11px;
    font-variant-numeric: tabular-nums;
`;

export const TableViewport = styled.div`
    width: 100%;
    max-width: 100%;
    max-height: 320px;
    min-width: 0;
    margin-top: 12px;
    overflow: auto;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.primary};
    scrollbar-gutter: stable;
`;

export const ClientTable = styled.table`
    width: 100%;
    min-width: 760px;
    border-collapse: separate;
    border-spacing: 0;

    th {
        position: sticky;
        z-index: 1;
        top: 0;
        padding: 9px 12px;
        border-bottom: 1px solid ${({ theme }) => theme.colors.border.default};
        color: ${({ theme }) => theme.colors.text.tertiary};
        background: ${({ theme }) => theme.colors.bg.secondary};
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-align: left;
        text-transform: uppercase;
        white-space: nowrap;
    }

    td {
        padding: 10px 12px;
        border-bottom: 1px solid ${({ theme }) => theme.colors.border.default};
        color: ${({ theme }) => theme.colors.text.secondary};
        background: ${({ theme }) => theme.colors.bg.primary};
        font-size: 12px;
        white-space: nowrap;
        vertical-align: middle;
    }

    tbody tr:last-child td {
        border-bottom: 0;
    }

    tbody tr:hover td {
        background: ${({ theme }) => theme.colors.bg.secondary};
    }
`;

export const CodeValue = styled.code`
    display: block;
    max-width: 190px;
    overflow: hidden;
    color: ${({ theme }) => theme.colors.text.secondary};
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export const TruncatedValue = styled.span`
    display: block;
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export const ActionCell = styled.td`
    width: 1%;
    text-align: right;
`;

export const EmptyCell = styled.td`
    height: 92px;
    color: ${({ theme }) => theme.colors.text.tertiary} !important;
    text-align: center;
`;

export const SubsectionTitle = styled.h3`
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 10px;
`;
