import type { SettingsFormData } from './types';

export type SettingsGroupId =
    | 'general'
    | 'execution'
    | 'browser'
    | 'proxy'
    | 'output'
    | 'ai'
    | 'maintenance';

export const SETTINGS_GROUPS_STORAGE_KEY = 'puppetflow:flow-settings:open-groups';
export const DEFAULT_OPEN_GROUPS: SettingsGroupId[] = ['general'];

/** Which form fields belong to each collapsible group, used for "Modified" and "Error" badges. */
export const GROUP_FIELDS: Record<SettingsGroupId, (keyof SettingsFormData)[]> = {
    general: ['name', 'description'],
    execution: ['queue_index', 'timeout_seconds', 'operator_seconds', 'max_retries', 'runs_retention_limit', 'finally_enabled'],
    browser: ['viewport_width', 'viewport_height', 'keyboard_speed', 'user_agent', 'language', 'disable_web_security'],
    proxy: ['proxy_mode', 'workspace_proxy_id', 'proxy_filter_rules'],
    output: [
        'include_raw_output',
        'include_context_in_output',
        'include_input_in_output',
        'always_success_response',
        'export_artifacts_screenshots',
        'export_artifacts_downloads',
        'export_artifacts_recording',
    ],
    ai: ['available_in_mcp'],
    maintenance: [],
};

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function isGroupModified(
    group: SettingsGroupId,
    data: SettingsFormData,
    defaults: SettingsFormData,
): boolean {
    return GROUP_FIELDS[group].some(field => !sameValue(data[field], defaults[field]));
}

export function groupHasError(
    group: SettingsGroupId,
    errors: Partial<Record<keyof SettingsFormData, string>>,
): boolean {
    return GROUP_FIELDS[group].some(field => Boolean(errors[field]));
}

export function groupsWithErrors(errors: Partial<Record<keyof SettingsFormData, string>>): SettingsGroupId[] {
    return (Object.keys(GROUP_FIELDS) as SettingsGroupId[]).filter(group => groupHasError(group, errors));
}
