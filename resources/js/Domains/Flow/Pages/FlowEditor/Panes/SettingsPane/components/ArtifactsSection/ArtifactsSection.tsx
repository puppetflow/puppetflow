import Switch from '@/Shared/UI/Switch/Switch';
import { DocHelpLink } from '@/Shared/UI/DocHelpLink/DocHelpLink';
import type { SettingsForm } from '@/Domains/Flow/Pages/FlowEditor/Panes/SettingsPane/types';
import * as S from './styled';

interface ArtifactsSectionProps {
    form: SettingsForm;
    recordingEnabled: boolean;
    isNodalFlow: boolean;
}

export default function ArtifactsSection({ form, recordingEnabled, isNodalFlow }: ArtifactsSectionProps) {
    return (
        <>
            <S.SettingsSeparator />
            <S.SettingsSectionLabel>
                Artifacts
                <DocHelpLink path="/guide/artifacts" label="Open artifacts documentation" />
            </S.SettingsSectionLabel>

            <Switch
                id="export_artifacts_screenshots"
                checked={form.data.export_artifacts_screenshots}
                onChange={value => form.setData('export_artifacts_screenshots', value)}
                label="Screenshots in output"
            />
            <S.SettingsHint>
                {isNodalFlow
                    ? 'Include screenshot URLs in the run output.'
                    : 'Include screenshot URLs in $artifacts.screenshots in the run output.'}
            </S.SettingsHint>

            <Switch
                id="export_artifacts_downloads"
                checked={form.data.export_artifacts_downloads}
                onChange={value => form.setData('export_artifacts_downloads', value)}
                label="Downloads in output"
            />
            <S.SettingsHint>
                {isNodalFlow
                    ? 'Include download URLs in the run output.'
                    : 'Include download URLs in $artifacts.downloads in the run output.'}
            </S.SettingsHint>

            {recordingEnabled && (
                <>
                    <Switch
                        id="export_artifacts_recording"
                        checked={form.data.export_artifacts_recording}
                        onChange={value => form.setData('export_artifacts_recording', value)}
                        label="Recording in output"
                    />
                    <S.SettingsHint>
                        {isNodalFlow
                            ? 'Include recording URLs in the run output.'
                            : 'Include recording URLs in $artifacts.recording in the run output.'}
                    </S.SettingsHint>
                </>
            )}
        </>
    );
}
