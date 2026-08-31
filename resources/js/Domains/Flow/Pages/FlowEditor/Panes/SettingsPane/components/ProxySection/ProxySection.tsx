import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import CustomSelect from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodeConfigModal/components/CustomSelect/CustomSelect';
import type { FlowEditorProps } from '@/Domains/Flow/Pages/FlowEditor/types';
import type { ProxyFilterRule } from '@/Domains/Flow/types';
import type { SettingsForm } from '@/Domains/Flow/Pages/FlowEditor/Panes/SettingsPane/types';
import WorkspaceProxyFormModal from '@/Domains/Workspace/Pages/WorkspaceSettings/Sections/ProxiesSection/WorkspaceProxyFormModal';
import { countryFlag, getCountryName } from '@/Domains/Workspace/Pages/WorkspaceSettings/Sections/ProxiesSection/countries';
import type { WorkspaceProxy } from '@/Domains/Workspace/types';
import * as S from './styled';

interface ProxySectionProps {
    form: SettingsForm;
    workspaceProxies: FlowEditorProps['workspaceProxies'];
    teams: FlowEditorProps['teams'];
    canManageWorkspaceProxies: boolean;
}

const FIELDS: { value: ProxyFilterRule['field']; label: string }[] = [
    { value: 'country_code', label: 'Country' },
    { value: 'group', label: 'Group' },
];

const OPERATORS: { value: ProxyFilterRule['operator']; label: string }[] = [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
];

export default function ProxySection({
    form,
    workspaceProxies,
    teams,
    canManageWorkspaceProxies,
}: ProxySectionProps) {
    const [refreshingProxies, setRefreshingProxies] = useState(false);
    const [proxyModalOpen, setProxyModalOpen] = useState(false);
    const createResolverRef = useRef<((value: string | null) => void) | null>(null);
    const selectedProxyUnavailable = form.data.proxy_mode === 'specific'
        && form.data.workspace_proxy_id !== null
        && !workspaceProxies.some(proxy => proxy.id === form.data.workspace_proxy_id);
    const selectedProxyValue = form.data.proxy_mode === 'specific'
        && form.data.workspace_proxy_id !== null
        ? `proxy:${form.data.workspace_proxy_id}`
        : form.data.proxy_mode;
    const countries = useMemo(
        () => Array.from(new Set(
            workspaceProxies
                .map(proxy => proxy.country_code)
                .filter((value): value is string => Boolean(value)),
        )).sort(),
        [workspaceProxies],
    );
    const groups = useMemo(
        () => Array.from(new Set(
            workspaceProxies
                .map(proxy => proxy.group)
                .filter((value): value is string => Boolean(value)),
        )).sort((a, b) => a.localeCompare(b)),
        [workspaceProxies],
    );
    const proxyOptions = useMemo(() => [
        {
            value: 'none',
            label: 'None',
            detail: 'Connect directly without a proxy',
            icon: 'lucide:ban',
        },
        {
            value: 'auto',
            label: 'Auto (round-robin)',
            detail: 'Rotate through the available proxy pool',
            icon: 'lucide:refresh-cw',
        },
        ...(selectedProxyUnavailable ? [{
            value: `proxy:${form.data.workspace_proxy_id}`,
            label: 'Unavailable proxy',
            detail: 'This proxy is no longer available to you',
            icon: 'lucide:triangle-alert',
        }] : []),
        ...workspaceProxies.map(proxy => ({
            value: `proxy:${proxy.id}`,
            label: proxy.label,
            detail: proxy.group ?? '',
            iconText: proxy.country_code ? countryFlag(proxy.country_code) : '🌐',
        })),
    ], [form.data.workspace_proxy_id, selectedProxyUnavailable, workspaceProxies]);
    const groupedRules = useMemo(() => {
        const grouped = new Map<number, { rule: ProxyFilterRule; index: number }[]>();
        form.data.proxy_filter_rules.forEach((rule, index) => {
            const entries = grouped.get(rule.rule_group) ?? [];
            entries.push({ rule, index });
            grouped.set(rule.rule_group, entries);
        });

        return Array.from(grouped.entries()).sort(([a], [b]) => a - b);
    }, [form.data.proxy_filter_rules]);

    useEffect(() => () => {
        createResolverRef.current?.(null);
        createResolverRef.current = null;
    }, []);

    const refreshProxies = () => new Promise<void>(resolve => {
        setRefreshingProxies(true);
        router.reload({
            only: ['workspaceProxies'],
            onFinish: () => {
                setRefreshingProxies(false);
                resolve();
            },
        });
    });

    const createProxy = () => new Promise<string | null>(resolve => {
        createResolverRef.current = resolve;
        setProxyModalOpen(true);
    });

    const closeProxyModal = () => {
        setProxyModalOpen(false);
        createResolverRef.current?.(null);
        createResolverRef.current = null;
    };

    const handleProxySaved = async (proxy: WorkspaceProxy) => {
        setProxyModalOpen(false);
        await refreshProxies();
        createResolverRef.current?.(`proxy:${proxy.id}`);
        createResolverRef.current = null;
    };

    const handleProxyChange = (value: string) => {
        if (value.startsWith('proxy:')) {
            form.setData(data => ({
                ...data,
                proxy_mode: 'specific',
                workspace_proxy_id: Number(value.slice(6)),
            }));
            return;
        }
        form.setData(data => ({
            ...data,
            proxy_mode: value as 'none' | 'auto',
            workspace_proxy_id: null,
        }));
    };

    const optionsForField = (field: ProxyFilterRule['field'], currentValue = '') => {
        const values = field === 'country_code' ? countries : groups;
        return currentValue && !values.includes(currentValue)
            ? [currentValue, ...values]
            : values;
    };

    const valueOptionsForRule = (rule: ProxyFilterRule) => (
        optionsForField(rule.field, rule.value).map(value => (
            rule.field === 'country_code'
                ? {
                    value,
                    label: getCountryName(value) || value,
                    detail: value,
                    iconText: countryFlag(value),
                }
                : {
                    value,
                    label: value,
                    icon: 'lucide:folder',
                }
        ))
    );

    const defaultRule = (ruleGroup: number): ProxyFilterRule | null => {
        if (countries.length > 0) {
            return { rule_group: ruleGroup, field: 'country_code', operator: 'equals', value: countries[0] };
        }
        if (groups.length > 0) {
            return { rule_group: ruleGroup, field: 'group', operator: 'equals', value: groups[0] };
        }

        return null;
    };

    const addRule = (ruleGroup: number) => {
        const rule = defaultRule(ruleGroup);
        if (rule) form.setData('proxy_filter_rules', [...form.data.proxy_filter_rules, rule]);
    };

    const addRuleGroup = () => {
        const usedGroups = new Set(groupedRules.map(([ruleGroup]) => ruleGroup));
        const nextGroup = Array.from({ length: 50 }, (_, index) => index)
            .find(ruleGroup => !usedGroups.has(ruleGroup));
        if (nextGroup !== undefined) addRule(nextGroup);
    };

    const updateRule = <K extends keyof ProxyFilterRule>(
        index: number,
        field: K,
        value: ProxyFilterRule[K],
    ) => {
        form.setData('proxy_filter_rules', form.data.proxy_filter_rules.map((rule, ruleIndex) => {
            if (ruleIndex !== index) return rule;
            if (field !== 'field') return { ...rule, [field]: value };

            const nextField = value as ProxyFilterRule['field'];
            return {
                ...rule,
                field: nextField,
                value: optionsForField(nextField)[0] ?? '',
            };
        }));
    };

    const removeRule = (index: number) => {
        form.setData(
            'proxy_filter_rules',
            form.data.proxy_filter_rules.filter((_, ruleIndex) => ruleIndex !== index),
        );
    };

    const summary = form.data.proxy_filter_rules.length === 0
        ? 'All proxies available to the user are included.'
        : groupedRules.map(([, entries]) => `(${entries.map(({ rule }) => {
            const field = rule.field === 'country_code' ? 'Country' : 'Group';
            const operator = rule.operator === 'equals' ? '=' : '≠';
            return `${field} ${operator} ${rule.value}`;
        }).join(' AND ')})`).join(' OR ');
    const canAddRules = countries.length > 0 || groups.length > 0;

    return (
        <>
            <S.SettingsSeparator />
            <S.SettingsSectionLabel>Proxy routing</S.SettingsSectionLabel>

            <S.ProxyField>
                <S.ProxyLabel>Mode</S.ProxyLabel>
                <CustomSelect
                    value={selectedProxyValue}
                    options={proxyOptions}
                    searchThreshold={0}
                    showOptionValue={false}
                    placeholder="Select a proxy..."
                    ariaLabel="Proxy"
                    invalid={Boolean(form.errors.proxy_mode || form.errors.workspace_proxy_id)}
                    onChange={handleProxyChange}
                    onRefresh={refreshProxies}
                    refreshing={refreshingProxies}
                    actionSlot={canManageWorkspaceProxies ? {
                        label: '+ Add proxy',
                        onAction: createProxy,
                    } : undefined}
                />
                {(form.errors.proxy_mode || form.errors.workspace_proxy_id) && (
                    <S.ProxyError>{form.errors.proxy_mode || form.errors.workspace_proxy_id}</S.ProxyError>
                )}
            </S.ProxyField>
            <S.SettingsHint>
                Auto rotates through the proxy pool available to the user who starts the run.
            </S.SettingsHint>

            {form.data.proxy_mode === 'auto' && (
                <S.RulesWrap>
                    <S.RulesHeader>
                        <S.RulesTitle>Pool filters</S.RulesTitle>
                        <S.RulesHint>Rules in a group use AND. Groups use OR.</S.RulesHint>
                    </S.RulesHeader>

                    {groupedRules.map(([ruleGroup, entries], groupIndex) => (
                        <Fragment key={ruleGroup}>
                            {groupIndex > 0 && <S.OrDivider>OR</S.OrDivider>}
                            <S.RuleGroup>
                                <S.RuleGroupLabel>Group {groupIndex + 1} (AND)</S.RuleGroupLabel>
                                {entries.map(({ rule, index }) => (
                                    <S.RuleRow key={index}>
                                        <S.RuleSelect
                                            value={rule.field}
                                            onChange={event => updateRule(
                                                index,
                                                'field',
                                                event.target.value as ProxyFilterRule['field'],
                                            )}
                                        >
                                            {FIELDS.map(field => (
                                                <option
                                                    key={field.value}
                                                    value={field.value}
                                                    disabled={field.value === 'country_code'
                                                        ? countries.length === 0
                                                        : groups.length === 0}
                                                >
                                                    {field.label}
                                                </option>
                                            ))}
                                        </S.RuleSelect>
                                        <S.RuleSelect
                                            value={rule.operator}
                                            onChange={event => updateRule(
                                                index,
                                                'operator',
                                                event.target.value as ProxyFilterRule['operator'],
                                            )}
                                        >
                                            {OPERATORS.map(operator => (
                                                <option key={operator.value} value={operator.value}>{operator.label}</option>
                                            ))}
                                        </S.RuleSelect>
                                        <CustomSelect
                                            value={rule.value}
                                            options={valueOptionsForRule(rule)}
                                            compact
                                            compactHeight={28}
                                            dropdownMinWidth={180}
                                            searchThreshold={0}
                                            showOptionValue={false}
                                            ariaLabel={rule.field === 'country_code' ? 'Proxy country' : 'Proxy group'}
                                            onChange={value => updateRule(index, 'value', value)}
                                        />
                                        <S.RemoveRuleButton
                                            type="button"
                                            title="Remove filter"
                                            onClick={() => removeRule(index)}
                                        >
                                            <Icon icon="lucide:x" width={13} />
                                        </S.RemoveRuleButton>
                                    </S.RuleRow>
                                ))}
                                <S.AddRuleButton
                                    type="button"
                                    disabled={!canAddRules || form.data.proxy_filter_rules.length >= 50}
                                    onClick={() => addRule(ruleGroup)}
                                >
                                    <Icon icon="lucide:plus" width={12} /> Add rule (AND)
                                </S.AddRuleButton>
                            </S.RuleGroup>
                        </Fragment>
                    ))}

                    <S.AddRuleButton
                        type="button"
                        disabled={!canAddRules || form.data.proxy_filter_rules.length >= 50}
                        onClick={addRuleGroup}
                    >
                        <Icon icon="lucide:plus" width={12} /> Add rule group (OR)
                    </S.AddRuleButton>
                    {!canAddRules && (
                        <S.SettingsHint>Add a country or group to a proxy before filtering the pool.</S.SettingsHint>
                    )}
                    {form.errors.proxy_filter_rules && (
                        <S.ProxyError>{form.errors.proxy_filter_rules}</S.ProxyError>
                    )}
                    <S.Summary>{summary}</S.Summary>
                </S.RulesWrap>
            )}

            <WorkspaceProxyFormModal
                isOpen={proxyModalOpen}
                teams={teams}
                groups={groups}
                zIndex={1050}
                onClose={closeProxyModal}
                onSaved={proxy => { void handleProxySaved(proxy); }}
            />
        </>
    );
}
