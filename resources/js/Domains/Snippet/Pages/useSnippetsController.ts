import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePage } from '@inertiajs/react';
import type { PageProps as InertiaPageProps } from '@inertiajs/core';
import { openLibraryStoreQuery, shouldOpenLibraryStoreFromQuery } from '@/Domains/Library/Components/LibraryStoreModal/LibraryStoreModal';
import { useConfirm } from '@/Shared/Hooks/useConfirm';
import { useToast } from '@/App/Hooks/useToast';
import { useAuth } from '@/App/Hooks/usePageProps';
import { useThemeMode } from '@/App/Hooks/useThemeMode';
import { canEditOwnership } from '@/Shared/Utils/ownershipPermissions';
import { csrfHeaders } from '@/Shared/Utils/csrf';
import { buildLibraryCompliantCode, buildLibraryCompliantNodalSnippet } from '@/Domains/Library/Utils/libraryCodeExport';
import type { PageProps, User } from '@/App/types';
import type { Snippet } from '@/Domains/Snippet/types';
import { useSnippetCrud } from './useSnippetCrud';
import { useSnippetDirtyProtection } from './useSnippetDirtyProtection';
import { useSnippetForm } from './useSnippetForm';
import { useSnippetLibraryUpdate } from './useSnippetLibraryUpdate';
import { useSnippetNavigation } from './useSnippetNavigation';
import { downloadTextFile, getDownloadBaseName } from './utils';

export interface SnippetsProps {
    snippets: Snippet[];
    teams: { id: Id; name: string }[];
    isAdmin: boolean;
    snippetGroups?: string[];
}

// Composes snippet form, navigation, persistence, and page-level modal state.
export function useSnippetsController({
    snippets: initialSnippets,
    teams,
    isAdmin,
    snippetGroups = [],
}: SnippetsProps) {
    const { settings } = usePage<InertiaPageProps & PageProps>().props;
    const { user } = useAuth();
    const { confirm, ConfirmModal } = useConfirm();
    const { toast } = useToast();
    const { resolved: resolvedTheme } = useThemeMode();
    const [snippets, setSnippets] = useState(initialSnippets);
    const [showLibraryStore, setShowLibraryStore] = useState(() => shouldOpenLibraryStoreFromQuery());
    const [showImportModal, setShowImportModal] = useState(false);
    const [showVersionTimeline, setShowVersionTimeline] = useState(
        () => new URLSearchParams(window.location.search).has('version'),
    );
    const [savingPublication, setSavingPublication] = useState(false);
    const form = useSnippetForm();
    const currentUserId = user?.id ?? '';
    const currentUserWorkspaceRole: User['workspace_role'] = user?.workspace_role ?? 'member';
    const featureEnabled = settings.snippets_enabled;
    const canEdit = featureEnabled && (!form.active || isAdmin || form.active.user_id === currentUserId);
    const dirtyProtection = useSnippetDirtyProtection({
        dirty: form.dirty,
        draftKey: form.draftKey,
        autosaveEnabled: canEdit,
        dirtyRef: form.dirtyRef,
    });
    const navigation = useSnippetNavigation({
        initialSnippets,
        confirm,
        form,
        save: dirtyProtection.flush,
    });

    useEffect(() => setSnippets(initialSnippets), [initialSnippets]);

    const settingsReadOnly = !canEdit;
    const codeReadOnly = !canEdit || Boolean(form.active?.library_locked);
    const ownershipDisabled = form.active ? !canEditOwnership({
        currentUserId,
        currentUserWorkspaceRole,
        resourceOwnerId: form.active.user_id,
        ownerWorkspaceRole: form.active.owner_workspace_role,
    }) : false;

    const crud = useSnippetCrud({
        setSnippets,
        form,
        currentUserId: user?.id ?? null,
        currentUserWorkspaceRole,
        confirm,
        toast,
        loadSnippet: navigation.doLoadSnippet,
        clearActiveSnippet: navigation.clearActiveSnippet,
        markJustSaved: dirtyProtection.markJustSaved,
    });
    dirtyProtection.saveRef.current = crud.handleSave;

    const updatePublishedVersion = useCallback((snippetId: Id, versionId: number, version: number) => {
        setSnippets(previous => previous.map(snippet => snippet.id === snippetId ? {
            ...snippet,
            published_version_id: versionId,
            published_version_number: version,
        } : snippet));
        if (form.active?.id === snippetId) {
            form.setActive({
                ...form.active,
                published_version_id: versionId,
                published_version_number: version,
            });
        }
    }, [form]);

    const publishCurrentSnippet = useCallback(async () => {
        const snippet = form.getCurrentDraft().active;
        if (!snippet || snippet.library_locked) return;

        if (form.getCurrentDraft().dirty && !await dirtyProtection.flush()) return;
        const draft = form.getCurrentDraft();
        if (draft.active?.id !== snippet.id) return;

        setSavingPublication(true);
        try {
            const response = await fetch(`/snippets/${snippet.id}/publish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...csrfHeaders(),
                },
                body: JSON.stringify({ client_updated_at: form.getDraftUpdatedAt() }),
            });
            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                toast(result.message || 'Unable to publish this snippet.', 'error');
                return;
            }
            const result = await response.json() as {
                published_version_id: number;
                published_version: number;
            };
            updatePublishedVersion(snippet.id, result.published_version_id, result.published_version);
            toast(`Snippet published as version ${result.published_version}.`);
        } catch {
            toast('Unable to publish this snippet. Check your connection and try again.', 'error');
        } finally {
            setSavingPublication(false);
        }
    }, [dirtyProtection, form, toast, updatePublishedVersion]);

    const libraryUpdate = useSnippetLibraryUpdate({ form, setSnippets, confirm, toast });
    const importGroups = useMemo(() => {
        const groups = snippets.map(snippet => snippet.group).filter(Boolean) as string[];
        return [...new Set([...snippetGroups, ...groups])].sort();
    }, [snippetGroups, snippets]);

    const openLibraryStore = useCallback(() => {
        openLibraryStoreQuery();
        setShowLibraryStore(true);
    }, []);

    const downloadSnippet = useCallback(() => {
        const baseName = getDownloadBaseName(form.label || form.active?.label || 'snippet');
        const isNodal = form.active?.snippet_type === 'nodal';
        downloadTextFile(
            `${baseName}.${isNodal ? 'json' : 'js'}`,
            isNodal ? buildLibraryCompliantNodalSnippet({
                title: form.label || form.active?.label || 'Snippet',
                description: form.description,
                args: form.args,
                graph: form.nodalGraph,
                code: form.code,
            }) : buildLibraryCompliantCode({
                title: form.label || form.active?.label || 'Snippet',
                description: form.description,
                args: form.args,
                code: form.code,
            }),
            isNodal ? 'application/json;charset=utf-8' : 'text/javascript;charset=utf-8',
        );
    }, [form.active?.label, form.active?.snippet_type, form.args, form.code, form.description, form.label, form.nodalGraph]);

    return {
        teams,
        isAdmin,
        snippetGroups,
        snippets,
        featureEnabled,
        currentUserId,
        settingsReadOnly,
        codeReadOnly,
        ownershipDisabled,
        resolvedTheme,
        saveStatus: crud.saveError ? 'error' as const : crud.saving ? 'saving' as const : form.dirty ? 'unsaved' as const : 'saved' as const,
        form,
        navigation,
        crud,
        dirtyProtection,
        libraryUpdate,
        versioning: {
            showVersionTimeline,
            setShowVersionTimeline,
            savingPublication,
            initialVersionId: Number(new URLSearchParams(window.location.search).get('version')) || null,
            publishCurrentSnippet,
            updatePublishedVersion,
            handleRestored: () => window.location.reload(),
        },
        importGroups,
        showLibraryStore,
        setShowLibraryStore,
        showImportModal,
        setShowImportModal,
        openLibraryStore,
        downloadSnippet,
        ConfirmModal,
    };
}

export type SnippetsController = ReturnType<typeof useSnippetsController>;
