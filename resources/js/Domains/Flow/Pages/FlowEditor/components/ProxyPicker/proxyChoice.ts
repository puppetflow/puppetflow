import type { FlowEditorProps } from '@/Domains/Flow/Pages/FlowEditor/types';

export type ProxyMode = 'none' | 'auto' | 'specific';

// Single-value representation of a proxy selection, used by ProxyPicker.
export type ProxyChoice = 'none' | 'auto' | `proxy:${number}`;

export interface ProxySelection {
    proxy_mode: ProxyMode;
    workspace_proxy_id: number | null;
}

type ProxyOption = FlowEditorProps['workspaceProxies'][number];

export function toProxyChoice(mode: ProxyMode | null | undefined, proxyId: number | null | undefined): ProxyChoice {
    if (mode === 'specific' && proxyId != null) return `proxy:${proxyId}`;
    if (mode === 'auto') return 'auto';
    return 'none';
}

export function fromProxyChoice(choice: ProxyChoice): ProxySelection {
    if (choice.startsWith('proxy:')) {
        return { proxy_mode: 'specific', workspace_proxy_id: Number(choice.slice(6)) };
    }
    return { proxy_mode: choice as 'none' | 'auto', workspace_proxy_id: null };
}

export function describeProxyChoice(choice: ProxyChoice, proxies: ProxyOption[]): string {
    if (choice === 'none') return 'No proxy';
    if (choice === 'auto') return 'Auto (round-robin)';
    const proxy = proxies.find(candidate => `proxy:${candidate.id}` === choice);
    return proxy ? proxy.label : 'Unavailable proxy';
}

// Picks a sensible starting choice when a user enables a proxy override.
export function defaultOverrideChoice(flowChoice: ProxyChoice, proxies: ProxyOption[]): ProxyChoice {
    if (flowChoice === 'none') return proxies.length > 0 ? 'auto' : 'none';
    return 'none';
}
