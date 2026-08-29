import styled from 'styled-components';

export const ListingView = styled.div`
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    min-width: 0;
`;

export const Layout = styled.div`
    display: grid;
    grid-template-columns: 190px minmax(0, 1fr);
    gap: 16px;
    min-height: 0;
    min-width: 0;

    @media (max-width: 820px) {
        grid-template-columns: 1fr;
        gap: 12px;
    }
`;

export const ListingBody = styled.div`
    flex: 1;
    min-height: 0;
    min-width: 0;
    overflow-y: auto;
    padding-right: 4px;

    @media (max-width: 768px) {
        padding-right: 0;
    }
`;
