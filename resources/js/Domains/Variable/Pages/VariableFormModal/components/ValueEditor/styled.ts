import styled from 'styled-components';

export const JsonField = styled.div``;

export const Label = styled.label`
    display: block;
    font-size: 12px;
    font-weight: 500;
    margin-bottom: 4px;
`;

export const JsonEditorWrapper = styled.div`
    height: 200px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    overflow: hidden;
`;

export const Error = styled.div`
    margin-top: 4px;
    color: var(--accent-error, #ef4444);
    font-size: 12px;
`;

export const Hint = styled.div`
    margin-top: 4px;
    color: var(--text-tertiary, #888);
    font-size: 11px;
`;

export const McpFields = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

export const Field = styled.label`
    display: flex;
    flex-direction: column;
    gap: 5px;
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: 12px;
    font-weight: 500;

    select,
    textarea {
        width: 100%;
        box-sizing: border-box;
        padding: 9px 10px;
        border: 1px solid ${({ theme }) => theme.colors.border.default};
        border-radius: ${({ theme }) => theme.radius.md};
        color: ${({ theme }) => theme.colors.text.primary};
        background: ${({ theme }) => theme.colors.bg.primary};
        font: inherit;
        outline: none;
    }

    textarea {
        min-height: 92px;
        resize: vertical;
        font-family: ${({ theme }) => theme.font.mono};
    }

    select:focus,
    textarea:focus {
        border-color: ${({ theme }) => theme.colors.border.focus};
    }
`;

