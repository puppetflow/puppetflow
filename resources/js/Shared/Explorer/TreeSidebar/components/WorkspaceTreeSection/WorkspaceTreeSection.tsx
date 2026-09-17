import { Icon } from '@/Shared/UI/Icon/Icon';
import { useTheme } from 'styled-components';
import { usePageProps } from '@/App/Hooks/usePageProps';
import { useExplorer, useExplorerView } from '../../../ExplorerContext';
import { useFolderTreeContext } from '../../treeContext';
import TreeBranch from '../TreeBranch';
import TreeSectionRow from '../TreeSectionRow';
import TeamTreeSection from '../TeamTreeSection/TeamTreeSection';
import { TreeDivider } from '../shared.styled';

export default function WorkspaceTreeSection() {
    const theme = useTheme();
    const { settings } = usePageProps();
    const { config: { basePath }, data: { workspaceTree, workspaceRootItems, teamTrees } } = useExplorer();
    const { isWorkspaceView, teamId } = useExplorerView();
    const { currentFolderId, expandedSections, toggleSection } = useFolderTreeContext();

    const teamsEnabled = settings?.teams_enabled ?? false;
    const enabled = (settings?.workspace_sharing_enabled ?? false) || teamsEnabled;
    if (!enabled && !(settings?.promote_disabled_features ?? false)) return null;

    const expanded = expandedSections.workspace ?? false;

    return (
        <>
            <TreeDivider />
            <TreeSectionRow
                href={`${basePath}?view=workspace`}
                label="Workspace"
                icon={<Icon icon="lucide:building-2" style={{ color: theme.colors.accent.info }} />}
                active={isWorkspaceView && currentFolderId === null && teamId === null}
                expanded={expanded}
                hasContent={workspaceTree.length > 0 || workspaceRootItems.length > 0 || teamTrees.length > 0}
                disabled={!enabled}
                onToggle={() => toggleSection('workspace')}
            />
            {expanded && enabled && (
                <>
                    {teamsEnabled && teamTrees.map(team => <TeamTreeSection key={team.id} team={team} />)}
                    <TreeBranch folders={workspaceTree} items={workspaceRootItems} depth={1} viewParam="workspace" />
                </>
            )}
        </>
    );
}
