import { Fragment } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { useExplorer, useExplorerView } from '../../../ExplorerContext';
import { useFolderTreeContext } from '../../treeContext';
import TreeBranch from '../TreeBranch';
import TreeSectionRow from '../TreeSectionRow';
import { TreeDivider } from '../shared.styled';

export default function UsersTreeSection() {
    const { config: { basePath }, data: { userTrees, filters } } = useExplorer();
    const { isUsersView } = useExplorerView();
    const { expandedSections, toggleSection } = useFolderTreeContext();
    if (userTrees.length === 0) return null;

    const expanded = expandedSections.users ?? false;

    return (
        <>
            <TreeDivider />
            <TreeSectionRow
                href={`${basePath}?view=users`}
                label="Users"
                icon={<Icon icon="lucide:users" />}
                active={isUsersView}
                expanded={expanded}
                hasContent
                onToggle={() => toggleSection('users')}
            />
            {expanded && userTrees.map((user) => {
                const sectionKey = `user_${user.id}`;
                const userExpanded = expandedSections[sectionKey] ?? false;

                return (
                    <Fragment key={user.id}>
                        <TreeSectionRow
                            href={`${basePath}?owner_id=${user.id}`}
                            label={user.name}
                            icon={<Icon icon="lucide:user" />}
                            depth={1}
                            active={filters.owner_id === user.id}
                            expanded={userExpanded}
                            hasContent={user.tree.length > 0 || user.rootItems.length > 0}
                            onToggle={() => toggleSection(sectionKey)}
                        />
                        {userExpanded && <TreeBranch folders={user.tree} items={user.rootItems} depth={2} ownerId={user.id} />}
                    </Fragment>
                );
            })}
        </>
    );
}
