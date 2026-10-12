import type { FlowTrigger } from '@/Domains/Flow/types';
import type { WorkspaceProxy } from '@/Domains/Workspace/types';

export interface ApiKey {
    id: number;
    name: string;
    key_preview: string | null;
    last_used_at: string | null;
    created_at: string;
}

export interface LinkedSsoIdentity {
    name: string;
    email: string | null;
}

export interface ProfileSso {
    enabled: boolean;
    providers: {
        saml: boolean;
        ldap: boolean;
    };
    linked: {
        saml?: LinkedSsoIdentity;
        ldap?: LinkedSsoIdentity;
    };
}

export interface ProfileTrigger extends FlowTrigger {
    flow: {
        id: Id;
        name: string;
        proxy_mode: 'none' | 'auto' | 'specific';
        workspace_proxy_id: number | null;
    };
}

export interface ProfileTriggerTeam {
    id: Id;
    name: string;
}

export type ProfileWorkspaceProxy = Pick<WorkspaceProxy, 'id' | 'label' | 'country_code' | 'group'>;
