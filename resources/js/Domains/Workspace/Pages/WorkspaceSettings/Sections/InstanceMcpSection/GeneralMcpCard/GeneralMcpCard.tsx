import { Icon } from '@/Shared/UI/Icon/Icon';
import Switch from '@/Shared/UI/Switch/Switch';
import { DocHelpLink } from '@/Shared/UI/DocHelpLink/DocHelpLink';
import type { WorkspaceMcpSettings } from '@/Domains/Workspace/types';
import * as SharedS from '@/Domains/Workspace/Pages/WorkspaceSettings/shared.styled';
import * as S from './styled';

interface Props {
    settings: WorkspaceMcpSettings;
    busy: boolean;
    readOnly?: boolean;
    onUpdate: (patch: Partial<WorkspaceMcpSettings>) => Promise<void>;
}

export default function GeneralMcpCard({ settings, busy, readOnly, onUpdate }: Props) {
    return (
        <SharedS.Card>
            <SharedS.CardTitle>
                <Icon icon="lucide:plug-zap" width={15} height={15} />
                Workspace MCP Access
                <DocHelpLink
                    path="/guide/mcp#_1-configure-the-workspace"
                    label="Open instance MCP documentation"
                />
            </SharedS.CardTitle>
            <S.SectionHint>
                Control which Puppetflow tools and flows are available when this workspace is selected through the universal broker or connected directly.
            </S.SectionHint>
            <S.CardBody>
                <S.SwitchGroup>
                    <Switch
                        id="mcp_enabled"
                        checked={settings.enabled}
                        onChange={value => void onUpdate({ enabled: value })}
                        label="Enable MCP access for this workspace"
                        disabled={readOnly || busy}
                    />
                    <S.SwitchHint>
                        Makes this workspace available through the universal connection and its direct endpoints.
                    </S.SwitchHint>
                </S.SwitchGroup>
                <S.Divider />
                <S.SwitchGroup>
                    <Switch
                        id="mcp_unexposed_previews"
                        checked={settings.include_unexposed_flow_previews}
                        onChange={value => void onUpdate({ include_unexposed_flow_previews: value })}
                        label="Include flows not enabled for MCP in search results"
                        disabled={readOnly || busy}
                    />
                    <S.SwitchHint>
                        Shows basic flow previews in search without exposing their details or allowing runs.
                    </S.SwitchHint>
                </S.SwitchGroup>
            </S.CardBody>
        </SharedS.Card>
    );
}
