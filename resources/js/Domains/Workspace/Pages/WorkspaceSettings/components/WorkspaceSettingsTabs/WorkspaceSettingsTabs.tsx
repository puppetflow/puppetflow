import PageTabs, { type PageTabItem } from '@/Shared/UI/SettingsTabs/PageTabs';
import type { WorkspaceSettingsTab } from './useWorkspaceSettingsTab';

interface Props {
    activeTab: WorkspaceSettingsTab;
    privateLibrariesEnabled: boolean;
    mcpEnabled: boolean;
    onTabChange: (tab: WorkspaceSettingsTab) => void;
}

export default function WorkspaceSettingsTabs({
    activeTab,
    privateLibrariesEnabled,
    mcpEnabled,
    onTabChange,
}: Props) {
    const tabs: PageTabItem<WorkspaceSettingsTab>[] = [
        { value: 'general', label: 'General', icon: 'lucide:settings' },
        { value: 'flows', label: 'Flows', icon: 'lucide:workflow' },
        { value: 'proxies', label: 'Proxies', icon: 'lucide:network' },
        ...(privateLibrariesEnabled
            ? [{
                value: 'private-libraries' as const,
                label: 'Private Libraries',
                mobileLabel: 'Libraries',
                icon: 'lucide:git-branch',
            }]
            : []),
        ...(mcpEnabled
            ? [{
                value: 'mcp' as const,
                label: 'Instance MCP',
                mobileLabel: 'MCP',
                icon: 'lucide:plug-zap',
            }]
            : []),
    ];

    return (
        <PageTabs
            tabs={tabs}
            activeTab={activeTab}
            ariaLabel="Workspace settings sections"
            onTabChange={onTabChange}
        />
    );
}
