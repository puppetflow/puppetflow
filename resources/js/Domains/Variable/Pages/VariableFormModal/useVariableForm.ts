import { useEffect, useRef, useState, type FormEvent } from 'react';
import { router, useForm, usePage } from '@inertiajs/react';
import type { PageProps as InertiaPageProps } from '@inertiajs/core';
import type { Integration } from '@/Domains/Integration/types';
import type { PageProps } from '@/App/types';
import type { UserVariable } from '@/Domains/Variable/types';
import { ADMIN_TRANSFER_WARNING, canEditOwnership } from '@/Shared/Utils/ownershipPermissions';
import { csrfHeaders } from '@/Shared/Utils/csrf';
import type { VariableSuggestion } from '@/Domains/Flow/Pages/FlowEditor/utils/variableSuggestions';
import type { ConfirmVariableAction, VariableFormData, VariableType, VaultFormPatch } from './types';

const EMPTY_FORM: VariableFormData = {
    key: '',
    value: '',
    type: 'text',
    scope: 'user',
    group: '',
    vault_provider: '',
    vault_integration_id: '',
    vault_vault_id: '',
    vault_vault_name: '',
    vault_item_id: '',
    vault_item_name: '',
    vault_field_label: '',
    vault_field_type: '',
    mcp_endpoint: '',
    mcp_transport: 'httpStreamable',
    mcp_authentication: 'mcpOAuth2',
    mcp_original_authentication: '',
    mcp_token: '',
    mcp_header_name: 'Authorization',
    mcp_header_value: '',
    mcp_headers: '',
    mcp_client_id: '',
    mcp_client_secret: '',
    mcp_scopes: '',
};

function dataForVariable(variable: UserVariable): VariableFormData {
    let type: VariableType = variable.type;
    if (type === 'json') {
        try {
            type = Array.isArray(JSON.parse(variable.value)) ? 'array' : 'object';
        } catch {
            type = 'object';
        }
    }

    return {
        key: variable.key,
        value: variable.value,
        type,
        scope: variable.scope,
        group: variable.group || '',
        vault_provider: variable.vault_provider || '',
        vault_integration_id: variable.vault_integration?.id || '',
        vault_vault_id: variable.vault_vault_id || '',
        vault_vault_name: variable.vault_vault_name || '',
        vault_item_id: variable.vault_item_id || '',
        vault_item_name: variable.vault_item_name || '',
        vault_field_label: variable.vault_field_label || '',
        vault_field_type: variable.vault_field_type || '',
        mcp_endpoint: '',
        mcp_transport: 'httpStreamable',
        mcp_authentication: 'mcpOAuth2',
        mcp_original_authentication: '',
        mcp_token: '',
        mcp_header_name: 'Authorization',
        mcp_header_value: '',
        mcp_headers: '',
        mcp_client_id: '',
        mcp_client_secret: '',
        mcp_scopes: '',
    };
}

interface UseVariableFormOptions {
    editing: UserVariable | null;
    isOpen: boolean;
    onClose: () => void;
    confirm: ConfirmVariableAction;
    onCreated?: (variable: VariableSuggestion) => void;
}

// Hydrates and submits variable fields for both create and edit modes.
export function useVariableForm({ editing, isOpen, onClose, confirm, onCreated }: UseVariableFormOptions) {
    const pageProps = usePage<InertiaPageProps & PageProps & { vaultIntegrations: Integration[] }>().props;
    const { vaultIntegrations = [] } = pageProps;
    const currentUserId = pageProps.auth.user?.id ?? '';
    const currentUserWorkspaceRole = pageProps.auth.user?.workspace_role ?? 'member';
    const [ownerId, setOwnerId] = useState<Id | null>(null);
    const [targetUserRole, setTargetUserRole] = useState<string>();
    const [teamId, setTeamId] = useState<Id | null>(null);
    const [jsonSubmitting, setJsonSubmitting] = useState(false);
    const [mcpLoading, setMcpLoading] = useState(false);
    const [mcpLoadFailed, setMcpLoadFailed] = useState(false);
    const form = useForm<VariableFormData>(EMPTY_FORM);
    const formRef = useRef(form);
    formRef.current = form;

    useEffect(() => {
        if (!isOpen) return;
        const currentForm = formRef.current;

        if (editing) {
            setOwnerId(editing.user_id);
            setTargetUserRole(editing.owner_workspace_role);
            setTeamId(editing.team_id ?? null);
            currentForm.setData(dataForVariable(editing));
        } else {
            setOwnerId(null);
            setTargetUserRole(undefined);
            setTeamId(null);
            currentForm.setData(EMPTY_FORM);
        }
        currentForm.clearErrors();
        setJsonSubmitting(false);
        setMcpLoading(false);
        setMcpLoadFailed(false);

        if (editing?.type !== 'mcp_credentials') return;
        setMcpLoading(true);
        const controller = new AbortController();
        const query = new URLSearchParams({ credential_variable_id: String(editing.id) });
        void fetch(`/mcp-credentials/from-variable?${query.toString()}`, { signal: controller.signal })
            .then(async response => {
                const payload = await response.json().catch(() => ({})) as {
                    credential?: {
                        authentication: VariableFormData['mcp_authentication'];
                        config: {
                            endpoint?: string;
                            transport?: VariableFormData['mcp_transport'];
                            name?: string;
                            headers?: { name: string }[];
                            client_id?: string;
                            scopes?: string;
                        };
                    };
                    message?: string;
                };
                if (!response.ok || !payload.credential) {
                    throw new Error(payload.message || 'Unable to load MCP Credentials.');
                }
                const credential = payload.credential;
                currentForm.setData(previous => ({
                    ...previous,
                    mcp_endpoint: credential.config.endpoint ?? '',
                    mcp_transport: credential.config.transport ?? 'httpStreamable',
                    mcp_authentication: credential.authentication,
                    mcp_original_authentication: credential.authentication,
                    mcp_header_name: credential.config.name || 'Authorization',
                    mcp_headers: (credential.config.headers ?? []).map(header => `${header.name}:`).join('\n'),
                    mcp_client_id: credential.config.client_id ?? '',
                    mcp_scopes: credential.config.scopes ?? '',
                }));
            })
            .catch(error => {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                setMcpLoadFailed(true);
                currentForm.setError('mcp_authentication', error instanceof Error
                    ? error.message
                    : 'Unable to load MCP Credentials.');
            })
            .finally(() => {
                if (!controller.signal.aborted) setMcpLoading(false);
            });

        return () => controller.abort();
    }, [editing, isOpen]);

    const ownershipDisabled = editing ? !canEditOwnership({
        currentUserId,
        currentUserWorkspaceRole,
        resourceOwnerId: editing.user_id,
        ownerWorkspaceRole: editing.owner_workspace_role,
    }) : false;

    const handleTypeChange = (rawValue: string) => {
        if (rawValue.startsWith('vault:')) {
            const provider = rawValue.split(':')[1];
            form.setData(previous => ({
                ...previous,
                type: 'vault',
                vault_provider: provider,
                vault_integration_id: '',
                vault_vault_id: '',
                vault_vault_name: '',
                vault_item_id: '',
                vault_item_name: '',
                vault_field_label: '',
                vault_field_type: '',
                value: '',
            }));
            return;
        }

        form.setData(previous => ({
            ...previous,
            type: rawValue as Exclude<VariableType, 'vault'>,
            ...(
                rawValue === 'object' && previous.type !== 'object'
                    ? { value: '{}' }
                    : rawValue === 'array' && previous.type !== 'array'
                        ? { value: '[]' }
                        : {}
            ),
            vault_provider: '',
            vault_integration_id: '',
            vault_vault_id: '',
            vault_vault_name: '',
            vault_item_id: '',
            vault_item_name: '',
            vault_field_label: '',
            vault_field_type: '',
        }));
    };

    const handleVaultChange = (patch: VaultFormPatch) => {
        form.setData(previous => ({
            ...previous,
            ...(patch.integrationId !== undefined && { vault_integration_id: patch.integrationId }),
            ...(patch.vaultId !== undefined && { vault_vault_id: patch.vaultId }),
            ...(patch.vaultName !== undefined && { vault_vault_name: patch.vaultName }),
            ...(patch.itemId !== undefined && { vault_item_id: patch.itemId }),
            ...(patch.itemName !== undefined && { vault_item_name: patch.itemName }),
            ...(patch.fieldLabel !== undefined && { vault_field_label: patch.fieldLabel }),
            ...(patch.fieldType !== undefined && { vault_field_type: patch.fieldType }),
        }));
    };

    const requestData = () => ({
        ...form.data,
        team_id: form.data.scope === 'team' ? teamId : null,
        ...(ownerId ? { user_id: ownerId } : {}),
    });

    const mcpRequestData = () => {
        const headers = form.data.mcp_headers
            .split('\n')
            .map(line => {
                const separator = line.indexOf(':');
                return separator < 0
                    ? { name: line.trim(), value: '' }
                    : { name: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() };
            })
            .filter(header => header.name !== '');
        const authenticationConfig = form.data.mcp_authentication === 'bearer'
            ? { token: form.data.mcp_token }
            : form.data.mcp_authentication === 'header'
                ? { name: form.data.mcp_header_name, value: form.data.mcp_header_value }
                : form.data.mcp_authentication === 'multipleHeaders'
                    ? { headers }
                    : {
                        client_id: form.data.mcp_client_id || null,
                        client_secret: form.data.mcp_client_secret,
                        scopes: form.data.mcp_scopes,
                    };
        const config = {
            endpoint: form.data.mcp_endpoint.trim(),
            transport: form.data.mcp_transport,
            ...authenticationConfig,
        };

        return {
            name: form.data.key,
            variable_key: form.data.key,
            variable_group: form.data.group || null,
            authentication: form.data.mcp_authentication,
            config,
            scope: form.data.scope,
            team_id: form.data.scope === 'team' ? teamId : null,
            ...(ownerId ? { user_id: ownerId } : {}),
            is_active: true,
        };
    };

    const mcpErrorField = (key: string): keyof VariableFormData => {
        if (key === 'variable_key' || key === 'name') return 'key';
        if (key === 'variable_group') return 'group';
        if (key === 'scope' || key === 'team_id' || key === 'user_id') return 'scope';
        if (key === 'authentication') return 'mcp_authentication';
        if (key === 'config.endpoint') return 'mcp_endpoint';
        if (key === 'config.transport') return 'mcp_transport';
        if (key === 'config.token') return 'mcp_token';
        if (key === 'config.name') return 'mcp_header_name';
        if (key === 'config.value') return 'mcp_header_value';
        if (key.startsWith('config.headers')) return 'mcp_headers';
        if (key === 'config.client_id') return 'mcp_client_id';
        if (key === 'config.client_secret') return 'mcp_client_secret';
        if (key === 'config.scopes') return 'mcp_scopes';
        return key as keyof VariableFormData;
    };

    const handleErrors = (errors: Record<string, string>) => {
        Object.entries(errors).forEach(([key, value]) => form.setError(key as keyof VariableFormData, value));
    };

    const submitCreateJson = async () => {
        setJsonSubmitting(true);
        form.clearErrors();

        try {
            const response = await fetch('/variables', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    ...csrfHeaders(),
                },
                body: JSON.stringify(requestData()),
            });
            const payload = await response.json().catch(() => ({})) as {
                variable?: VariableSuggestion;
                message?: string;
                errors?: Record<string, string | string[]>;
            };

            if (!response.ok || !payload.variable) {
                Object.entries(payload.errors ?? {}).forEach(([key, error]) => {
                    const message = Array.isArray(error) ? error[0] : error;
                    if (message) form.setError(key as keyof VariableFormData, message);
                });
                if (!payload.errors && payload.message) form.setError('key', payload.message);
                return;
            }

            onCreated?.(payload.variable);
        } catch {
            form.setError('key', 'Unable to create the variable.');
        } finally {
            setJsonSubmitting(false);
        }
    };

    const submitMcp = async () => {
        setJsonSubmitting(true);
        form.clearErrors();

        try {
            const response = await fetch(
                editing
                    ? `/mcp-credentials/from-variable/${encodeURIComponent(String(editing.id))}`
                    : '/mcp-credentials',
                {
                    method: editing ? 'PUT' : 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        ...csrfHeaders(),
                    },
                    body: JSON.stringify(mcpRequestData()),
                },
            );
            const payload = await response.json().catch(() => ({})) as {
                variable?: VariableSuggestion;
                message?: string;
                errors?: Record<string, string | string[]>;
            };
            if (!response.ok || !payload.variable) {
                Object.entries(payload.errors ?? {}).forEach(([key, error]) => {
                    const message = Array.isArray(error) ? error[0] : error;
                    if (message) form.setError(mcpErrorField(key), message);
                });
                if (!payload.errors && payload.message) form.setError('key', payload.message);
                return;
            }

            if (onCreated) {
                onCreated(payload.variable);
            } else {
                router.reload({ onFinish: onClose });
            }
        } catch {
            form.setError('key', 'Unable to save MCP Credentials.');
        } finally {
            setJsonSubmitting(false);
        }
    };

    const submitUpdate = () => {
        if (!editing) return;
        router.put(`/variables/${editing.id}`, requestData(), {
            preserveState: true,
            onSuccess: onClose,
            onError: handleErrors,
        });
    };

    const confirmOwnershipTransfer = async () => {
        const originalOwnerId = editing?.user_id ?? null;
        const ownerChanged = ownerId && ownerId !== originalOwnerId && ownerId !== pageProps.auth.user?.id;

        if (currentUserWorkspaceRole === 'manager' && targetUserRole === 'admin' && ownerChanged) {
            return confirm({
                title: 'Transfer ownership',
                message: ADMIN_TRANSFER_WARNING,
                confirmLabel: 'Transfer anyway',
                variant: 'danger',
            });
        }

        if (ownerChanged && form.data.scope === 'user') {
            return confirm({
                title: 'Transfer ownership',
                message: 'This variable has personal visibility. By transferring it to another user, you will permanently lose access to it.',
                confirmLabel: 'Transfer anyway',
                variant: 'danger',
            });
        }

        return true;
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (form.data.type === 'mcp_credentials' && (mcpLoading || mcpLoadFailed)) return;

        if (form.data.type === 'object' || form.data.type === 'array') {
            try {
                const parsed = JSON.parse(form.data.value);
                const valid = form.data.type === 'array'
                    ? Array.isArray(parsed)
                    : parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
                if (!valid) throw new Error('Invalid structured value');
            } catch {
                form.setError('value', `Value must be a valid ${form.data.type}.`);
                return;
            }
        }

        if (!await confirmOwnershipTransfer()) return;

        if (form.data.type === 'mcp_credentials') {
            await submitMcp();
            return;
        }

        if (editing) {
            submitUpdate();
            return;
        }

        if (onCreated) {
            await submitCreateJson();
            return;
        }

        router.post('/variables', requestData(), {
            preserveState: true,
            onSuccess: onClose,
            onError: handleErrors,
        });
    };

    return {
        form,
        handleSubmit,
        handleTypeChange,
        handleVaultChange,
        ownerId: ownerId,
        setOwnerId: setOwnerId,
        setTargetUserRole,
        teamId,
        setTeamId,
        ownershipDisabled,
        submitting: form.processing || jsonSubmitting || mcpLoading || mcpLoadFailed,
        mcpEnabled: pageProps.settings.mcp_enabled,
        vaultIntegrations,
    };
}
