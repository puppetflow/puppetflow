import { usePageProps } from '@/App/Hooks/usePageProps';
import VisibilitySelector from '@proprietary/Domains/Flow/Components/VisibilityPicker/components/VisibilitySelector/VisibilitySelector.pp';
import TeamSelector from '@proprietary/Domains/Flow/Components/VisibilityPicker/components/TeamSelector/TeamSelector.pp';
import type { VisibilityPickerValue } from '@proprietary/Domains/Flow/Components/VisibilityPicker/types.pp';
import type { TeamTree } from '@/Domains/Folder/types';
import * as S from './styled';

interface Props {
    value: VisibilityPickerValue;
    teamTrees: TeamTree[];
    onChange: (value: VisibilityPickerValue) => void;
}

// Same colored scope cards as the flow visibility picker, without the folder
// pickers: snippets are grouped, not filed in folders.
export default function SnippetScopePicker({ value, teamTrees, onChange }: Props) {
    const { settings } = usePageProps();
    const teamsEnabled = settings?.teams_enabled ?? false;
    const workspaceSharingEnabled = settings?.workspace_sharing_enabled ?? false;

    return (
        <S.Wrapper>
            <VisibilitySelector
                value={value.visibility}
                teamsEnabled={teamsEnabled}
                workspaceSharingEnabled={workspaceSharingEnabled}
                showDisabledFeatures={settings?.promote_disabled_features ?? false}
                disabledFeatureMessage={settings?.disabled_feature_message ?? ''}
                resourceLabel="snippet"
                onChange={visibility => onChange({ ...value, visibility, teamId: visibility === 'team' ? value.teamId : null })}
            />
            {value.visibility === 'team' && (
                <S.Section>
                    <S.Label>Team</S.Label>
                    <TeamSelector
                        teams={teamTrees}
                        selectedTeamId={value.teamId}
                        onChange={teamId => onChange({ ...value, teamId, teamFolderId: null })}
                    />
                </S.Section>
            )}
        </S.Wrapper>
    );
}
