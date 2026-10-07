import { startTransition, useEffect, useState } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import type { NodalEditorPaneProps } from './NodalEditorPane.types';
import { useNodalEditorPaneController } from './hooks/useNodalEditorPaneController';
import Toolbar from './components/Toolbar/Toolbar';
import NodalEditorCanvas from './components/NodalEditorCanvas';
import * as S from './styled';

function MountedNodalEditorCanvas(props: NodalEditorPaneProps) {
    const controller = useNodalEditorPaneController(props);

    return <NodalEditorCanvas controller={controller} />;
}

function NodalEditorPane(props: NodalEditorPaneProps) {
    const {
        flow,
        saved,
        onRun,
        onOpenLibraryStore,
        onDownloadFlow,
        onDuplicateFlow,
        leftView = 'code',
        onSwitchView,
        sidePanelOpen,
        onToggleSidePanel,
        onSave,
        saveStatus = 'saved',
        publishedVersion = null,
        hasUnpublishedChanges = false,
        onPublish,
        onUnpublish,
        onViewTimeline,
        savingPublication = false,
        publicationEditable = false,
        saveButtonStyle = 'toolbar',
        readOnly = false,
        hideToolbar = false,
        documentExtension = 'flow',
    } = props;
    const [canvasReady, setCanvasReady] = useState(false);

    useEffect(() => {
        let mountFrame = 0;
        const paintFrame = window.requestAnimationFrame(() => {
            mountFrame = window.requestAnimationFrame(() => {
                startTransition(() => setCanvasReady(true));
            });
        });

        return () => {
            window.cancelAnimationFrame(paintFrame);
            window.cancelAnimationFrame(mountFrame);
        };
    }, [flow.id, props.graphRevision]);

    return (
        <S.Wrapper>
            <S.Column>
                {!hideToolbar && (
                    <Toolbar
                        flow={flow}
                        saved={saved}
                        readOnly={readOnly}
                        documentExtension={documentExtension}
                        leftView={leftView}
                        sidePanelOpen={sidePanelOpen}
                        onSave={onSave}
                        isPublished={flow.is_published}
                        saveStatus={saveStatus}
                        publishedVersion={publishedVersion}
                        hasUnpublishedChanges={hasUnpublishedChanges}
                        onPublish={onPublish}
                        onUnpublish={onUnpublish}
                        onViewTimeline={onViewTimeline}
                        savingPublication={savingPublication}
                        publicationEditable={publicationEditable}
                        saveButtonStyle={saveButtonStyle}
                        onRun={onRun}
                        onOpenLibraryStore={onOpenLibraryStore}
                        onDownloadFlow={onDownloadFlow}
                        onDuplicateFlow={onDuplicateFlow}
                        onSwitchView={onSwitchView}
                        onToggleSidePanel={onToggleSidePanel}
                    />
                )}
                {canvasReady ? (
                    <MountedNodalEditorCanvas {...props} />
                ) : (
                    <S.CanvasLoader aria-label="Loading flow canvas" role="status">
                        <Icon icon="lucide:loader-2" width={20} height={20} />
                    </S.CanvasLoader>
                )}
            </S.Column>
        </S.Wrapper>
    );
}

export default NodalEditorPane;
