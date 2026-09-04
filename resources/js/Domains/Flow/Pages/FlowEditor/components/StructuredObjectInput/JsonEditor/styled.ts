import styled from 'styled-components';

export const EditorWrapper = styled.div`
    box-sizing: border-box;
    background: ${({ theme }) => theme.colors.bg.primary};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    overflow: hidden;

    > div {
        height: 100%;
    }
`;
