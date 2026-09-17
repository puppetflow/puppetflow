import React, { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import AppLayout from '@/App/Layout/AppLayout/AppLayout';
import TreeSidebar from './TreeSidebar/TreeSidebar';
import ExplorerContent from './ExplorerContent/ExplorerContent';
import CreateFolderModal from './ExplorerModals/CreateFolderModal/CreateFolderModal';
import DeleteFolderModal from './ExplorerModals/DeleteFolderModal/DeleteFolderModal';
import { ExplorerContext, type ExplorerContextValue } from './ExplorerContext';
import type {
    DeletableFolder,
    ExplorerConfig,
    ExplorerItem,
    ExplorerPageData,
    ExplorerToolbarFilter,
} from './types';
import * as S from './styled';

interface Props<TItem extends ExplorerItem> {
    config: ExplorerConfig<TItem>;
    data: ExplorerPageData<TItem>;
    /** Buttons rendered in the page header. They may call useExplorer(). */
    headerActions?: React.ReactNode;
    /** Domain specific modals or overlays rendered inside the explorer context. */
    children?: React.ReactNode;
    /** Wraps the main content column (for example with a file drop zone). */
    renderContent?: (content: React.ReactNode) => React.ReactNode;
    toolbarFilters?: ExplorerToolbarFilter[];
}

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 520;
const SIDEBAR_DEFAULT_WIDTH = 260;

// Shared explorer shell: resizable tree sidebar, content column and folder modals.
export default function Explorer<TItem extends ExplorerItem>({
    config,
    data,
    headerActions,
    children,
    renderContent,
    toolbarFilters,
}: Props<TItem>) {
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState<DeletableFolder | null>(null);
    const storageKey = `${config.key}-explorer-sidebar-width`;
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const stored = Number(localStorage.getItem(storageKey));
        return Number.isFinite(stored) && stored >= SIDEBAR_MIN_WIDTH
            ? Math.min(SIDEBAR_MAX_WIDTH, stored)
            : SIDEBAR_DEFAULT_WIDTH;
    });
    const explorerLayoutRef = useRef<HTMLDivElement>(null);
    const sidebarResizingRef = useRef(false);

    const handleSidebarResizeStart = useCallback((event: React.MouseEvent) => {
        event.preventDefault();
        sidebarResizingRef.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const handleMove = (moveEvent: MouseEvent) => {
            if (!sidebarResizingRef.current || !explorerLayoutRef.current) return;

            const rect = explorerLayoutRef.current.getBoundingClientRect();
            const maxWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, rect.width - 420));
            const nextWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(maxWidth, moveEvent.clientX - rect.left));
            setSidebarWidth(nextWidth);
        };

        const handleUp = () => {
            sidebarResizingRef.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
            setSidebarWidth(width => {
                localStorage.setItem(storageKey, String(Math.round(width)));
                return width;
            });
        };

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
    }, [storageKey]);

    const contextValue = useMemo<ExplorerContextValue<TItem>>(() => ({
        config,
        data,
        actions: {
            openCreateFolder: () => setShowNewFolder(true),
            deleteFolder: setFolderToDelete,
        },
    }), [config, data]);

    const SidebarProvider = config.SidebarProvider ?? Fragment;
    const content = <ExplorerContent toolbarFilters={toolbarFilters} />;

    return (
        <ExplorerContext.Provider value={contextValue as unknown as ExplorerContextValue}>
            <AppLayout
                title={config.title}
                documentationPath={config.documentationPath}
                documentationLabel={config.documentationLabel}
                noPadding
                headerRight={headerActions}
            >
                <S.ExplorerLayout ref={explorerLayoutRef}>
                    <SidebarProvider>
                        <TreeSidebar width={sidebarWidth} />
                    </SidebarProvider>
                    <S.SidebarResizeHandle
                        onMouseDown={handleSidebarResizeStart}
                        title="Resize side panel"
                    />
                    {renderContent ? renderContent(content) : content}
                </S.ExplorerLayout>

                <CreateFolderModal isOpen={showNewFolder} onClose={() => setShowNewFolder(false)} />
                <DeleteFolderModal folder={folderToDelete} onClose={() => setFolderToDelete(null)} />

                {children}
            </AppLayout>
        </ExplorerContext.Provider>
    );
}
