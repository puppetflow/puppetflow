import styled from 'styled-components';
import { renderStateText, type RenderStateProps } from './shared.styled';

export const ExpressionInlineRender = styled.div<RenderStateProps>`
    max-height: 92px;
    overflow: auto;
    margin-top: -1px;
    padding: 8px 10px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: 0 0 ${({ theme }) => theme.radius.md} ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.primary};
    color: ${({ theme }) => theme.colors.text.secondary};
    user-select: text;

    pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: ${({ theme }) => theme.font.mono};
        font-size: 11px;
        line-height: 1.45;
        user-select: text;
        ${renderStateText}
    }
`;
