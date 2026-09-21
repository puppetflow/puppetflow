import type { Integration, IntegrationProvider } from '@/Domains/Integration/types';

export type MessengerIntegration = Pick<Integration, 'id' | 'name' | 'provider'>;

export interface ChatOption {
    id: string;
    name: string;
}

export interface DetectResult {
    ok: boolean;
    chat_id?: string;
    chat_name?: string;
    error?: string;
}

export function getAvailableMessengers(integrations: MessengerIntegration[]): IntegrationProvider[] {
    return [...new Set(integrations.map(integration => integration.provider))];
}

export function getIntegrationsForMessenger(
    integrations: MessengerIntegration[],
    messenger: string | null,
): MessengerIntegration[] {
    return messenger
        ? integrations.filter(integration => (integration.provider as string) === messenger)
        : [];
}
