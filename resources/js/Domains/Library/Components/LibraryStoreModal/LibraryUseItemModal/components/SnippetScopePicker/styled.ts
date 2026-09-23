import styled from 'styled-components';

export const Wrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

export const Section = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

export const Label = styled.label`
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: 12px;
    font-weight: 600;
`;
