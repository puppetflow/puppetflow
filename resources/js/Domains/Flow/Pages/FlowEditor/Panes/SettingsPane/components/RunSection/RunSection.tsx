import Input, { Select } from '@/Shared/UI/Input/Input';
import Switch from '@/Shared/UI/Switch/Switch';
import { capDefault } from '@/Shared/Utils/limits';
import type { SettingsForm } from '@/Domains/Flow/Pages/FlowEditor/Panes/SettingsPane/types';
import type { SettingsLimits } from '@/Domains/Flow/Pages/FlowEditor/Panes/SettingsPane/useSettingsLimits';
import { formatTimeoutLimit } from '@/Domains/Flow/Pages/FlowEditor/Panes/SettingsPane/utils';
import * as S from './styled';

interface RunSectionProps {
    form: SettingsForm;
    limits: SettingsLimits;
    isNodalFlow: boolean;
}

export default function RunSection({
    form,
    limits,
    isNodalFlow,
}: RunSectionProps) {
    const {
        effectiveMaxTimeout,
        queuesCounter,
        rawWsMaxRetries,
        workspaceDefaultTimeout,
        wsMax,
        wsMaxRetries,
    } = limits;

    return (
        <>
            <S.SettingsSeparator />
            <S.SettingsSectionLabel>Run</S.SettingsSectionLabel>

            <Select
                label="Queue"
                value={form.data.queue_index === null ? '' : String(form.data.queue_index)}
                onChange={event => form.setData(
                    'queue_index',
                    event.target.value === '' ? null : Number(event.target.value),
                )}
                options={[
                    { value: '', label: 'Auto' },
                    ...Array.from({ length: queuesCounter }, (_, index) => ({
                        value: String(index + 1),
                        label: `Queue ${index + 1}`,
                    })),
                ]}
                error={form.errors.queue_index}
            />
            <S.SettingsHint>
                Auto selects the queue with the smallest active backlog.
            </S.SettingsHint>

            <Input
                label="Timeout (seconds)"
                type="number"
                min={effectiveMaxTimeout > 0 ? 5 : 0}
                max={effectiveMaxTimeout > 0 ? effectiveMaxTimeout : undefined}
                value={String(form.data.timeout_seconds)}
                onChange={e => {
                    const value = Number(e.target.value);
                    form.setData('timeout_seconds', effectiveMaxTimeout > 0
                        ? value === 0 ? workspaceDefaultTimeout : Math.min(value, effectiveMaxTimeout)
                        : value);
                }}
                error={form.errors.timeout_seconds}
            />
            <S.SettingsHint>
                Maximum timeout for this flow.
                {effectiveMaxTimeout > 0
                    ? ' 0 is disabled because a maximum cap is defined.'
                    : workspaceDefaultTimeout > 0 ? ' 0 = use workspace default.' : ' 0 = unlimited.'}
                {' '}Maximum cap: {formatTimeoutLimit(effectiveMaxTimeout)}.
            </S.SettingsHint>

            <Input
                label="Estimated human time (seconds)"
                type="number"
                min={0}
                value={String(form.data.operator_seconds)}
                onChange={e => form.setData('operator_seconds', Number(e.target.value))}
                error={form.errors.operator_seconds}
            />
            <S.SettingsHint>Estimated time a human operator would spend on one successful run.</S.SettingsHint>

            <Input
                label="Max Retries"
                type="number"
                min={rawWsMaxRetries > 0 ? 1 : 0}
                max={wsMaxRetries}
                value={String(form.data.max_retries)}
                onChange={e => form.setData('max_retries', rawWsMaxRetries > 0
                    ? capDefault(Number(e.target.value), wsMaxRetries)
                    : Math.min(Number(e.target.value), wsMaxRetries))}
                error={form.errors.max_retries}
            />
            <S.SettingsHint>
                Number of automatic retries on failure.
                {rawWsMaxRetries > 0 ? ' 0 is disabled because a workspace cap is defined.' : ' 0 = use workspace default.'}
                {' '}Maximum cap: {wsMaxRetries}.
            </S.SettingsHint>

            <Input
                label="Run retention limit"
                type="number"
                min={wsMax > 0 ? 1 : 0}
                max={wsMax > 0 ? wsMax : undefined}
                value={String(form.data.runs_retention_limit)}
                onChange={e => form.setData('runs_retention_limit', capDefault(Number(e.target.value), wsMax))}
                error={form.errors.runs_retention_limit}
            />
            <S.SettingsHint>
                Number of runs to keep for this flow.
                {wsMax > 0 ? ' 0 is disabled because a maximum cap is defined.' : ' 0 = use workspace default.'}
                {wsMax > 0 && ` Workspace cap: ${wsMax}.`}
            </S.SettingsHint>

            {isNodalFlow && (
                <>
                    <Switch
                        id="finally_enabled"
                        checked={form.data.finally_enabled}
                        onChange={value => form.setData('finally_enabled', value)}
                        label="FINALLY node"
                    />
                    <S.SettingsHint>
                        Show the FINALLY branch in the visual builder to add cleanup steps that run after the flow,
                        even when it fails. When off, the branch is hidden and skipped at run time but kept for later.
                    </S.SettingsHint>
                </>
            )}
        </>
    );
}
