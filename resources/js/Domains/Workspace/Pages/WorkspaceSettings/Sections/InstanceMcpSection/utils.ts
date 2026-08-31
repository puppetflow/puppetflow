import { csrfHeaders } from '@/Shared/Utils/csrf';
import { formatDateTime } from '@/Shared/Utils/formatDate';
import type { McpFlow } from '@/Domains/Workspace/types';

export type McpToolCategory = 'all' | 'flows' | 'snippets' | 'runs' | 'artifacts' | 'workspace' | 'teams';

export const MCP_TOOL_CATEGORIES: { key: McpToolCategory; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'flows', label: 'Flows' },
    { key: 'snippets', label: 'Snippets' },
    { key: 'runs', label: 'Runs' },
    { key: 'artifacts', label: 'Artifacts' },
    { key: 'workspace', label: 'Workspace' },
    { key: 'teams', label: 'Teams' },
];

export const ALWAYS_AVAILABLE_MCP_TOOLS = new Set(['get_nodal_catalog']);

const TOOL_CATEGORIES: Record<Exclude<McpToolCategory, 'all'>, string[]> = {
    flows: [
        'search_flows', 'get_flow_details', 'get_flow_source', 'list_folders',
        'get_flow_creation_options', 'get_nodal_catalog', 'list_flow_resources',
        'write_code_flow', 'write_nodal_flow', 'publish_flow', 'unpublish_flow',
    ],
    snippets: [
        'search_snippets',
        'get_snippet_source', 'get_snippet_creation_options',
        'write_code_snippet', 'write_nodal_snippet', 'publish_snippet', 'unpublish_snippet',
    ],
    runs: ['search_runs', 'list_flow_runs', 'run_flow', 'get_run', 'get_run_result', 'continue_human_validation'],
    artifacts: ['list_artifacts', 'get_latest_screenshot', 'download_artifact', 'get_recording', 'get_recording_lastshot'],
    workspace: ['get_current_workspace', 'update_current_workspace'],
    teams: ['list_workspace_members', 'list_teams', 'get_team', 'create_team', 'update_team', 'add_team_members', 'replace_team_members', 'set_member_teams'],
};

export function toolCategory(name: string): Exclude<McpToolCategory, 'all'> {
    return (Object.entries(TOOL_CATEGORIES).find(([, names]) => names.includes(name))?.[0] ?? 'flows') as Exclude<McpToolCategory, 'all'>;
}

export async function requestJson(url: string, options: RequestInit) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...csrfHeaders(),
            ...(options.headers || {}),
        },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.message || 'MCP request failed.');
    }

    return payload;
}

export function formatDate(value: string | null) {
    if (!value) return 'Never';
    return formatDateTime(value, { dateStyle: 'medium', timeStyle: 'short' });
}

export function scopeLabel(flow: McpFlow) {
    if (flow.visibility === 'workspace') return 'Workspace';
    if (flow.visibility === 'team') return `Team: ${flow.team?.name || '-'}`;
    return 'Personal';
}

export function toolLabel(name: string) {
    return name.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}
