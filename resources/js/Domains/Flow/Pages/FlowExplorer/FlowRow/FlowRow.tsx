import { Icon } from '@/Shared/UI/Icon/Icon';
import FlowIcon from '@/Shared/UI/FlowIcon/FlowIcon';
import { handleLinkClick } from '@/Shared/Utils/navigation';
import type { TreeFlow } from '@/Domains/Folder/types';
import SidebarOverflow from '@/Shared/Explorer/TreeSidebar/components/SidebarOverflow/SidebarOverflow';
import { TreeChevronSpacer, TreeItemLabel } from '@/Shared/Explorer/TreeSidebar/components/shared.styled';
import { MenuDivider, MenuItem } from '@/Shared/Explorer/menu.styled';
import { useFlowSidebarActions } from '../FlowSidebarProvider/flowSidebarContext';
import * as S from './styled';

interface Props {
    flow: TreeFlow;
    depth: number;
}

export default function FlowRow({ flow, depth }: Props) {
    const { canEditFlow, deleteFlow, duplicateFlow, moveFlow, visibilityFlow } = useFlowSidebarActions();
    const canEdit = canEditFlow(flow);
    const flowUrl = `/flows/${flow.id}`;
    const entry = (action: (flow: TreeFlow) => void) => (event: React.MouseEvent) => {
        event.stopPropagation();
        action(flow);
    };

    return (
        <S.Row
            href={flowUrl}
            $depth={depth}
            onClick={(event) => handleLinkClick(event, flowUrl)}
        >
            <TreeChevronSpacer />
            <S.IconSlot>
                <FlowIcon flow={flow} size={16} radius="xs" />
                {flow.library_reference && (
                    <S.ImportedBadge title="Imported from library">
                        <Icon icon="lucide:store" width={10} />
                    </S.ImportedBadge>
                )}
                <SidebarOverflow>
                    {canEdit && (
                        <>
                            <MenuItem onClick={entry(visibilityFlow)}>
                                <Icon icon="lucide:eye" width={13} />
                                Visibility
                            </MenuItem>
                            <MenuDivider />
                            <MenuItem onClick={entry(moveFlow)}>
                                <Icon icon="lucide:folder-input" width={13} />
                                Move Flow
                            </MenuItem>
                            <MenuDivider />
                        </>
                    )}
                    <MenuItem onClick={entry(duplicateFlow)}>
                        <Icon icon="lucide:copy" width={13} />
                        Duplicate
                    </MenuItem>
                    {canEdit && (
                        <>
                            <MenuDivider />
                            <MenuItem $danger onClick={entry(deleteFlow)}>
                                <Icon icon="lucide:trash-2" width={13} />
                                Delete
                            </MenuItem>
                        </>
                    )}
                </SidebarOverflow>
            </S.IconSlot>
            <TreeItemLabel>{flow.name}</TreeItemLabel>
        </S.Row>
    );
}
