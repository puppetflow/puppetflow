import styled from 'styled-components';

export const Wrapper = styled.div`
    display: flex;
    min-height: 0;
    overflow: hidden;
    flex: 1;
`;

export const Column = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
`;

export const CanvasLoader = styled.div`
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.text.tertiary};

    svg {
        animation: spin 0.9s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;

