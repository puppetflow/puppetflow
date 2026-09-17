import { useEffect, useState } from 'react';
import { fetchAiModelSuggestions } from '@/Domains/AiModel/aiModelSuggestions';
import type { IntegrationProvider } from '@/Domains/Integration/types';
import { getProviderConfig } from '@/Domains/Integration/Pages/providerConfig';
import { DATA_TYPE_ICONS } from '@/Shared/Utils/dataTypeIcons';
import { fetchChannelSuggestions } from '@/Domains/Flow/Pages/FlowEditor/utils/channelSuggestions';
import { fetchDataTableSuggestions } from '@/Domains/Flow/Pages/FlowEditor/utils/dataTableSuggestions';
import { fetchMailboxWatcherSuggestions } from '@/Domains/Flow/Pages/FlowEditor/utils/mailboxWatcherSuggestions';
import {
    fetchVariableSuggestions,
    getVariableSuggestionIcon,
} from '@/Domains/Flow/Pages/FlowEditor/utils/variableSuggestions';
import { fetchMediaAssetSuggestions } from '@/Domains/Flow/Pages/FlowEditor/utils/mediaAssetSuggestions';
import { mediaIcon, mediaIconColor } from '@/Domains/Media/types';
import type { EditableFlowResourceKind } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/contexts/QuickRequirementCreationContext';

export interface ReferenceDisplay {
    label: string;
    icon: string;
    iconColor?: string;
    editUrl?: string;
    resourceKind?: EditableFlowResourceKind;
    resourceId?: Id;
    referenceId?: string;
    referenceLabel?: string;
}

const REFERENCE_PATTERN = /^\$\{(vars|channels|mailboxWatchers|aiModels|dataTables|mediaAssets)\.([^.}]+)(?:\.([^}]+))?\}$/;
const REFERENCE_FALLBACK_ICONS: Record<string, string> = {
    vars: DATA_TYPE_ICONS.variable,
    channels: DATA_TYPE_ICONS.channel,
    mailboxWatchers: DATA_TYPE_ICONS['mailbox-watcher'],
    aiModels: DATA_TYPE_ICONS['ai-model'],
    dataTables: DATA_TYPE_ICONS.datatable,
    mediaAssets: DATA_TYPE_ICONS.media,
};

export function resolveReferenceDisplay(
    value: unknown,
    references: ReadonlyMap<string, ReferenceDisplay>,
): ReferenceDisplay | null {
    const match = typeof value === 'string' ? value.match(REFERENCE_PATTERN) : null;
    const rawReference = typeof value === 'string' ? references.get(value) : undefined;
    if (!match && !rawReference) return null;

    const resolved = match ? references.get(`${match[1]}.${match[2]}`) : rawReference;
    const referenceId = match?.[2] ?? value as string;
    return {
        label: resolved
            ? resolved.label + (match?.[3] ? `.${match[3]}` : '')
            : value as string,
        icon: resolved?.icon ?? REFERENCE_FALLBACK_ICONS[match?.[1] ?? ''],
        iconColor: resolved?.iconColor,
        editUrl: resolved?.editUrl,
        referenceId,
        referenceLabel: resolved?.label,
    };
}

function useReferenceDisplayMap(flowId?: Id, extended = true, enabled = true) {
    const [references, setReferences] = useState<Map<string, ReferenceDisplay>>(() => new Map());
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        if (!enabled) return;
        const refresh = () => setRevision(current => current + 1);
        window.addEventListener('flow-resource-references:refresh', refresh);
        return () => window.removeEventListener('flow-resource-references:refresh', refresh);
    }, [enabled]);

    useEffect(() => {
        if (!enabled) {
            setReferences(new Map());
            return;
        }
        let cancelled = false;
        void Promise.allSettled([
            extended ? fetchVariableSuggestions(revision > 0) : Promise.resolve([]),
            fetchChannelSuggestions(revision > 0),
            fetchAiModelSuggestions(revision > 0),
            extended && flowId ? fetchMailboxWatcherSuggestions(flowId) : Promise.resolve([]),
            extended && flowId ? fetchDataTableSuggestions(flowId) : Promise.resolve([]),
            extended ? fetchMediaAssetSuggestions() : Promise.resolve([]),
        ] as const).then(([variables, channels, aiModels, watchers, dataTables, mediaAssets]) => {
            if (cancelled) return;
            const next = new Map<string, ReferenceDisplay>();
            if (variables.status === 'fulfilled') {
                for (const variable of variables.value) {
                    const variableIcon = getVariableSuggestionIcon(variable);
                    const display = {
                        label: variable.key,
                        icon: variableIcon.icon,
                        editUrl: `/variables?edit=${encodeURIComponent(String(variable.id))}`,
                        ...('color' in variableIcon && variableIcon.color ? { iconColor: variableIcon.color } : {}),
                    };
                    next.set(`vars.${variable.id}`, display);
                    next.set(String(variable.id), display);
                }
            }
            if (channels.status === 'fulfilled') {
                for (const channel of channels.value) {
                    const provider = getProviderConfig(channel.provider as IntegrationProvider);
                    const display = {
                        label: channel.name,
                        icon: provider?.icon ?? DATA_TYPE_ICONS.channel,
                        editUrl: `/channels?edit=${encodeURIComponent(String(channel.id))}`,
                        resourceKind: 'channel' as const,
                        resourceId: channel.id,
                        ...(provider?.color ? { iconColor: provider.color } : {}),
                    };
                    next.set(`channels.${channel.id}`, display);
                    next.set(String(channel.id), display);
                }
            }
            if (aiModels.status === 'fulfilled') {
                for (const model of aiModels.value) {
                    const provider = getProviderConfig(model.ai_integration.provider as IntegrationProvider);
                    const display = {
                        label: model.name,
                        icon: provider?.icon ?? DATA_TYPE_ICONS['ai-model'],
                        editUrl: `/ai-models?edit=${encodeURIComponent(String(model.id))}`,
                        resourceKind: 'ai-model' as const,
                        resourceId: model.id,
                        ...(provider?.color ? { iconColor: provider.color } : {}),
                    };
                    next.set(`aiModels.${model.id}`, display);
                    next.set(String(model.id), display);
                }
            }
            if (watchers.status === 'fulfilled') {
                const provider = getProviderConfig('mailbox' as IntegrationProvider);
                for (const watcher of watchers.value) {
                    const display = {
                        label: watcher.name,
                        icon: provider?.icon ?? DATA_TYPE_ICONS['mailbox-watcher'],
                        editUrl: `/flows/${encodeURIComponent(String(flowId))}?edit-watcher=${encodeURIComponent(String(watcher.id))}#mailboxes`,
                        ...(provider?.color ? { iconColor: provider.color } : {}),
                    };
                    next.set(`mailboxWatchers.${watcher.id}`, display);
                    next.set(String(watcher.id), display);
                }
            }
            if (dataTables.status === 'fulfilled') {
                for (const table of dataTables.value) {
                    const display = {
                        label: table.name,
                        icon: DATA_TYPE_ICONS.datatable,
                    };
                    next.set(`dataTables.${table.id}`, display);
                    next.set(String(table.id), display);
                }
            }
            if (mediaAssets.status === 'fulfilled') {
                for (const asset of mediaAssets.value) {
                    const display = {
                        label: asset.name,
                        icon: mediaIcon(asset.mime_type),
                        iconColor: mediaIconColor(asset.mime_type),
                        editUrl: `/media-library?media=${encodeURIComponent(String(asset.id))}`,
                    };
                    next.set(`mediaAssets.${asset.id}`, display);
                    next.set(String(asset.id), display);
                }
            }
            setReferences(next);
        });

        return () => {
            cancelled = true;
        };
    }, [enabled, extended, flowId, revision]);

    return references;
}

export function useReferenceDisplays(flowId?: Id) {
    return useReferenceDisplayMap(flowId);
}

export function useEditableResourceDisplays(enabled = true) {
    return useReferenceDisplayMap(undefined, false, enabled);
}
