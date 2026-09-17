import { useCallback, useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { useAuth } from '@/App/Hooks/usePageProps';
import { useConfirm } from '@/Shared/Hooks/useConfirm';
import { useUrlSyncedModal } from '@/Shared/Hooks/useUrlSyncedModal';
import { useExplorer } from '@/Shared/Explorer/ExplorerContext';
import { allFolderTrees, collectFolders } from '@/Shared/Explorer/ExplorerContent/utils';
import MoveFlowModal from '@/Domains/Flow/Components/MoveFlowModal/MoveFlowModal';
import DuplicateFlowLocationModal from '@/Domains/Flow/Components/DuplicateFlowLocationModal/DuplicateFlowLocationModal';
import VisibilityModal from '@/Domains/Flow/Components/VisibilityModal/VisibilityModal';
import type { TreeFlow } from '@/Domains/Folder/types';
import { FlowSidebarContext, type FlowSidebarActions } from './flowSidebarContext';

// Wraps the shared tree sidebar with the flow specific row actions and their modals.
export default function FlowSidebarProvider({ children }: { children: React.ReactNode }) {
    const { config, data } = useExplorer<TreeFlow>();
    const { folderTree, workspaceTree, teamTrees, userTrees, rootItems, workspaceRootItems } = data;
    const { user } = useAuth();
    const { confirm, ConfirmModal } = useConfirm();
    const [duplicateFlow, setDuplicateFlow] = useState<TreeFlow | null>(null);
    const [savingVisibility, setSavingVisibility] = useState(false);

    const sidebarFlows = useMemo(() => [
        ...rootItems,
        ...workspaceRootItems,
        ...teamTrees.flatMap(team => team.rootItems),
        ...userTrees.flatMap(userTree => userTree.rootItems),
        ...collectFolders(allFolderTrees(data)).flatMap(folder => folder.items),
    ], [data, rootItems, teamTrees, userTrees, workspaceRootItems]);

    const {
        selectedItem: moveFlow,
        openModal: openMoveFlow,
        closeModal: closeMoveFlow,
    } = useUrlSyncedModal(sidebarFlows, 'edit-sidebar-flow-location');
    const {
        selectedItem: visibilityFlow,
        openModal: openVisibilityFlow,
        closeModal: closeVisibilityFlow,
    } = useUrlSyncedModal(sidebarFlows, 'edit-sidebar-flow-visibility');

    const canEditFlow = useCallback((flow: TreeFlow) => config.canManageItem(flow, user), [config, user]);

    const handleDeleteFlow = useCallback(async (flow: TreeFlow) => {
        const confirmed = await confirm({
            title: 'Delete Flow',
            message: `Are you sure you want to delete "${flow.name}"? All runs, recordings, screenshots and downloads will be permanently lost.`,
            confirmLabel: 'Delete',
            variant: 'danger',
        });
        if (confirmed) {
            router.delete(`/flows/${flow.id}`, {
                data: { redirect_url: window.location.pathname + window.location.search },
                preserveState: false,
            });
        }
    }, [confirm]);

    const handleVisibilityConfirm = useCallback((payload: {
        visibility: 'owner' | 'workspace' | 'team';
        folder_id: Id | null;
        workspace_folder_id: Id | null;
        team_id?: Id | null;
        owner_id?: Id | null;
    }) => {
        if (!visibilityFlow) return;
        setSavingVisibility(true);
        router.put(`/flows/${visibilityFlow.id}/visibility`, payload, {
            preserveState: false,
            onSuccess: closeVisibilityFlow,
            onFinish: () => setSavingVisibility(false),
        });
    }, [closeVisibilityFlow, visibilityFlow]);

    const actions = useMemo<FlowSidebarActions>(() => ({
        duplicateFlow: setDuplicateFlow,
        moveFlow: openMoveFlow,
        deleteFlow: handleDeleteFlow,
        visibilityFlow: openVisibilityFlow,
        canEditFlow,
    }), [canEditFlow, handleDeleteFlow, openMoveFlow, openVisibilityFlow]);

    return (
        <FlowSidebarContext.Provider value={actions}>
            {children}

            {moveFlow && (
                <MoveFlowModal
                    isOpen
                    onClose={closeMoveFlow}
                    flow={moveFlow}
                    personalTree={
                        // Keep the personal targets scoped to the flow owner's
                        // folders: moving a flow into another owner's personal
                        // folder would orphan it from every sidebar tree.
                        userTrees.find((tree) => tree.id === moveFlow.owner_id)?.tree
                            ?? folderTree
                    }
                    workspaceTree={workspaceTree}
                    teamTrees={teamTrees}
                />
            )}

            {duplicateFlow && (
                <DuplicateFlowLocationModal
                    isOpen
                    onClose={() => setDuplicateFlow(null)}
                    flow={duplicateFlow}
                    personalTree={folderTree}
                    workspaceTree={workspaceTree}
                    teamTrees={teamTrees}
                />
            )}

            {visibilityFlow && (
                <VisibilityModal
                    isOpen
                    onClose={closeVisibilityFlow}
                    onConfirm={handleVisibilityConfirm}
                    flow={visibilityFlow}
                    personalTree={folderTree}
                    workspaceTree={workspaceTree}
                    teamTrees={teamTrees}
                    loading={savingVisibility}
                />
            )}

            <ConfirmModal />
        </FlowSidebarContext.Provider>
    );
}
