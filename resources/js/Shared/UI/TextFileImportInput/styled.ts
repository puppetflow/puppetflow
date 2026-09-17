import styled from 'styled-components';

export const EditorToggle = styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-bottom: 8px;
`;

export const Editor = styled.textarea<{ $hasError?: boolean }>`
    width: 100%;
    min-height: 180px;
    padding: 10px 12px;
    border: 1px solid ${({ theme, $hasError }) => $hasError ? theme.colors.accent.error : theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.primary};
    color: ${({ theme }) => theme.colors.text.primary};
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 12px;
    margin-bottom: 8px;
    resize: vertical;

    &:focus {
        outline: none;
        border-color: ${({ theme }) => theme.colors.border.focus};
    }
`;
