import styled from 'styled-components';

export const ModalForm = styled.form`
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

export const Actions = styled.div`
    display: flex;
    justify-content: flex-end;
`;

export const ErrorText = styled.div`
    color: ${({ theme }) => theme.colors.accent.error};
    font-size: 12px;
`;
