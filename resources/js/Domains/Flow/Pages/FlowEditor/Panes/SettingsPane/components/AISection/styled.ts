import styled from 'styled-components';
import { settingsHintStyles, settingsSectionLabelStyles, settingsSeparatorStyles } from '@/Domains/Flow/Pages/FlowEditor/Panes/SettingsPane/shared.styled';

export const SettingsHint = styled.div`
    ${settingsHintStyles}
`;

export const SettingsSectionLabel = styled.div`
    ${settingsSectionLabelStyles}
    display: flex;
    align-items: center;
    gap: 4px;
`;

export const SettingsSeparator = styled.hr`
    ${settingsSeparatorStyles}
`;
