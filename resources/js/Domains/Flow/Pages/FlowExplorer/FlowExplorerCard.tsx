import FlowCard from '@/Domains/Flow/Components/Flow/FlowCard/FlowCard';
import { useExplorer } from '@/Shared/Explorer/ExplorerContext';
import type { ExplorerItemCardProps } from '@/Shared/Explorer/types';
import type { Flow } from '@/Domains/Flow/types';

// Binds the flow card to the trees exposed by the explorer context.
export default function FlowExplorerCard({ item, variant, selectionActive, selected, onToggleSelect }: ExplorerItemCardProps<Flow>) {
    const { data } = useExplorer<Flow>();

    return (
        <FlowCard
            flow={item}
            variant={variant}
            workspaceTree={data.workspaceTree}
            personalTree={data.folderTree}
            userTrees={data.userTrees}
            teamTrees={data.teamTrees}
            selectionActive={selectionActive}
            selected={selected}
            onToggleSelect={onToggleSelect}
        />
    );
}
