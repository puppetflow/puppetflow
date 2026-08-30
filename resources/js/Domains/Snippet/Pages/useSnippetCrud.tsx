import React, { type Dispatch, type SetStateAction, useRef, useState } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import type { useConfirm } from '@/Shared/Hooks/useConfirm';
import BulkDeleteConfirmation from '@/Shared/UI/BulkDeleteConfirmation/BulkDeleteConfirmation';
import type { useToast } from '@/App/Hooks/useToast';
import { invalidateSnippetCache } from '@/Domains/Flow/Pages/FlowEditor/utils/snippetSuggestions';
import { ADMIN_TRANSFER_WARNING } from '@/Shared/Utils/ownershipPermissions';
import type { IntegrationScope } from '@/Domains/Integration/types';
import type { Snippet, SnippetType } from '@/Domains/Snippet/types';
import type { NodalGraph } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import { compileNodalGraphToSnippetCode, normalizeNodalFunctionGraph } from '@/Domains/Flow/Pages/FlowEditor/nodalCompiler';
import type { User } from '@/App/types';
import SnippetDeleteConfirmation, { type SnippetUsage } from './SnippetDeleteConfirmation';
import type { SnippetFormController } from './useSnippetForm';
import { fetchJson } from './utils';

type Confirm = ReturnType<typeof useConfirm>['confirm'];
type Toast = ReturnType<typeof useToast>['toast'];

interface ImportPayload {
    label: string;
    description: string | null;
    group: string | null;
    args: string;
    code: string;
    snippet_type?: SnippetType;
    nodal_graph?: NodalGraph | null;
    scope: IntegrationScope;
    team_id: Id | null;
    is_active: boolean;
}

interface Options {
    setSnippets: Dispatch<SetStateAction<Snippet[]>>;
    form: SnippetFormController;
    currentUserId: Id | null;
    currentUserWorkspaceRole: User['workspace_role'];
    confirm: Confirm;
    toast: Toast;
    loadSnippet: (snippet: Snippet) => void;
    clearActiveSnippet: () => void;
    markJustSaved: () => void;
}

// Implements snippet creation, persistence, renaming, and deletion for the editor.
export function useSnippetCrud({
    setSnippets,
    form,
    currentUserId,
    currentUserWorkspaceRole,
    confirm,
    toast,
    loadSnippet,
    clearActiveSnippet,
    markJustSaved,
}: Options) {
    const [saving, setSaving] = useState(false);
    const [failedDraftKey, setFailedDraftKey] = useState<string | null>(null);
    const [deletingSelected, setDeletingSelected] = useState(false);
    const formRef = useRef(form);
    formRef.current = form;
    const saveRequestRef = useRef<{
        snippetId: Id;
        draftKey: string;
        promise: Promise<boolean>;
    } | null>(null);

    const handleCreate = async (snippetType: SnippetType = 'code') => {
        const nodalGraph = snippetType === 'nodal' ? normalizeNodalFunctionGraph(null) : null;
        const response = await fetchJson('/snippets', {
            method: 'POST',
            body: JSON.stringify({
                label: 'New Snippet',
                code: nodalGraph ? compileNodalGraphToSnippetCode(nodalGraph, '') : '',
                snippet_type: snippetType,
                nodal_graph: nodalGraph,
                scope: 'owner',
            }),
        });
        if (!response.ok) {
            const error = await response.json();
            toast(error.message || 'Error creating snippet', 'error');
            return;
        }

        const created: Snippet = await response.json();
        setSnippets(previous => [...previous, created]);
        loadSnippet(created);
        invalidateSnippetCache();
    };

    const handleImportSnippet = async (payload: ImportPayload) => {
        const response = await fetchJson('/snippets', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Error importing snippet');
        }

        const created: Snippet = await response.json();
        setSnippets(previous => [...previous, created]);
        loadSnippet(created);
        invalidateSnippetCache();
        toast('Snippet imported');
        return created;
    };

    const handleSave = async () => {
        let currentForm = formRef.current;
        const requestedDraft = currentForm.getCurrentDraft();
        let active = requestedDraft.active;
        if (!active) return false;
        const requestedSnippetId = active.id;
        let savedDraftKey = requestedDraft.draftKey;
        const pending = saveRequestRef.current;
        if (pending) {
            if (pending.snippetId === active.id && pending.draftKey === savedDraftKey) {
                return pending.promise;
            }
            if (!await pending.promise) return false;
            currentForm = formRef.current;
            const currentDraft = currentForm.getCurrentDraft();
            active = currentDraft.active;
            if (active?.id !== requestedSnippetId) return false;
            savedDraftKey = currentDraft.draftKey;
        }

        if (currentForm.ownerId && currentForm.ownerId !== active.user_id && currentForm.ownerId !== currentUserId) {
            if (currentUserWorkspaceRole === 'manager' && currentForm.targetUserRole === 'admin') {
                const confirmed = await confirm({
                    title: 'Transfer ownership',
                    message: ADMIN_TRANSFER_WARNING,
                    confirmLabel: 'Transfer anyway',
                    variant: 'danger',
                });
                if (!confirmed) return false;
            }
        }

        const payload: Record<string, unknown> = {
            label: currentForm.label,
            description: currentForm.description || null,
            group: currentForm.group.trim() || null,
            is_active: currentForm.isActive,
            scope: currentForm.scope,
            team_id: currentForm.scope === 'team' ? currentForm.teamId : null,
        };
        const contentUpdatedAt = currentForm.getDraftUpdatedAt();
        if (contentUpdatedAt) payload.client_updated_at = contentUpdatedAt;
        if (!active.library_locked) {
            payload.args = currentForm.args;
            payload.code = currentForm.code;
            if (active.snippet_type === 'nodal') payload.nodal_graph = currentForm.nodalGraph;
        }
        if (currentForm.ownerId && currentForm.ownerId !== active.user_id) payload.user_id = currentForm.ownerId;

        setSaving(true);
        setFailedDraftKey(null);
        const request = (async () => {
            try {
                const response = await fetchJson(`/snippets/${active.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                });
                if (!response.ok) {
                    const error = await response.json() as {
                        message?: string;
                        errors?: Record<string, string[]>;
                    };
                    const validationMessage = error.errors
                        ? Object.values(error.errors).flat()[0]
                        : null;
                    toast(validationMessage || error.message || 'Error saving snippet', 'error');
                    setFailedDraftKey(savedDraftKey);
                    return false;
                }

                const updated: Snippet = await response.json();
                const merged = { ...active, ...updated };
                setSnippets(previous => previous.map(snippet => snippet.id === updated.id ? merged : snippet));
                formRef.current.applySavedState(merged, savedDraftKey);
                markJustSaved();
                invalidateSnippetCache();
                return true;
            } catch {
                toast('Snippet could not be saved. Check your connection and try again.', 'error');
                setFailedDraftKey(savedDraftKey);
                return false;
            }
        })();
        saveRequestRef.current = {
            snippetId: active.id,
            draftKey: savedDraftKey,
            promise: request,
        };

        try {
            return await request;
        } finally {
            if (saveRequestRef.current?.promise === request) saveRequestRef.current = null;
            setSaving(false);
        }
    };

    const handleDuplicate = async (snippet: Snippet) => {
        const response = await fetchJson('/snippets', {
            method: 'POST',
            body: JSON.stringify({
                label: `${snippet.label} (copy)`,
                description: snippet.description || '',
                group: snippet.group || null,
                args: snippet.args || '',
                code: snippet.code || '',
                snippet_type: snippet.snippet_type || 'code',
                nodal_graph: snippet.snippet_type === 'nodal' ? snippet.nodal_graph : null,
                is_active: snippet.is_active,
                scope: snippet.scope || 'owner',
                team_id: snippet.scope === 'team' ? snippet.team_id : null,
            }),
        });
        if (!response.ok) {
            const error = await response.json();
            toast(error.message || 'Error duplicating snippet', 'error');
            return;
        }

        const created: Snippet = await response.json();
        setSnippets(previous => [...previous, created]);
        loadSnippet(created);
        invalidateSnippetCache();
        toast('Snippet duplicated');
    };

    const handleDelete = async (snippet: Snippet) => {
        let usages: SnippetUsage[] = [];
        try {
            const response = await fetch(`/snippets/${snippet.id}/usages`);
            if (response.ok) usages = await response.json();
        } catch {
            // Continue with the standard confirmation when usages cannot be loaded.
        }

        if (usages.length > 0) {
            await confirm({
                title: 'Snippet in use',
                message: React.createElement(SnippetDeleteConfirmation, {
                    label: snippet.label,
                    id: snippet.id,
                    usages,
                }),
                confirmLabel: 'Close',
                confirmVariant: 'secondary',
                hideCancel: true,
                variant: 'primary',
            });
            return;
        }

        const confirmed = await confirm({
            title: 'Delete Snippet',
            message: `Delete "${snippet.label}" ($$${snippet.id})? This cannot be undone.`,
            confirmLabel: 'Delete',
            variant: 'danger',
        });
        if (!confirmed) return;

        const response = await fetchJson(`/snippets/${snippet.id}`, { method: 'DELETE' });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            toast(error.message || 'Error deleting snippet', 'error');
            return;
        }
        setSnippets(previous => previous.filter(item => item.id !== snippet.id));
        if (form.active?.id === snippet.id) clearActiveSnippet();
        toast('Snippet deleted');
        invalidateSnippetCache();
    };

    const handleBulkDelete = async (selectedSnippets: Snippet[]) => {
        if (selectedSnippets.length === 0) return false;

        const confirmed = await confirm({
            title: selectedSnippets.length === 1 ? 'Delete Snippet' : 'Delete Snippets',
            message: React.createElement(BulkDeleteConfirmation, {
                description: 'References to these snippets in flows will stop resolving after deletion.',
                items: selectedSnippets.map(snippet => ({
                    id: snippet.id,
                    title: snippet.label,
                    subtitle: `$$${snippet.id}`,
                    icon: React.createElement(Icon, {
                        icon: snippet.snippet_type === 'nodal' ? 'lucide:workflow' : 'lucide:code-2',
                        width: 22,
                        height: 22,
                    }),
                })),
            }),
            confirmLabel: `Delete (${selectedSnippets.length})`,
            variant: 'danger',
        });
        if (!confirmed) return false;

        setDeletingSelected(true);
        try {
            const response = await fetchJson('/snippets/bulk-delete', {
                method: 'DELETE',
                body: JSON.stringify({ ids: selectedSnippets.map(snippet => snippet.id) }),
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                toast(error.message || 'Error deleting snippets', 'error');
                return false;
            }

            const deletedIds = new Set(selectedSnippets.map(snippet => snippet.id));
            setSnippets(previous => previous.filter(snippet => !deletedIds.has(snippet.id)));
            if (form.active && deletedIds.has(form.active.id)) clearActiveSnippet();
            toast(selectedSnippets.length === 1 ? 'Snippet deleted' : `${selectedSnippets.length} snippets deleted`);
            invalidateSnippetCache();
            return true;
        } finally {
            setDeletingSelected(false);
        }
    };

    return {
        saving,
        saveError: failedDraftKey === form.draftKey,
        deletingSelected,
        handleCreate,
        handleImportSnippet,
        handleSave,
        handleDuplicate,
        handleDelete,
        handleBulkDelete,
    };
}
