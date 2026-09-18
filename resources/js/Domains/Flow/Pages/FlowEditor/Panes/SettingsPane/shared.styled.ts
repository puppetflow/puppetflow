import { css } from 'styled-components';

export const settingsSeparatorStyles = css`
    border: none;
    border-top: 1px solid ${({ theme }) => theme.colors.border.default};
    margin: 4px 0;
`;

export const settingsSectionLabelStyles = css`
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: ${({ theme }) => theme.colors.text.tertiary};
`;

export const settingsHintStyles = css`
    font-size: 11px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    line-height: 1.4;
    margin-top: -8px;
`;
