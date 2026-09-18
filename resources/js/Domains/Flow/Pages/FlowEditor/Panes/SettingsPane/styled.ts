import styled from 'styled-components';
import { settingsSeparatorStyles } from './shared.styled';

export const SettingsForm = styled.form`
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 0 20px;
`;

export const SettingsSeparator = styled.hr`
    ${settingsSeparatorStyles}
`;

export const IconAnchor = styled.div`
    min-width: 0;
`;
