import { Icon } from '@/Shared/UI/Icon/Icon';
import FlowIcon from '@/Shared/UI/FlowIcon/FlowIcon';
import { ButtonLink } from '@/Shared/UI/Button/Button';
import type { ExplorerConfig } from '@/Shared/Explorer/types';
import { isOwnerOrAdmin } from '@/Shared/Explorer/ExplorerContent/utils';
import type { Flow } from '@/Domains/Flow/types';
import FlowRow from './FlowRow/FlowRow';
import FlowSidebarProvider from './FlowSidebarProvider/FlowSidebarProvider';
import FlowExplorerCard from './FlowExplorerCard';

// Flow specific adapter for the shared explorer kit.
export const flowExplorerConfig: ExplorerConfig<Flow> = {
    key: 'flows',
    basePath: '/flows',
    title: 'Flow Explorer',
    documentationPath: '/guide/flows',
    documentationLabel: 'Open flows documentation',
    dragType: 'flow',
    labels: {
        item: 'flow',
        items: 'flows',
        searchPlaceholder: 'Search flows...',
        emptyTitle: 'No flows yet',
        emptyDescription: 'Create your first flow to get started',
        sharedEmptyDescription: 'Flows shared with the workspace will appear here',
        deleteFolderWarning: 'All flows, their run history, recordings, screenshots and downloads will be lost. This action cannot be undone.',
    },
    endpoints: {
        folders: '/folders',
        moveItem: id => `/flows/${id}/move`,
        batchDelete: '/flows/batch-delete',
    },
    canManageItem: isOwnerOrAdmin,
    renderItemCard: props => <FlowExplorerCard {...props} />,
    renderItemIcon: flow => <FlowIcon flow={flow} size={16} radius="xs" />,
    renderTreeItem: ({ item, depth }) => <FlowRow flow={item} depth={depth} />,
    renderEmptyAction: () => (
        <ButtonLink href="/flows/create">
            <Icon icon="lucide:plus" />
            Create Flow
        </ButtonLink>
    ),
    SidebarProvider: FlowSidebarProvider,
};
