import Switch from '@/Shared/UI/Switch/Switch';
import ProxyPicker from '@/Domains/Flow/Pages/FlowEditor/components/ProxyPicker/ProxyPicker';
import {
    defaultOverrideChoice,
    describeProxyChoice,
    type ProxyChoice,
} from '@/Domains/Flow/Pages/FlowEditor/components/ProxyPicker/proxyChoice';
import type { RunProxyContext } from '@/Domains/Flow/Pages/FlowEditor/Modals/RunModal/types';
import * as S from './styled';

interface RunProxyOverrideProps {
    context: RunProxyContext;
    value: ProxyChoice | null;
    onChange: (value: ProxyChoice | null) => void;
}

// Lets the user replace the flow proxy for a single manual run.
export default function RunProxyOverride({ context, value, onChange }: RunProxyOverrideProps) {
    const { flowChoice, workspaceProxies, teams, canManageWorkspaceProxies } = context;

    return (
        <>
            <S.Divider />
            <Switch
                id="run-proxy-override"
                checked={value !== null}
                onChange={enabled => onChange(enabled ? defaultOverrideChoice(flowChoice, workspaceProxies) : null)}
                label="Use a different proxy for this run"
            />

            {value !== null && (
                <S.Section>
                    <S.Hint>
                        Applies to this run only. Flow default: {describeProxyChoice(flowChoice, workspaceProxies)}.
                    </S.Hint>
                    <ProxyPicker
                        value={value}
                        workspaceProxies={workspaceProxies}
                        teams={teams}
                        canManageWorkspaceProxies={canManageWorkspaceProxies}
                        ariaLabel="Run proxy"
                        onChange={onChange}
                    />
                </S.Section>
            )}
        </>
    );
}
