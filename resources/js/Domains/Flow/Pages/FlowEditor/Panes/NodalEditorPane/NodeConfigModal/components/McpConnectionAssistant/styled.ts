import styled from 'styled-components';

export const Root = styled.div`
    display: flex;
    width: 100%;
    flex-direction: column;
`;

export const Header = styled.div`
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 10px;

    label {
        flex-shrink: 0;
    }
`;

export const Actions = styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 5px;
    flex-wrap: wrap;
`;

export const CredentialsActions = styled(Actions)`
    justify-content: flex-start;
    margin-top: 8px;
`;

export const ActionButton = styled.button<{ $success?: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 7px;
    border: 1px solid ${({ theme, $success }) => $success ? '#22c55e66' : theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.sm};
    color: ${({ theme, $success }) => $success ? '#16a34a' : theme.colors.text.secondary};
    background: ${({ theme }) => theme.colors.bg.secondary};
    font-size: 10px;
    font-weight: 650;
    cursor: pointer;

    &:hover:not(:disabled) {
        color: ${({ theme }) => theme.colors.text.primary};
        border-color: ${({ theme }) => theme.colors.brand};
    }

    &:disabled {
        opacity: 0.55;
        cursor: default;
    }
`;

export const Feedback = styled.div<{ $error?: boolean }>`
    width: 100%;
    margin-top: 5px;
    color: ${({ theme, $error }) => $error ? theme.colors.accent.error : theme.colors.text.secondary};
    font-size: 11px;
    line-height: 1.4;
`;

export const Form = styled.form`
    display: flex;
    flex-direction: column;
    gap: 14px;
`;

export const Field = styled.label`
    display: flex;
    flex-direction: column;
    gap: 6px;
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 12px;
    font-weight: 600;

    select,
    textarea {
        width: 100%;
        padding: 10px 11px;
        border: 1px solid ${({ theme }) => theme.colors.border.default};
        border-radius: ${({ theme }) => theme.radius.md};
        color: ${({ theme }) => theme.colors.text.primary};
        background: ${({ theme }) => theme.colors.bg.primary};
        font: inherit;
        font-weight: 400;
        outline: none;
    }

    textarea {
        min-height: 88px;
        resize: vertical;
        font-family: monospace;
    }
`;

export const Hint = styled.span`
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 11px;
    font-weight: 400;
`;

export const Error = styled.div`
    color: ${({ theme }) => theme.colors.accent.error};
    font-size: 12px;
`;

export const ModalActions = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 8px;
`;
