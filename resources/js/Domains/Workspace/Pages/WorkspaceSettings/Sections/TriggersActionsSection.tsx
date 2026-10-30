import React from 'react';
import { router } from '@inertiajs/react';
import Switch from '@/Shared/UI/Switch/Switch';
import type { Workspace } from '@/Domains/Workspace/types';
import * as S from './TriggersActionsSection.styled';

interface Props {
    workspace: Workspace;
    readOnly?: boolean;
}

export default function TriggersActionsSection({ workspace, readOnly }: Props) {
    const handleToggleAdvertising = (value: boolean) => {
        if (readOnly) return;
        const data: Pick<Workspace, 'allow_trigger_advertising'> = {
            allow_trigger_advertising: value,
        };
        router.put('/workspace', data, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleToggleFlowRunAccess = (value: boolean) => {
        if (readOnly) return;
        const data: Pick<Workspace, 'flow_run_access_follows_visibility'> = {
            flow_run_access_follows_visibility: value,
        };
        router.put('/workspace', data, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    return (
        <S.Column>
            <S.Setting>
                <Switch
                    id="allow_trigger_advertising"
                    checked={workspace.allow_trigger_advertising ?? true}
                    onChange={handleToggleAdvertising}
                    label="Allow members to advertise triggers/actions"
                    disabled={readOnly}
                />
                <S.FieldHint>
                    Advertising makes a flow's triggers and actions discoverable by other authorized workspace members so they can reuse them from their own automations. It does not change who can run the flow.
                </S.FieldHint>
            </S.Setting>

            <S.Setting>
                <Switch
                    id="flow_run_access_follows_visibility"
                    checked={workspace.flow_run_access_follows_visibility ?? false}
                    onChange={handleToggleFlowRunAccess}
                    label="Allow flow viewers to access runs"
                    disabled={readOnly}
                />
                <S.FieldHint>
                    Anyone who can view a flow through workspace or team visibility can also view all of its runs, including outputs, logs, screenshots, downloads and recordings. Run control and deletion permissions do not change.
                </S.FieldHint>
            </S.Setting>
        </S.Column>
    );
}
