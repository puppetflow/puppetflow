import { useState } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { useIntegrationCreation } from '@/Domains/Integration/Contexts/IntegrationCreationContext';
import type { IntegrationProvider } from '@/Domains/Integration/types';
import Button from '@/Shared/UI/Button/Button';
import * as S from './styled';

interface ProviderMeta {
    label: string;
    icon: string;
    color: string;
}

interface Props {
    providers: IntegrationProvider[];
    configuredProviders?: IntegrationProvider[];
    value: string | null;
    onChange: (provider: string) => void;
    label: string;
    providerMeta: Record<string, ProviderMeta>;
    category: 'ai' | 'messenger';
    emptyMessage: string;
    onIntegrationCreated?: (provider: string, integrationId: Id) => void;
}

export default function IntegrationProviderSelector({
    providers,
    configuredProviders = providers,
    value,
    onChange,
    label,
    providerMeta,
    category,
    emptyMessage,
    onIntegrationCreated,
}: Props) {
    const integrationCreation = useIntegrationCreation();
    const [creatingProvider, setCreatingProvider] = useState<IntegrationProvider | null>(null);
    const createIntegration = async (provider?: IntegrationProvider) => {
        setCreatingProvider(provider ?? null);
        const result = await integrationCreation.create({ category, provider });
        setCreatingProvider(null);
        if (!result) return;

        await integrationCreation.refresh('integrations');
        const { integration } = result;
        if (onIntegrationCreated) {
            onIntegrationCreated(integration.provider, integration.id);
        } else {
            onChange(integration.provider);
        }
    };
    const selectProvider = (provider: IntegrationProvider) => {
        if (configuredProviders.includes(provider)) {
            onChange(provider);
            return;
        }

        void createIntegration(provider);
    };

    return (
        <div>
            {providers.length > 0 && <S.Label>{label}</S.Label>}
            {providers.length === 0 ? (
                <S.EmptyResult>
                    <S.EmptyResultContent>
                        {emptyMessage}
                    </S.EmptyResultContent>
                    <Button type="button" variant="secondary" size="sm" onClick={() => void createIntegration()}>
                        + Add integration
                    </Button>
                </S.EmptyResult>
            ) : (
                <S.Pills>
                    {providers.map(provider => {
                        const meta = providerMeta[provider];
                        const configured = configuredProviders.includes(provider);
                        return (
                            <S.Pill
                                key={provider}
                                type="button"
                                $active={value === provider}
                                $color={meta?.color || '#888'}
                                $configured={configured}
                                disabled={creatingProvider !== null}
                                title={configured ? undefined : `Set up ${meta?.label || provider}`}
                                onClick={() => selectProvider(provider)}
                            >
                                <Icon
                                    icon={creatingProvider === provider
                                        ? 'lucide:loader-circle'
                                        : meta?.icon || 'lucide:bot'}
                                    width={16}
                                    height={16}
                                    style={{ color: meta?.color, fill: meta?.color }}
                                />
                                {meta?.label || provider}
                                {!configured && creatingProvider !== provider && (
                                    <Icon icon="lucide:plus" width={12} height={12} />
                                )}
                            </S.Pill>
                        );
                    })}
                </S.Pills>
            )}
        </div>
    );
}
