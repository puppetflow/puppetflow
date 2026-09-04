import styled from 'styled-components';

export const Pane = styled.div`
    min-height: 0;
    display: flex;
    flex-direction: column;

    > * {
        flex: 1;
        min-height: 0;
    }

    [data-inspector-key] {
        color: ${({ theme }) => theme.colors.accent.primary};

        &:hover {
            background: ${({ theme }) => theme.colors.bg.hover};
        }
    }
`;

export const PreviewControls = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
`;

export const SourceSelector = styled.div`
    min-width: 0;
    flex: 1;
`;

export const ExecutionSelector = styled.div`
    width: 118px;
    flex: 0 0 118px;
`;
