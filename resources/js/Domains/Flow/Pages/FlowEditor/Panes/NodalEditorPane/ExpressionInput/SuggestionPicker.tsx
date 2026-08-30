import type { IntegrationProvider } from '@/Domains/Integration/types';
import { getProviderConfig } from '@/Domains/Integration/Pages/providerConfig';
import { getVisibilityMeta } from '@/Shared/Utils/visibility';
import type { ScalarNodeParameterValue } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import { useQuickRequirementCreation } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/contexts/QuickRequirementCreationContext';
import type { WatcherSuggestion } from '@/Domains/Flow/Pages/FlowEditor/utils/mailboxWatcherSuggestions';
import type { ChannelSuggestion } from '@/Domains/Flow/Pages/FlowEditor/utils/channelSuggestions';
import CustomSelect, {
    type CustomSelectOption,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodeConfigModal/components/CustomSelect/CustomSelect';

interface SuggestionPickerProps {
    type: 'channel' | 'mailbox-watcher';
    value: string;
    placeholder?: string;
    readOnly?: boolean;
    loading?: boolean;
    channels: ChannelSuggestion[];
    watchers: WatcherSuggestion[];
    onRefresh?: () => void | Promise<void>;
    refreshing?: boolean;
    dropdownMinWidth?: number;
    onChange: (value: ScalarNodeParameterValue) => void;
}

const detailWithVisibility = (
    scope: string,
    teamName: string | null,
    detail: string,
) => {
    const visibility = getVisibilityMeta(scope, teamName);

    return {
        detail: visibility ? `${visibility.label} - ${detail}` : detail,
        detailIcon: visibility?.icon,
    };
};

export default function SuggestionPicker({
    type,
    value,
    placeholder,
    readOnly,
    loading,
    channels,
    watchers,
    onRefresh,
    refreshing,
    dropdownMinWidth,
    onChange,
}: SuggestionPickerProps) {
    const quickRequirementCreation = useQuickRequirementCreation();
    const isMailboxWatcher = type === 'mailbox-watcher';
    const mailboxProvider = getProviderConfig('mailbox' as IntegrationProvider);
    const options: CustomSelectOption<string>[] = isMailboxWatcher
        ? watchers.map(watcher => ({
            value: String(watcher.id),
            label: watcher.name,
            icon: mailboxProvider?.icon,
            iconColor: mailboxProvider?.color,
            ...detailWithVisibility(watcher.scope, watcher.team_name, watcher.address),
        }))
        : channels.map(channel => {
            const provider = getProviderConfig(channel.provider as IntegrationProvider);
            return {
                value: String(channel.id),
                label: channel.name,
                icon: provider?.icon,
                iconColor: provider?.color,
                ...detailWithVisibility(
                    channel.scope,
                    channel.team_name,
                    channel.destination || 'No destination',
                ),
            };
        });

    if (value && !options.some(option => option.value === value)) {
        options.push({ value, label: value });
    }

    return (
        <CustomSelect
            value={value}
            options={options}
            placeholder={placeholder ?? (
                isMailboxWatcher ? 'Select a mailbox watcher...' : 'Select a channel...'
            )}
            disabled={readOnly}
            loading={loading}
            refreshing={refreshing}
            dropdownMinWidth={dropdownMinWidth}
            searchThreshold={0}
            actionSlot={{
                label: isMailboxWatcher ? '+ Add mailbox watcher' : '+ Add channel',
                onAction: async () => {
                    const created = type === 'channel'
                        ? await quickRequirementCreation.create('channel')
                        : await quickRequirementCreation.create('mailbox-watcher');
                    if (!created) return null;
                    await onRefresh?.();
                    return String(created.id);
                },
            }}
            onRefresh={onRefresh}
            onClear={value ? () => onChange({ mode: 'fixed', value: '' }) : undefined}
            onChange={nextValue => onChange({ mode: 'fixed', value: nextValue })}
        />
    );
}
