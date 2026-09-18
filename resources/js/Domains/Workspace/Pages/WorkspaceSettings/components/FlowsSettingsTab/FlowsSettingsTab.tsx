import { useMemo, useState } from 'react';
import CollapsibleSection from '@/Shared/UI/CollapsibleSection/CollapsibleSection';
import { useCollapsibleSections } from '@/Shared/Hooks/useCollapsibleSections';
import type { Workspace } from '@/Domains/Workspace/types';
import BrowserSection from '@/Domains/Workspace/Pages/WorkspaceSettings/Sections/BrowserSection';
import DebugSection from '@/Domains/Workspace/Pages/WorkspaceSettings/Sections/DebugSection';
import DefaultFlowCodeSection from '@/Domains/Workspace/Pages/WorkspaceSettings/Sections/DefaultFlowCodeSection';
import PerformanceSection from '@/Domains/Workspace/Pages/WorkspaceSettings/Sections/PerformanceSection';
import RetentionSection from '@/Domains/Workspace/Pages/WorkspaceSettings/Sections/RetentionSection';
import TriggersActionsSection from '@/Domains/Workspace/Pages/WorkspaceSettings/Sections/TriggersActionsSection';
import * as S from '@/Domains/Workspace/Pages/WorkspaceSettings/shared.styled';

type GroupId = 'browser' | 'performance' | 'retention' | 'triggers' | 'debug' | 'default-flow';

const GROUP_IDS: GroupId[] = ['browser', 'performance', 'retention', 'triggers', 'debug', 'default-flow'];
const STORAGE_KEY = 'puppetflow:workspace-flows-settings:open-groups';
const DEFAULT_OPEN: GroupId[] = ['browser'];

interface Props {
    workspace: Workspace;
    readOnly: boolean;
}

export default function FlowsSettingsTab({ workspace, readOnly }: Props) {
    const groups = useCollapsibleSections(STORAGE_KEY, DEFAULT_OPEN);
    const [dirty, setDirty] = useState<Partial<Record<GroupId, boolean>>>({});
    // One stable callback per group so child effects do not re-run on every render.
    const dirtyReporters = useMemo(() => Object.fromEntries(GROUP_IDS.map(id => [
        id,
        (value: boolean) => setDirty(current => (current[id] === value ? current : { ...current, [id]: value })),
    ])) as Record<GroupId, (value: boolean) => void>, []);
    const reportDirty = (id: GroupId) => dirtyReporters[id];

    const groupProps = (id: GroupId) => ({
        open: groups.isOpen(id),
        onToggle: () => groups.toggle(id),
        modified: Boolean(dirty[id]),
    });

    return (
        <S.SectionStack>
            <CollapsibleSection
                icon="lucide:monitor"
                title="Browser"
                description="Default viewport, keyboard speed, user agent and language inherited by every flow"
                docPath="/guide/workspaces#browser"
                docLabel="Open browser settings documentation"
                {...groupProps('browser')}
            >
                <BrowserSection workspace={workspace} readOnly={readOnly} onDirtyChange={reportDirty('browser')} />
            </CollapsibleSection>

            <CollapsibleSection
                icon="lucide:gauge"
                title="Performance"
                description="Default and maximum timeout, automatic retries"
                docPath="/guide/workspaces#performance"
                docLabel="Open performance settings documentation"
                {...groupProps('performance')}
            >
                <PerformanceSection workspace={workspace} readOnly={readOnly} onDirtyChange={reportDirty('performance')} />
            </CollapsibleSection>

            <CollapsibleSection
                icon="lucide:clock"
                title="Run retention"
                description="How many runs each flow keeps by default, and the cap flows cannot exceed"
                docPath="/guide/workspaces#run-retention"
                docLabel="Open run retention documentation"
                {...groupProps('retention')}
            >
                <RetentionSection workspace={workspace} readOnly={readOnly} onDirtyChange={reportDirty('retention')} />
            </CollapsibleSection>

            <CollapsibleSection
                icon="lucide:zap"
                title="Triggers & actions"
                description="Let members advertise their triggers and actions to the workspace"
                docPath="/guide/workspaces#triggers-actions"
                docLabel="Open triggers and actions settings documentation"
                {...groupProps('triggers')}
            >
                <TriggersActionsSection workspace={workspace} readOnly={readOnly} />
            </CollapsibleSection>

            <CollapsibleSection
                icon="lucide:bug"
                title="Debug"
                description="How deeply console logs expand objects and arrays"
                docPath="/guide/workspaces#debug"
                docLabel="Open debug settings documentation"
                {...groupProps('debug')}
            >
                <DebugSection workspace={workspace} readOnly={readOnly} onDirtyChange={reportDirty('debug')} />
            </CollapsibleSection>

            <CollapsibleSection
                icon="lucide:workflow"
                title="Default flow"
                description="Template every new flow starts from"
                docPath="/guide/workspaces#default-flow"
                docLabel="Open default flow documentation"
                {...groupProps('default-flow')}
            >
                <DefaultFlowCodeSection workspace={workspace} readOnly={readOnly} onDirtyChange={reportDirty('default-flow')} />
            </CollapsibleSection>
        </S.SectionStack>
    );
}
