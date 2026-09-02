import styled from 'styled-components';

export const Preview = styled.div`
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
`;

export const PreviewContent = styled.div`
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
    padding: 12px;
    background: ${({ theme }) => theme.colors.bg.primary};

    > * {
        flex: 1;
        min-height: 0;
    }
`;
