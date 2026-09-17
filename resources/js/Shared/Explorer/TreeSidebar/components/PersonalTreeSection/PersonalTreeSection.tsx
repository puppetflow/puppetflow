import { Icon } from '@/Shared/UI/Icon/Icon';
import { useTheme } from 'styled-components';
import { useExplorer, useExplorerView } from '../../../ExplorerContext';
import { useFolderTreeContext } from '../../treeContext';
import TreeBranch from '../TreeBranch';
import TreeSectionRow from '../TreeSectionRow';

export default function PersonalTreeSection() {
    const theme = useTheme();
    const { config: { basePath }, data: { folderTree, rootItems } } = useExplorer();
    const { isWorkspaceView, isUsersView, isOtherOwner } = useExplorerView();
    const { currentFolderId, expandedSections, toggleSection } = useFolderTreeContext();
    const expanded = expandedSections.personal ?? false;

    return (
        <>
            <TreeSectionRow
                href={basePath}
                label="Personal"
                icon={<Icon icon="lucide:home" style={{ color: theme.colors.accent.warning }} />}
                active={currentFolderId === null && !isOtherOwner && !isWorkspaceView && !isUsersView}
                expanded={expanded}
                hasContent={folderTree.length > 0 || rootItems.length > 0}
                onToggle={() => toggleSection('personal')}
            />
            {expanded && <TreeBranch folders={folderTree} items={rootItems} depth={1} />}
        </>
    );
}
