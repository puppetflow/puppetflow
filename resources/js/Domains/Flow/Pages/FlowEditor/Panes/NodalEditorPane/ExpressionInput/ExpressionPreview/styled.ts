import styled from 'styled-components';

// A span rather than a pre, so the container's pre color rules do not apply.
export const UndefinedValue = styled.span`
    display: block;
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 11px;
    font-style: italic;
    line-height: 1.45;
`;

export const ExpressionMixedPreview = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    color: ${({ theme }) => theme.colors.text.secondary};
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 11px;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
    user-select: text;
`;
