import { useEffect, useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import Switch from '@/Shared/UI/Switch/Switch';
import { useToast } from '@/App/Hooks/useToast';
import {
    type ProfileTrigger,
    type ProfileTriggerTeam,
    type ProfileWorkspaceProxy,
} from '@/Domains/Profile/types';
import { formatDateTime } from '@/Shared/Utils/formatDate';
import TriggerFormModal from '@/Domains/Flow/Pages/FlowEditor/Panes/TriggersPane/components/TriggerFormModal/TriggerFormModal';
import { useTriggersPane } from '@/Domains/Flow/Pages/FlowEditor/Panes/TriggersPane/useTriggersPane';
import { toProxyChoice } from '@/Domains/Flow/Pages/FlowEditor/components/ProxyPicker/proxyChoice';
import * as S from './styled';

const PAGE_SIZE = 30;

interface Props {
    triggers: ProfileTrigger[];
    teams: ProfileTriggerTeam[];
    workspaceProxies: ProfileWorkspaceProxy[];
    canManageWorkspaceProxies: boolean;
}

export default function TriggersSection({
    triggers,
    teams,
    workspaceProxies,
    canManageWorkspaceProxies,
}: Props) {
    const { toast } = useToast();
    const [page, setPage] = useState(1);
    const [activeFlowId, setActiveFlowId] = useState<Id | null>(null);
    const [togglingId, setTogglingId] = useState<Id | null>(null);
    const groups = useMemo(
        () => [...new Set(triggers.map(trigger => trigger.group).filter((group): group is string => Boolean(group)))].sort(),
        [triggers],
    );
    const {
        allGroups,
        ConfirmModal,
        copyEndpoint,
        editing,
        form,
        group,
        handlePresetChange,
        handleSubmit,
        closeModal,
        openEdit,
        ownerId,
        ownershipDisabled,
        scope,
        setGroup,
        setOwnerId,
        setScope,
        setShowInputTemplate,
        setTargetUserRole,
        setTeamId,
        showInputTemplate,
        showModal,
        teamId,
        userTime,
        userTz,
    } = useTriggersPane({
        flowId: activeFlowId ?? triggers[0]?.flow_id ?? '',
        triggers,
        groups,
    });

    const sortedTriggers = useMemo(
        () => [...triggers].sort((left, right) => (
            left.flow.name.localeCompare(right.flow.name)
            || left.label.localeCompare(right.label)
        )),
        [triggers],
    );
    const pageCount = Math.max(1, Math.ceil(sortedTriggers.length / PAGE_SIZE));

    useEffect(() => {
        setPage(current => Math.min(current, pageCount));
    }, [pageCount]);

    const pageTriggers = sortedTriggers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const flowGroups = useMemo(() => {
        const groups = new Map<Id, { flow: ProfileTrigger['flow']; triggers: ProfileTrigger[] }>();
        pageTriggers.forEach(trigger => {
            const group = groups.get(trigger.flow.id);
            if (group) {
                group.triggers.push(trigger);
            } else {
                groups.set(trigger.flow.id, { flow: trigger.flow, triggers: [trigger] });
            }
        });
        return [...groups.values()];
    }, [pageTriggers]);

    const startEditing = (trigger: ProfileTrigger) => {
        setActiveFlowId(trigger.flow_id);
        openEdit(trigger);
    };

    const toggleTrigger = (trigger: ProfileTrigger) => {
        router.put(`/triggers/${trigger.id}`, { is_active: !trigger.is_active }, {
            preserveScroll: true,
            preserveState: true,
            onStart: () => setTogglingId(trigger.id),
            onError: () => toast('Unable to update trigger', 'error'),
            onFinish: () => setTogglingId(null),
        });
    };

    const firstItem = sortedTriggers.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const lastItem = Math.min(page * PAGE_SIZE, sortedTriggers.length);
    const editingProfileTrigger = editing
        ? triggers.find(trigger => trigger.id === editing.id) ?? null
        : null;

    return (
        <S.Section>
            <S.Header>
                <S.HeaderCopy>
                    <S.Title>Triggers</S.Title>
                    <S.Description>
                        Manage every trigger you own in this workspace, grouped by flow.
                    </S.Description>
                </S.HeaderCopy>
                <S.Total>
                    <S.TotalValue>{triggers.length}</S.TotalValue>
                    <S.TotalLabel>{triggers.length === 1 ? 'trigger' : 'triggers'}</S.TotalLabel>
                </S.Total>
            </S.Header>

            {sortedTriggers.length === 0 ? (
                <S.Empty>
                    <S.EmptyIcon>
                        <Icon icon="lucide:zap" width={22} />
                    </S.EmptyIcon>
                    <S.EmptyTitle>No triggers yet</S.EmptyTitle>
                    <S.EmptyText>Triggers created from your flows will appear here.</S.EmptyText>
                </S.Empty>
            ) : (
                <S.FlowList>
                    {flowGroups.map(group => (
                        <S.FlowGroup key={group.flow.id}>
                            <S.FlowHeader>
                                <S.FlowIdentity>
                                    <S.FlowRail />
                                    <S.FlowLink href={`/flows/${group.flow.id}`}>
                                        {group.flow.name}
                                        <Icon icon="lucide:arrow-up-right" width={13} />
                                    </S.FlowLink>
                                </S.FlowIdentity>
                                <S.FlowCount>
                                    {group.triggers.length} {group.triggers.length === 1 ? 'trigger' : 'triggers'}
                                </S.FlowCount>
                            </S.FlowHeader>

                            <S.TriggerList>
                                {group.triggers.map(trigger => {
                                    const configLabel = trigger.type === 'cron'
                                        ? String(trigger.config?.cron_expression ?? 'No schedule')
                                        : 'Webhook endpoint';

                                    return (
                                        <S.TriggerRow key={trigger.id} $inactive={!trigger.is_active}>
                                            <S.TriggerIcon $active={trigger.is_active}>
                                                <Icon
                                                    icon={trigger.type === 'webhook' ? 'lucide:webhook' : 'lucide:clock'}
                                                    width={16}
                                                />
                                            </S.TriggerIcon>

                                            <S.TriggerDetails>
                                                <S.TriggerTopline>
                                                    <S.TriggerName>{trigger.label}</S.TriggerName>
                                                    <S.TypeBadge>{trigger.type === 'cron' ? 'Schedule' : 'Webhook'}</S.TypeBadge>
                                                    {trigger.group && <S.GroupBadge>{trigger.group}</S.GroupBadge>}
                                                </S.TriggerTopline>
                                                <S.TriggerMeta>
                                                    <S.ConfigValue>{configLabel}</S.ConfigValue>
                                                    <S.MetaSeparator />
                                                    <S.LastRun>
                                                        {trigger.last_triggered_at
                                                            ? `Last triggered ${formatDateTime(trigger.last_triggered_at, {
                                                                dateStyle: 'medium',
                                                                timeStyle: 'short',
                                                            })}`
                                                            : 'Never triggered'}
                                                    </S.LastRun>
                                                </S.TriggerMeta>
                                            </S.TriggerDetails>

                                            <S.RowActions>
                                                {trigger.type === 'webhook' && trigger.endpoint_url && (
                                                    <S.IconButton
                                                        type="button"
                                                        title="Copy endpoint"
                                                        aria-label={`Copy endpoint for ${trigger.label}`}
                                                        onClick={() => copyEndpoint(trigger)}
                                                    >
                                                        <Icon icon="lucide:copy" width={14} />
                                                    </S.IconButton>
                                                )}
                                                <S.IconButton
                                                    type="button"
                                                    title="Edit trigger"
                                                    aria-label={`Edit ${trigger.label}`}
                                                    onClick={() => startEditing(trigger)}
                                                >
                                                    <Icon icon="lucide:pencil" width={14} />
                                                </S.IconButton>
                                                <Switch
                                                    id={`profile-trigger-${trigger.id}`}
                                                    checked={trigger.is_active}
                                                    disabled={togglingId === trigger.id}
                                                    ariaLabel={`${trigger.is_active ? 'Disable' : 'Enable'} ${trigger.label}`}
                                                    onChange={() => toggleTrigger(trigger)}
                                                />
                                            </S.RowActions>
                                        </S.TriggerRow>
                                    );
                                })}
                            </S.TriggerList>
                        </S.FlowGroup>
                    ))}
                </S.FlowList>
            )}

            {sortedTriggers.length > 0 && (
                <S.Pagination>
                    <S.PageSummary>{firstItem}-{lastItem} of {sortedTriggers.length}</S.PageSummary>
                    <S.PageControls>
                        <S.PageButton
                            type="button"
                            disabled={page === 1}
                            aria-label="Previous trigger page"
                            onClick={() => setPage(current => Math.max(1, current - 1))}
                        >
                            <Icon icon="lucide:chevron-left" width={14} />
                        </S.PageButton>
                        <S.PageNumber>Page {page} of {pageCount}</S.PageNumber>
                        <S.PageButton
                            type="button"
                            disabled={page === pageCount}
                            aria-label="Next trigger page"
                            onClick={() => setPage(current => Math.min(pageCount, current + 1))}
                        >
                            <Icon icon="lucide:chevron-right" width={14} />
                        </S.PageButton>
                    </S.PageControls>
                </S.Pagination>
            )}

            <TriggerFormModal
                flowId={editingProfileTrigger?.flow_id ?? activeFlowId ?? ''}
                isOpen={showModal}
                editing={editing}
                data={form.data}
                errors={form.errors}
                processing={form.processing}
                group={group}
                groups={allGroups}
                scope={scope}
                teamId={teamId}
                ownerId={ownerId}
                teams={teams}
                workspaceProxies={workspaceProxies}
                canManageWorkspaceProxies={canManageWorkspaceProxies}
                flowProxyChoice={toProxyChoice(
                    editingProfileTrigger?.flow.proxy_mode ?? 'none',
                    editingProfileTrigger?.flow.workspace_proxy_id ?? null,
                )}
                ownershipDisabled={ownershipDisabled}
                showInputTemplate={showInputTemplate}
                timezone={userTz}
                userTime={userTime}
                onClose={closeModal}
                onSubmit={handleSubmit}
                onFieldChange={form.setData}
                onProxyChange={selection => form.setData(previous => ({ ...previous, ...selection }))}
                onGroupChange={setGroup}
                onScopeChange={(newScope, newTeamId) => {
                    setScope(newScope);
                    setTeamId(newTeamId);
                }}
                onOwnerChange={setOwnerId}
                onOwnerRoleChange={setTargetUserRole}
                onCronPresetChange={handlePresetChange}
                onInputTemplateVisibilityChange={setShowInputTemplate}
                onCopyEndpoint={copyEndpoint}
            />
            <ConfirmModal />
        </S.Section>
    );
}
