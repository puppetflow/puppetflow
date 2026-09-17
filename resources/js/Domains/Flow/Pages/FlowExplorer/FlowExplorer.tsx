import { useCallback, useState } from 'react';
import { router } from '@inertiajs/react';
import Button from '@/Shared/UI/Button/Button';
import { Icon } from '@/Shared/UI/Icon/Icon';
import Explorer from '@/Shared/Explorer/Explorer';
import NewFolderButton from '@/Shared/Explorer/NewFolderButton';
import { useExplorer } from '@/Shared/Explorer/ExplorerContext';
import { getLocationUrl } from '@/Shared/Explorer/ExplorerContent/utils';
import type { ExplorerPageData } from '@/Shared/Explorer/types';
import * as ExplorerS from '@/Shared/Explorer/styled';
import LibraryStoreModal, { openLibraryStoreQuery, shouldOpenLibraryStoreFromQuery } from '@/Domains/Library/Components/LibraryStoreModal/LibraryStoreModal';
import FlowImportModal from '@/Domains/Flow/Pages/FlowImportModal/FlowImportModal';
import type { Flow } from '@/Domains/Flow/types';
import { flowExplorerConfig } from './flowExplorerConfig';

type Props = ExplorerPageData<Flow>;

interface HeaderProps {
    onOpenLibraryStore: () => void;
    onOpenImport: () => void;
}

function FlowExplorerHeader({ onOpenLibraryStore, onOpenImport }: HeaderProps) {
    const { data: { currentFolder, filters } } = useExplorer<Flow>();
    const newFlowUrl = getLocationUrl('/flows/create', currentFolder?.id ?? null, {
        view: filters.view === 'workspace' ? 'workspace' : null,
        owner_id: filters.owner_id,
    });

    return (
        <ExplorerS.HeaderActions>
            <NewFolderButton />
            <Button variant="secondary" size="sm" onClick={onOpenLibraryStore}>
                <Icon icon="lucide:store" width={14} />
                <ExplorerS.BtnLabel>Blueprints</ExplorerS.BtnLabel>
            </Button>
            <Button variant="secondary" size="sm" onClick={onOpenImport}>
                <Icon icon="lucide:upload" width={14} />
                <ExplorerS.BtnLabel>Import</ExplorerS.BtnLabel>
            </Button>
            <Button size="sm" onClick={() => router.visit(newFlowUrl)}>
                <Icon icon="lucide:plus" width={14} />
                <ExplorerS.BtnLabel>New Flow</ExplorerS.BtnLabel>
            </Button>
        </ExplorerS.HeaderActions>
    );
}

export default function FlowExplorer(props: Props) {
    const { currentFolder, folderTree, workspaceTree, teamTrees, filters } = props;
    const [showLibraryStore, setShowLibraryStore] = useState(() => shouldOpenLibraryStoreFromQuery());
    const [showImportModal, setShowImportModal] = useState(false);

    const handleLibraryStoreOpen = useCallback(() => {
        openLibraryStoreQuery();
        setShowLibraryStore(true);
    }, []);

    const isWorkspaceView = filters.view === 'workspace';
    const isTeamFolder = Boolean(currentFolder?.team_id);
    const defaultImportVisibility = isTeamFolder ? 'team' : isWorkspaceView ? 'workspace' : 'owner';

    return (
        <Explorer
            config={flowExplorerConfig}
            data={props}
            headerActions={(
                <FlowExplorerHeader
                    onOpenLibraryStore={handleLibraryStoreOpen}
                    onOpenImport={() => setShowImportModal(true)}
                />
            )}
        >
            <LibraryStoreModal
                isOpen={showLibraryStore}
                onClose={() => setShowLibraryStore(false)}
                teams={teamTrees.map(team => ({ id: team.id, name: team.name }))}
            />
            <FlowImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                personalTree={folderTree}
                workspaceTree={workspaceTree}
                teamTrees={teamTrees}
                defaultVisibility={defaultImportVisibility}
                defaultFolderId={currentFolder?.id ?? null}
                defaultTeamId={currentFolder?.team_id ?? null}
            />
        </Explorer>
    );
}
