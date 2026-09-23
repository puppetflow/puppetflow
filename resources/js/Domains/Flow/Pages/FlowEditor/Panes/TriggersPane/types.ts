import type { ProxyMode } from '@/Domains/Flow/Pages/FlowEditor/components/ProxyPicker/proxyChoice';

export type TriggerType = 'webhook' | 'cron';

export interface TriggerFormData {
    type: TriggerType;
    label: string;
    input_template: string;
    merge_post_data: boolean;
    cron_expression: string;
    cron_preset: string;
    /** Null means the trigger inherits the flow proxy settings. */
    proxy_mode: ProxyMode | null;
    workspace_proxy_id: number | null;
}

export interface TeamOption {
    id: Id;
    name: string;
}
