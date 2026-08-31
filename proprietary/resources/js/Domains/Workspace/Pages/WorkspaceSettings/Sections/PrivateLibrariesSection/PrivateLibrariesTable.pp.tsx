import { Fragment } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import TableCellContent from '@/Shared/UI/TableCellContent/TableCellContent';
import type { GroupedSection } from '@/Shared/Utils/groupHierarchicalItems';
import PrivateLibraryRow from './PrivateLibraryRow.pp';
import type { PrivateLibrary } from '@proprietary/Domains/Workspace/Pages/WorkspaceSettings/Sections/PrivateLibrariesSection/types.pp';
import * as S from '@proprietary/Domains/Workspace/Pages/WorkspaceSettings/Sections/PrivateLibrariesSection/PrivateLibrariesTable.styled.pp';

interface Props {
    groups: GroupedSection<PrivateLibrary>[];
    collapsedGroups: Set<string>;
    isGroupHidden: (group: string) => boolean;
    busyId: number | null;
    readOnly: boolean;
    onToggleGroup: (group: string) => void;
    onEdit: (library: PrivateLibrary) => void;
    onRefresh: (library: PrivateLibrary) => void;
    onDelete: (library: PrivateLibrary) => void;
}

export default function PrivateLibrariesTable({
    groups,
    collapsedGroups,
    isGroupHidden,
    busyId,
    readOnly,
    onToggleGroup,
    onEdit,
    onRefresh,
    onDelete,
}: Props) {
    return (
        <S.Wrapper>
            <S.Table>
                <thead>
                    <tr>
                        <th>Library</th>
                        <th>Repository</th>
                        <th>Branch</th>
                        <th>Blueprints</th>
                        <th>Cache</th>
                        <th>Visibility</th>
                        <th>Owner</th>
                        <th aria-label="Actions" />
                    </tr>
                </thead>
                <tbody>
                    {groups.map(section => {
                        const lastHeader = section.headers[section.headers.length - 1];
                        const itemIndent = lastHeader ? (lastHeader.depth + 1) * 16 : 0;
                        const hideItems = section.group ? isGroupHidden(section.group) : false;
                        const visibleHeaders = section.headers.filter(header => {
                            const parentKey = header.key.split('/').slice(0, -1).join('/');
                            return !parentKey || !isGroupHidden(parentKey);
                        });
                        if (hideItems && visibleHeaders.length === 0) return null;

                        return (
                            <Fragment key={section.group ?? 'ungrouped'}>
                                {visibleHeaders.map(header => (
                                    <S.GroupRow key={header.key}>
                                        <td colSpan={8}>
                                            <TableCellContent>
                                                <S.GroupButton
                                                    type="button"
                                                    $depth={header.depth}
                                                    onClick={() => onToggleGroup(header.key)}
                                                >
                                                    <Icon
                                                        icon={collapsedGroups.has(header.key)
                                                            ? 'lucide:chevron-right'
                                                            : 'lucide:chevron-down'}
                                                        width={13}
                                                    />
                                                    <Icon icon="lucide:folder" width={13} />
                                                    {header.label}
                                                    <S.GroupCount>{header.count}</S.GroupCount>
                                                </S.GroupButton>
                                            </TableCellContent>
                                        </td>
                                    </S.GroupRow>
                                ))}
                                {!hideItems && section.items.map(library => (
                                    <PrivateLibraryRow
                                        key={library.id}
                                        library={library}
                                        busy={busyId === library.id}
                                        readOnly={readOnly}
                                        indent={itemIndent}
                                        onEdit={onEdit}
                                        onRefresh={onRefresh}
                                        onDelete={onDelete}
                                    />
                                ))}
                            </Fragment>
                        );
                    })}
                </tbody>
            </S.Table>
        </S.Wrapper>
    );
}
