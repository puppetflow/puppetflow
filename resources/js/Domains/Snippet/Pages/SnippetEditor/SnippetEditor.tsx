import React, { useCallback, useMemo } from 'react';
import type { EditorView } from '@codemirror/view';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { useToast } from '@/App/Hooks/useToast';
import { useGrabber } from '@/Domains/Flow/Pages/FlowEditor/Grabber/GrabberContext';
import type { CodeGizmo } from '@/Domains/Flow/Pages/FlowEditor/utils/codeGizmos';
import { CodeEditor } from '@/Shared/CodeEditor/components/CodeEditor';
import { usePuppetflowCompletions } from '@/Shared/CodeEditor/completion/usePuppetflowCompletions';
import { usePuppetflowTypeLibraries } from '@/Shared/CodeEditor/typescript/puppetflowTypeLibraries';
import { useTypeScriptSupport } from '@/Shared/CodeEditor/typescript/useTypeScriptSupport';
import { replaceEditorRange } from '@/Shared/CodeEditor/utils/editorActions';
import { useReferenceLabelDecorations } from '@/Domains/Flow/Pages/FlowEditor/utils/referenceLabelDecorations';
import { FloatingHelpButton } from '@/Shared/CodeEditor/shared/editor-layout.styled';
import { ToolbarBadge } from '@/Shared/CodeEditor/shared/toolbar.styled';
import PublicationMenu from '@/Domains/Flow/Pages/FlowEditor/components/PublicationMenu/PublicationMenu';
import type { DraftSaveStatus } from '@/Domains/Flow/Pages/FlowEditor/hooks/useFlowPersistence';
import * as Layout from '@/Domains/Snippet/Pages/shared.styled';
import { EvaluationModal } from './components/EvaluationModal/EvaluationModal';
import { HelpPanel } from './components/HelpPanel/HelpPanel';
import { SourceBanner } from './components/SourceBanner/SourceBanner';
import { useSnippetHelp } from './hooks/useSnippetHelp';
import * as S from './styled';

interface Props {
    code: string;
    id: Id;
    args: string;
    dirty: boolean;
    saving: boolean;
    saveStatus: DraftSaveStatus;
    switching: boolean;
    justSaved: boolean;
    resolvedTheme: string;
    mobileView: string;
    readOnly: boolean;
    canSave?: boolean;
    libraryLocked?: boolean;
    libraryUpdateAvailable?: boolean;
    updatingLibrarySource?: boolean;
    checkingLibraryUpdate?: boolean;
    publishedVersion?: number | null;
    savingPublication?: boolean;
    onSave: () => void;
    onPublish?: () => void;
    onViewTimeline?: () => void;
    onOpenLibraryStore?: () => void;
    onDownloadSnippet?: () => void;
    onDuplicateSnippet?: () => void;
    onUpdateLibrarySource?: () => void;
    onCheckLibraryUpdate?: () => void;
    onCodeChange: (value: string | undefined) => void;
    editorRef: React.MutableRefObject<EditorView | null>;
}

export default function SnippetEditor({
    code,
    id,
    args,
    dirty,
    saving,
    saveStatus,
    switching,
    justSaved,
    resolvedTheme,
    mobileView,
    readOnly,
    canSave = true,
    libraryLocked = false,
    libraryUpdateAvailable = false,
    updatingLibrarySource = false,
    checkingLibraryUpdate = false,
    publishedVersion = null,
    savingPublication = false,
    onSave,
    onPublish,
    onViewTimeline,
    onOpenLibraryStore,
    onDownloadSnippet,
    onDuplicateSnippet,
    onUpdateLibrarySource,
    onCheckLibraryUpdate,
    onCodeChange,
    editorRef,
}: Props) {
    const { toast } = useToast();
    const { grabSelector } = useGrabber();
    const completionOptions = useMemo(() => ({ mode: 'snippet' as const }), []);
    const completionExtensions = usePuppetflowCompletions(completionOptions);
    const typeLibraries = usePuppetflowTypeLibraries('snippet');
    const typeScriptExtensions = useTypeScriptSupport({
        code,
        extraLibs: typeLibraries,
    });
    const referenceExtensions = useReferenceLabelDecorations();
    const extensions = useMemo(
        () => [...completionExtensions, ...typeScriptExtensions, ...referenceExtensions],
        [completionExtensions, referenceExtensions, typeScriptExtensions],
    );
    const handleEditorMount = useCallback((view: EditorView) => {
        editorRef.current = view;
    }, [editorRef]);
    const help = useSnippetHelp(editorRef, readOnly);
    const { focusEntry } = help;
    const handleCodeGizmoClick = useCallback(async (
        gizmo: CodeGizmo,
        forceOnboarding = false,
    ) => {
        if (gizmo.kind === 'helper') {
            focusEntry(gizmo.name);
            return;
        }

        const editor = editorRef.current;
        if (
            readOnly
            || !editor
            || gizmo.argumentStart == null
            || gizmo.argumentEnd == null
        ) return;

        const version = editor.state.doc;
        const originalValue = editor.state.sliceDoc(gizmo.argumentStart, gizmo.argumentEnd);
        try {
            const result = await grabSelector(gizmo.targetUrl, { forceOnboarding });
            if (
                editor.state.doc !== version
                || editor.state.sliceDoc(gizmo.argumentStart, gizmo.argumentEnd) !== originalValue
            ) {
                toast('The code changed while Grabber was active. The selector was not inserted.', 'error');
                return;
            }

            replaceEditorRange(
                editor,
                gizmo.argumentStart,
                gizmo.argumentEnd,
                JSON.stringify(result.selector),
            );
        } catch {
            // GrabberContext owns cancellation and error feedback.
        }
    }, [editorRef, focusEntry, grabSelector, readOnly, toast]);

    const editorOptions = useMemo(() => ({
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        lineNumbers: 'on' as const,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'off' as const,
        padding: { top: 12 },
        readOnly,
        wordBasedSuggestions: 'off' as const,
        suggest: {
            showFiles: false,
            showWords: false,
        },
    }), [readOnly]);

    return (
        <Layout.Panel $mobileHidden={mobileView !== 'editor'}>
            <Layout.PanelHeader>
                <Layout.PanelHeaderLeft>
                    <S.CodeTitle>
                        <S.SyntaxKeyword>async</S.SyntaxKeyword>{' '}
                        <S.SyntaxKeyword>function</S.SyntaxKeyword>{' '}
                        <S.SyntaxFunction>$${id}</S.SyntaxFunction>
                        <S.SyntaxParen>(</S.SyntaxParen>
                        {args && <S.SyntaxParam>{args}</S.SyntaxParam>}
                        <S.SyntaxParen>)</S.SyntaxParen>
                        {' '}<S.SyntaxBrace>{'{'}</S.SyntaxBrace>
                    </S.CodeTitle>
                </Layout.PanelHeaderLeft>
                <Layout.PanelHeaderRight>
                    {(canSave || onViewTimeline) && (
                        <>
                            {onViewTimeline ? (
                                <PublicationMenu
                                    isPublished={publishedVersion !== null}
                                    publishedVersion={publishedVersion}
                                    saveStatus={saveStatus}
                                    draftEditable={canSave}
                                    publicationEditable={canSave && !libraryLocked}
                                    savingPublication={savingPublication}
                                    onSaveDraft={onSave}
                                    onPublish={onPublish}
                                    onViewTimeline={onViewTimeline}
                                />
                            ) : (
                                <>
                                    <S.SavedIndicator $saved={!dirty} $visible={dirty || justSaved}>
                                        {dirty ? 'Unsaved changes' : 'Saved'}
                                    </S.SavedIndicator>
                                    <S.SaveBadge
                                        type="button"
                                        onClick={onSave}
                                        $disabled={!dirty || saving}
                                        title="Save (Ctrl+S)"
                                    >
                                        <S.SaveIconWrapper>
                                            <Icon icon="lucide:save" />
                                            {dirty && <S.UnsavedDot />}
                                        </S.SaveIconWrapper>
                                        Save
                                    </S.SaveBadge>
                                </>
                            )}
                            <S.ToolbarSeparator />
                        </>
                    )}
                    {onOpenLibraryStore && (
                        <ToolbarBadge
                            onClick={onOpenLibraryStore}
                            data-tooltip="Open Blueprints"
                            aria-label="Open Blueprints"
                        >
                            <Icon icon="lucide:store" />
                        </ToolbarBadge>
                    )}
                    {onDownloadSnippet && (
                        <ToolbarBadge
                            onClick={onDownloadSnippet}
                            data-tooltip="Download JS file"
                            aria-label="Download JS file"
                        >
                            <Icon icon="lucide:download" />
                        </ToolbarBadge>
                    )}
                    {onDuplicateSnippet && (
                        <ToolbarBadge
                            onClick={onDuplicateSnippet}
                            data-tooltip="Duplicate this snippet"
                            data-tooltip-align="right"
                            aria-label="Duplicate this snippet"
                        >
                            <Icon icon="lucide:copy-plus" />
                        </ToolbarBadge>
                    )}
                </Layout.PanelHeaderRight>
            </Layout.PanelHeader>
            {libraryLocked && (
                <SourceBanner
                    updateAvailable={libraryUpdateAvailable}
                    updating={updatingLibrarySource}
                    checking={checkingLibraryUpdate}
                    onUpdate={onUpdateLibrarySource}
                    onCheck={onCheckLibraryUpdate}
                />
            )}
            {switching ? (
                <Layout.PanelLoader><Layout.PanelSpinner /></Layout.PanelLoader>
            ) : (
                <S.EditorWithHelp>
                    <S.EditorColumn>
                        <S.EditorWrap $readOnly={readOnly}>
                            <CodeEditor
                                gizmos
                                onGizmoClick={handleCodeGizmoClick}
                                language="javascript"
                                theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                                value={code}
                                onChange={onCodeChange}
                                onMount={handleEditorMount}
                                extensions={extensions}
                                options={editorOptions}
                            />
                            <FloatingHelpButton
                                type="button"
                                data-code-help-trigger
                                onClick={help.openHelp}
                                title="Open function help"
                            >
                                <Icon icon="lucide:life-buoy" />
                            </FloatingHelpButton>
                        </S.EditorWrap>
                        <S.CodeFooter>
                            <S.CodeTitle>
                                <S.SyntaxBrace>{'}'}</S.SyntaxBrace>
                            </S.CodeTitle>
                        </S.CodeFooter>
                    </S.EditorColumn>
                    {help.showHelp && (
                        <HelpPanel
                            search={help.search}
                            activeCategoryKey={help.activeCategoryKey}
                            activeIndex={help.activeIndex}
                            entries={help.entries}
                            entryRefs={help.entryRefs}
                            onSearchChange={help.setSearch}
                            onSearchKeyDown={help.handleSearchKeyDown}
                            onCategoryChange={help.setActiveCategoryKey}
                            onActiveIndexChange={help.setActiveIndex}
                            onInsert={help.insert}
                            onEvaluate={help.evaluate}
                            onClose={help.closeHelp}
                        />
                    )}
                </S.EditorWithHelp>
            )}
            {help.evaluation && (
                <EvaluationModal
                    evaluation={help.evaluation}
                    onClose={help.closeEvaluation}
                />
            )}
        </Layout.Panel>
    );
}
