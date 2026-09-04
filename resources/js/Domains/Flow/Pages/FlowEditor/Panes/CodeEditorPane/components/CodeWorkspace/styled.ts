import styled from 'styled-components';

export const CodePane = styled.div<{ $readOnly?: boolean }>`
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;

    .cm-lintRange-error {
        background-color: ${({ theme }) => theme.mode === 'dark'
            ? 'rgba(239, 68, 68, 0.12)'
            : 'rgba(220, 38, 38, 0.09)'};
    }

    ${({ $readOnly, theme }) => $readOnly && `
        .cm-editor,
        .cm-scroller,
        .cm-gutters {
            background-color: ${theme.mode === 'dark' ? '#15151a' : theme.colors.bg.tertiary} !important;
        }
    `}
`;
