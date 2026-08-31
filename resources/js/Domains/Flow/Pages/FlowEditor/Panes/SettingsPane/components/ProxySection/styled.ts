import styled from 'styled-components';
import {
    settingsHintStyles,
    settingsSectionLabelStyles,
    settingsSeparatorStyles,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/SettingsPane/shared.styled';

export const SettingsHint = styled.div`
    ${settingsHintStyles}
`;

export const SettingsSectionLabel = styled.div`
    ${settingsSectionLabelStyles}
`;

export const SettingsSeparator = styled.hr`
    ${settingsSeparatorStyles}
`;

export const ProxyField = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

export const ProxyLabel = styled.label`
    font-size: 12px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text.secondary};
`;

export const ProxyError = styled.span`
    font-size: 11px;
    color: ${({ theme }) => theme.colors.accent.error};
`;

export const RulesWrap = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

export const RulesHeader = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

export const RulesTitle = styled.span`
    font-size: 12px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text.secondary};
`;

export const RulesHint = styled.span`
    font-size: 11px;
    color: ${({ theme }) => theme.colors.text.tertiary};
`;

export const RuleGroup = styled.div`
    padding: 10px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.primary};
`;

export const RuleGroupLabel = styled.div`
    margin-bottom: 8px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
`;

export const RuleRow = styled.div`
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1fr) minmax(0, 1.2fr) 26px;
    gap: 6px;
    align-items: center;
    margin-bottom: 6px;

    @media (max-width: 560px) {
        grid-template-columns: minmax(0, 1fr) 26px;

        > select {
            grid-column: 1;
        }

        > button {
            grid-column: 2;
            grid-row: 1 / span 3;
        }
    }
`;

export const RuleSelect = styled.select`
    min-width: 0;
    height: 28px;
    padding: 0 8px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.sm};
    background: ${({ theme }) => theme.colors.bg.primary};
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 11px;
`;

export const RemoveRuleButton = styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: ${({ theme }) => theme.radius.sm};
    color: ${({ theme }) => theme.colors.text.tertiary};

    &:hover {
        background: ${({ theme }) => theme.colors.bg.tertiary};
        color: ${({ theme }) => theme.colors.text.primary};
    }
`;

export const AddRuleButton = styled.button`
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    gap: 4px;
    padding: 4px 0;
    color: ${({ theme }) => theme.colors.accent.primary};
    font-size: 11px;

    &:hover:not(:disabled) {
        text-decoration: underline;
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }
`;

export const OrDivider = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 10px;
    font-weight: 600;

    &::before,
    &::after {
        content: '';
        flex: 1;
        height: 1px;
        background: ${({ theme }) => theme.colors.border.default};
    }
`;

export const Summary = styled.div`
    padding: 8px 10px;
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.tertiary};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 10px;
    line-height: 1.5;
    overflow-wrap: anywhere;
`;
