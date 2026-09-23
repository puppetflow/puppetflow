import styled from 'styled-components';

export const Section = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
`;

export const Hint = styled.div`
    font-size: 11px;
    color: ${({ theme }) => theme.colors.text.tertiary};
`;

export const Divider = styled.div`
    height: 1px;
    margin: 14px 0 12px;
    background: ${({ theme }) => theme.colors.border.default};
`;
