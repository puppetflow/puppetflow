import styled from 'styled-components';

export const Root = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

export const Status = styled.div`
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 12px;
`;

export const ErrorMessage = styled.div`
    color: ${({ theme }) => theme.colors.accent.error};
    font-size: 12px;
`;

export const SelectionActions = styled.div`
    display: flex;
    gap: 6px;
`;

export const ToolList = styled.div`
    display: flex;
    max-height: 220px;
    flex-direction: column;
    gap: 4px;
    overflow: auto;
    padding: 4px;
    border: 1px solid ${({ theme }) => theme.colors.border.light};
    border-radius: ${({ theme }) => theme.radius.md};
`;

export const ToolOption = styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    padding: 7px;
    border-radius: ${({ theme }) => theme.radius.sm};

    &:nth-child(odd) {
        background: ${({ theme }) => theme.colors.bg.secondary};
    }

    &:nth-child(even) {
        background: ${({ theme }) => theme.colors.bg.primary};
    }

    &:hover {
        background: ${({ theme }) => theme.colors.bg.tertiary};
    }
`;

export const ToolName = styled.button`
    min-width: 0;
    padding: 0;
    border: 0;
    color: ${({ theme }) => theme.colors.text.primary};
    background: transparent;
    font-size: 12px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;

    &:disabled {
        cursor: default;
    }
`;
