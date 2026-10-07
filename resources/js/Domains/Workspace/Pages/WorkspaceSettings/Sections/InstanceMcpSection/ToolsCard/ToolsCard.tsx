import { useState } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import Button from '@/Shared/UI/Button/Button';
import Switch from '@/Shared/UI/Switch/Switch';
import { DocHelpLink } from '@/Shared/UI/DocHelpLink/DocHelpLink';
import { useConfirm } from '@/Shared/Hooks/useConfirm';
import * as TabsS from '@/Shared/UI/SettingsTabs/styled';
import type { McpTool, WorkspaceMcpSettings } from '@/Domains/Workspace/types';
import * as SharedS from '@/Domains/Workspace/Pages/WorkspaceSettings/shared.styled';
import {
    ALWAYS_AVAILABLE_MCP_TOOLS,
    MCP_TOOL_CATEGORIES,
    toolCategory,
    toolLabel,
    type McpToolCategory,
} from '@/Domains/Workspace/Pages/WorkspaceSettings/Sections/InstanceMcpSection/utils';
import * as S from './styled';

interface Props {
    settings: WorkspaceMcpSettings;
    tools: McpTool[];
    busy: boolean;
    readOnly?: boolean;
    onUpdate: (patch: Partial<WorkspaceMcpSettings>) => Promise<void>;
}

export default function ToolsCard({ settings, tools, busy, readOnly, onUpdate }: Props) {
    const { confirm, ConfirmModal } = useConfirm();
    const [activeCategory, setActiveCategory] = useState<McpToolCategory>('flows');
    const [query, setQuery] = useState('');
    const isToolEnabled = (name: string) => (
        ALWAYS_AVAILABLE_MCP_TOOLS.has(name) || settings.enabled_tools.includes(name)
    );
    const categoryTools = activeCategory === 'all'
        ? tools
        : tools.filter(tool => toolCategory(tool.name) === activeCategory);
    const normalizedQuery = query.trim().toLowerCase();
    const visibleTools = normalizedQuery
        ? tools.filter(tool => (
            tool.name.toLowerCase().includes(normalizedQuery)
            || toolLabel(tool.name).toLowerCase().includes(normalizedQuery)
            || tool.description.toLowerCase().includes(normalizedQuery)
        ))
        : categoryTools;
    const visibleEnabledCount = visibleTools.filter(tool => isToolEnabled(tool.name)).length;

    const updateTool = async (toolName: string, value: boolean) => {
        if (readOnly || busy || ALWAYS_AVAILABLE_MCP_TOOLS.has(toolName)) return;

        const enabledTools = value
            ? Array.from(new Set([...settings.enabled_tools, toolName]))
            : settings.enabled_tools.filter(name => name !== toolName);

        await onUpdate({ enabled_tools: enabledTools });
    };

    const updateVisibleTools = async (enabled: boolean) => {
        if (readOnly || busy) return;
        const visibleNames = new Set(visibleTools.map(tool => tool.name));
        const enabledTools = enabled
            ? Array.from(new Set([...settings.enabled_tools, ...visibleNames]))
            : settings.enabled_tools.filter(name => (
                !visibleNames.has(name) || ALWAYS_AVAILABLE_MCP_TOOLS.has(name)
            ));

        await onUpdate({ enabled_tools: enabledTools });
    };

    const restoreDefaults = async () => {
        if (readOnly || busy) return;
        if (!await confirm({
            title: 'Restore MCP tool defaults',
            message: 'Replace the current MCP tool selection with the workspace defaults?',
            confirmLabel: 'Restore defaults',
            variant: 'primary',
        })) {
            return;
        }

        await onUpdate({
            enabled_tools: tools.filter(tool => tool.enabled_by_default).map(tool => tool.name),
        });
    };

    return (
        <>
            <SharedS.Card>
                <SharedS.CardTitle>
                    <Icon icon="lucide:wrench" width={15} height={15} />
                    MCP Tools
                    <DocHelpLink
                        path="/reference/api#tools"
                        label="Open MCP tools reference"
                    />
                </SharedS.CardTitle>
                <S.SectionHint>
                    Choose which workspace tools connected MCP clients are allowed to run. Tool discovery stays stable, and permissions are checked on every call.
                </S.SectionHint>
                <S.SearchWrap>
                    <Icon icon="lucide:search" width={14} height={14} />
                    <S.SearchInput
                        type="search"
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        onKeyDown={event => {
                            if (event.key === 'Escape') setQuery('');
                        }}
                        placeholder="Search tools by name or description..."
                        aria-label="Search MCP tools"
                    />
                    {query && (
                        <S.ClearSearch
                            type="button"
                            onClick={() => setQuery('')}
                            aria-label="Clear MCP tool search"
                        >
                            <Icon icon="lucide:x" width={13} height={13} />
                        </S.ClearSearch>
                    )}
                </S.SearchWrap>
                <S.TabsWrap>
                    <TabsS.SettingsTabsScroller>
                        <TabsS.SettingsTabs role="tablist" aria-label="MCP tool categories">
                            {MCP_TOOL_CATEGORIES.map(category => {
                                const categoryTools = category.key === 'all'
                                    ? tools
                                    : tools.filter(tool => toolCategory(tool.name) === category.key);
                                const enabledCount = categoryTools.filter(tool => isToolEnabled(tool.name)).length;

                                return (
                                    <TabsS.SettingsTab
                                        key={category.key}
                                        type="button"
                                        role="tab"
                                        aria-selected={activeCategory === category.key}
                                        $active={activeCategory === category.key}
                                        onClick={() => setActiveCategory(category.key)}
                                    >
                                        {category.label}
                                        <S.TabCount>{enabledCount}/{categoryTools.length}</S.TabCount>
                                    </TabsS.SettingsTab>
                                );
                            })}
                        </TabsS.SettingsTabs>
                    </TabsS.SettingsTabsScroller>
                </S.TabsWrap>
                <S.Header>
                    <S.SettingsInlineHint>
                        {normalizedQuery
                            ? `${visibleTools.length} matching tools, ${visibleEnabledCount} enabled`
                            : `${visibleEnabledCount} of ${visibleTools.length} tools enabled in this view`}
                    </S.SettingsInlineHint>
                    {!readOnly && (
                        <S.FormActions>
                            <Button type="button" variant="secondary" size="sm" disabled={busy || visibleTools.length === 0} onClick={() => void updateVisibleTools(true)}>
                                <Icon icon="lucide:list-checks" width={13} height={13} />
                                Enable
                            </Button>
                            <Button type="button" variant="secondary" size="sm" disabled={busy || visibleTools.length === 0} onClick={() => void updateVisibleTools(false)}>
                                <Icon icon="lucide:list-x" width={13} height={13} />
                                Disable
                            </Button>
                            <Button type="button" variant="secondary" size="sm" disabled={busy || tools.length === 0} onClick={() => void restoreDefaults()}>
                                <Icon icon="lucide:rotate-ccw" width={13} height={13} />
                                Restore defaults
                            </Button>
                        </S.FormActions>
                    )}
                </S.Header>
                <S.Grid>
                    {visibleTools.map(tool => {
                        const alwaysAvailable = ALWAYS_AVAILABLE_MCP_TOOLS.has(tool.name);
                        const enabled = isToolEnabled(tool.name);

                        return (
                            <S.Item key={tool.name} $enabled={enabled}>
                                <S.Info>
                                    <S.Name>{toolLabel(tool.name)}</S.Name>
                                    <S.Code>{tool.name}</S.Code>
                                    <S.Description>{tool.description}</S.Description>
                                </S.Info>
                                <Switch
                                    id={`mcp_tool_${tool.name}`}
                                    checked={enabled}
                                    onChange={value => void updateTool(tool.name, value)}
                                    label={alwaysAvailable ? 'Always' : (enabled ? 'Enabled' : 'Disabled')}
                                    disabled={readOnly || busy || alwaysAvailable}
                                />
                            </S.Item>
                        );
                    })}
                </S.Grid>
                {visibleTools.length === 0 && (
                    <S.EmptyState>
                        <Icon icon="lucide:search-x" width={18} height={18} />
                        No tools match “{query.trim()}”.
                    </S.EmptyState>
                )}
            </SharedS.Card>
            <ConfirmModal />
        </>
    );
}
