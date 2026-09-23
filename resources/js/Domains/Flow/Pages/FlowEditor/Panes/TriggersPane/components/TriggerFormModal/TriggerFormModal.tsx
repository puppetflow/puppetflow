import type { FormEvent } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import Button from '@/Shared/UI/Button/Button';
import Input from '@/Shared/UI/Input/Input';
import Modal from '@/Shared/UI/Modal/Modal';
import ScopePicker from '@proprietary/Shared/UI/ScopePicker/ScopePicker.pp';
import Switch from '@/Shared/UI/Switch/Switch';
import UserPicker from '@/Shared/UI/UserPicker/UserPicker';
import { OWNERSHIP_DISABLED_HINT } from '@/Shared/Utils/ownershipPermissions';
import type { FlowTrigger } from '@/Domains/Flow/types';
import type { IntegrationScope } from '@/Domains/Integration/types';
import ProxyPicker from '@/Domains/Flow/Pages/FlowEditor/components/ProxyPicker/ProxyPicker';
import {
    defaultOverrideChoice,
    fromProxyChoice,
    toProxyChoice,
    type ProxyChoice,
} from '@/Domains/Flow/Pages/FlowEditor/components/ProxyPicker/proxyChoice';
import StructuredObjectInput from '@/Domains/Flow/Pages/FlowEditor/components/StructuredObjectInput/StructuredObjectInput';
import type { FlowEditorProps } from '@/Domains/Flow/Pages/FlowEditor/types';
import type { TeamOption, TriggerFormData } from '@/Domains/Flow/Pages/FlowEditor/Panes/TriggersPane/types';
import GroupField from '@/Shared/UI/GroupField/GroupField';
import CronFields from './CronFields';
import * as S from './styled';

interface TriggerFormModalProps {
    flowId: Id;
    isOpen: boolean;
    editing: FlowTrigger | null;
    data: TriggerFormData;
    errors: Partial<Record<keyof TriggerFormData, string>>;
    processing: boolean;
    group: string;
    groups: string[];
    scope: IntegrationScope;
    teamId: Id | null;
    ownerId: Id | null;
    teams: TeamOption[];
    workspaceProxies: FlowEditorProps['workspaceProxies'];
    canManageWorkspaceProxies: boolean;
    flowProxyChoice: ProxyChoice;
    ownershipDisabled: boolean;
    showInputTemplate: boolean;
    timezone: string;
    userTime: string;
    onClose: () => void;
    onSubmit: (event: FormEvent) => void;
    onFieldChange: <Key extends keyof TriggerFormData>(field: Key, value: TriggerFormData[Key]) => void;
    onProxyChange: (selection: Pick<TriggerFormData, 'proxy_mode' | 'workspace_proxy_id'>) => void;
    onGroupChange: (group: string) => void;
    onScopeChange: (scope: IntegrationScope, teamId: Id | null) => void;
    onOwnerChange: (ownerId: Id | null) => void;
    onOwnerRoleChange: (role: string | undefined) => void;
    onCronPresetChange: (preset: string) => void;
    onInputTemplateVisibilityChange: (visible: boolean) => void;
    onCopyEndpoint: (trigger: FlowTrigger) => void;
}

export default function TriggerFormModal({
    flowId,
    isOpen,
    editing,
    data,
    errors,
    processing,
    group,
    groups,
    scope,
    teamId,
    ownerId,
    teams,
    workspaceProxies,
    canManageWorkspaceProxies,
    flowProxyChoice,
    ownershipDisabled,
    showInputTemplate,
    timezone,
    userTime,
    onClose,
    onSubmit,
    onFieldChange,
    onProxyChange,
    onGroupChange,
    onScopeChange,
    onOwnerChange,
    onOwnerRoleChange,
    onCronPresetChange,
    onInputTemplateVisibilityChange,
    onCopyEndpoint,
}: TriggerFormModalProps) {
    const proxyOverrideEnabled = data.proxy_mode !== null;
    const proxyError = errors.proxy_mode || errors.workspace_proxy_id;

    const handleProxyOverrideToggle = (enabled: boolean) => {
        onProxyChange(enabled
            ? fromProxyChoice(defaultOverrideChoice(flowProxyChoice, workspaceProxies))
            : { proxy_mode: null, workspace_proxy_id: null });
    };

    const handleProxyChange = (choice: ProxyChoice) => {
        onProxyChange(fromProxyChoice(choice));
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editing ? 'Edit Trigger' : `New ${data.type === 'webhook' ? 'Webhook' : 'Schedule'} Trigger`}
        >
            <S.Form onSubmit={onSubmit}>
                <Input
                    label="Label"
                    value={data.label}
                    onChange={event => onFieldChange('label', event.target.value)}
                    placeholder="My trigger"
                    autoFocus
                />

                <GroupField
                    value={group}
                    groups={groups}
                    isModalOpen={isOpen}
                    onChange={onGroupChange}
                />

                {data.type === 'webhook' && editing?.endpoint_url && (
                    <S.CopyInputGroup>
                        <Input
                            label="Endpoint URL"
                            value={editing.endpoint_url}
                            readOnly
                            disabled
                        />
                        <S.CopyInputButton type="button" onClick={() => onCopyEndpoint(editing)}>
                            <Icon icon="lucide:copy" width={14} />
                        </S.CopyInputButton>
                    </S.CopyInputGroup>
                )}

                {data.type === 'webhook' && (
                    <Switch
                        id="merge-post-data"
                        checked={data.merge_post_data}
                        onChange={value => onFieldChange('merge_post_data', value)}
                        label="Merge POST data into input"
                    />
                )}

                {data.type === 'cron' && (
                    <CronFields
                        preset={data.cron_preset}
                        expression={data.cron_expression}
                        timezone={timezone}
                        userTime={userTime}
                        onPresetChange={onCronPresetChange}
                        onExpressionChange={value => onFieldChange('cron_expression', value)}
                    />
                )}

                <Switch
                    id="show-input-template"
                    checked={showInputTemplate}
                    onChange={value => {
                        onInputTemplateVisibilityChange(value);
                        if (!value) onFieldChange('input_template', '{}');
                    }}
                    label="Additional data for this trigger"
                />

                {showInputTemplate && (
                    <StructuredObjectInput
                        value={data.input_template}
                        onChange={value => onFieldChange('input_template', value || '{}')}
                        label="Trigger input data"
                        jsonHint={<>Type {'${vars.'}, {'${channels.'}, {'${mailboxWatchers.'} or {'${aiModels.'} to insert a reference (autocompleted).</>}
                        expandableTitle="Trigger Input Template"
                        modeStorageKey="trigger-input-template"
                        flowId={flowId}
                        editorHeight={180}
                    />
                )}

                <Switch
                    id="trigger-proxy-override"
                    checked={proxyOverrideEnabled}
                    onChange={handleProxyOverrideToggle}
                    label="Use a different proxy for this trigger"
                />

                {proxyOverrideEnabled && (
                    <S.ProxyField>
                        <S.ProxyHint>
                            Runs started by this trigger use this proxy instead of the flow setting.
                        </S.ProxyHint>
                        <ProxyPicker
                            value={toProxyChoice(data.proxy_mode, data.workspace_proxy_id)}
                            workspaceProxies={workspaceProxies}
                            teams={teams}
                            canManageWorkspaceProxies={canManageWorkspaceProxies}
                            ariaLabel="Trigger proxy"
                            invalid={Boolean(proxyError)}
                            onChange={handleProxyChange}
                        />
                        {proxyError && <S.ProxyError>{proxyError}</S.ProxyError>}
                    </S.ProxyField>
                )}

                <ScopePicker
                    label="Visibility"
                    value={{ scope, team_id: teamId }}
                    onChange={value => onScopeChange(value.scope as IntegrationScope, value.team_id)}
                    teams={teams}
                    ownerLabel="Owner"
                    ownerScope="owner"
                    disabled={ownershipDisabled}
                    disabledHint={OWNERSHIP_DISABLED_HINT}
                />

                {editing && (
                    <UserPicker
                        label="Owner"
                        value={ownerId}
                        onChange={onOwnerChange}
                        onSelect={user => onOwnerRoleChange(user?.workspace_role ?? undefined)}
                        placeholder="Myself (default)"
                        disabled={ownershipDisabled}
                    />
                )}

                <S.Actions>
                    <Button type="submit" size="sm" disabled={processing}>
                        {processing ? 'Saving...' : editing ? 'Update Trigger' : 'Create Trigger'}
                    </Button>
                </S.Actions>
            </S.Form>
        </Modal>
    );
}
