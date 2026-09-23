import type { ProxyChoice, ProxySelection } from '@/Domains/Flow/Pages/FlowEditor/components/ProxyPicker/proxyChoice';
import type { FlowEditorProps } from '@/Domains/Flow/Pages/FlowEditor/types';

// Everything RunModal needs to offer a per-run proxy override. Absent when the caller has no proxy data.
export interface RunProxyContext {
    flowChoice: ProxyChoice;
    workspaceProxies: FlowEditorProps['workspaceProxies'];
    teams: FlowEditorProps['teams'];
    canManageWorkspaceProxies: boolean;
}

export type RunSubmitHandler = (
    parsedInput: Record<string, unknown>,
    useOldCode: boolean,
    proxyOverride: ProxySelection | null,
) => void;
