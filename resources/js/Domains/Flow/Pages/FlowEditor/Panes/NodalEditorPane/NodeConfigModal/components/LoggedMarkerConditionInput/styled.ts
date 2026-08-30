import styled from 'styled-components';
import { ExpressionField } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/ExpressionInput/styled';

export const Root = styled.div<{ $invalid?: boolean }>`
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border: 1px solid ${({ theme, $invalid }) => ($invalid ? '#ef4444' : theme.colors.border.default)};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.secondary};
    box-shadow: ${({ $invalid }) => ($invalid ? '0 0 0 2px #ef444426' : 'none')};
`;

export const Header = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 6px;

    label {
        display: block;
        margin-bottom: 3px;
        color: ${({ theme }) => theme.colors.text.primary};
        font-size: 12px;
        font-weight: 600;
    }
`;

export const Help = styled.div`
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: 12px;
    line-height: 1.4;
`;

export const Error = styled.div`
    color: #ef4444;
    font-size: 12px;
`;

export const RemoveButton = styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
    margin-top: 1px;
    padding: 0;
    border: 0;
    color: ${({ theme }) => theme.colors.text.tertiary};
    background: transparent;
    cursor: pointer;

    &:hover:not(:disabled) {
        color: #ef4444;
    }

    &:disabled {
        cursor: default;
        opacity: 0.4;
    }
`;

export const ConditionBlock = styled.div`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 8px;

    ${ExpressionField} {
        padding: 0;
    }
`;

export const ConditionLabel = styled.label`
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 12px;
    font-weight: 600;
`;

export const CountField = styled.div`
    display: block;
    width: 100%;

    ${ExpressionField} {
        display: flex;
        width: 100%;
        flex-direction: column;
        padding: 0;
        border: 0;
        background: transparent;
        box-shadow: none;
    }
`;
