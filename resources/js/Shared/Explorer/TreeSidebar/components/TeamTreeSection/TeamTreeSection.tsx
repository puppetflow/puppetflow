import { Icon } from '@/Shared/UI/Icon/Icon';
import { useExplorerConfig, useExplorerView } from '../../../ExplorerContext';
import type { ExplorerItem, ExplorerTeamTree } from '../../../types';
import { useFolderTreeContext } from '../../treeContext';
import TreeBranch from '../TreeBranch';
import TreeSectionRow from '../TreeSectionRow';

interface Props<TItem extends ExplorerItem> {
    team: ExplorerTeamTree<TItem>;
}

export default function TeamTreeSection<TItem extends ExplorerItem>({ team }: Props<TItem>) {
    const { basePath } = useExplorerConfig();
    const { teamId } = useExplorerView();
    const { currentFolderId, expandedSections, toggleSection } = useFolderTreeContext();
    const sectionKey = `team_${team.id}`;
    const expanded = expandedSections[sectionKey] ?? false;
    // Teams either own a physical root folder (flows) or a virtual root (media).
    const href = team.root_folder_id
        ? `${basePath}?folder_id=${team.root_folder_id}&view=workspace`
        : `${basePath}?view=workspace&team_id=${team.id}`;
    const active = team.root_folder_id
        ? currentFolderId === team.root_folder_id
        : currentFolderId === null && String(teamId ?? '') === String(team.id);

    return (
        <>
            <TreeSectionRow
                href={href}
                label={team.name}
                icon={<Icon icon="lucide:users" />}
                depth={1}
                active={active}
                expanded={expanded}
                hasContent={team.tree.length > 0 || team.rootItems.length > 0}
                onToggle={() => toggleSection(sectionKey)}
            />
            {expanded && <TreeBranch folders={team.tree} items={team.rootItems} depth={2} viewParam="workspace" />}
        </>
    );
}
