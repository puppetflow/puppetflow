import styled from 'styled-components';

export const StoreContent = styled.div`
    display: flex;
    min-width: 0;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    overflow: hidden;
    padding: 20px;

    @media (max-width: 768px) {
        padding: 12px;
    }
`;
