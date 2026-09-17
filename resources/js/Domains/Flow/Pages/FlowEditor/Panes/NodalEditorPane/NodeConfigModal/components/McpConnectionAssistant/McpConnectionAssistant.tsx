import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import Input from '@/Shared/UI/Input/Input';
import Button from '@/Shared/UI/Button/Button';
import Modal from '@/Shared/UI/Modal/Modal';
import OptionalDetails from '@/Shared/UI/OptionalDetails/OptionalDetails';
import { csrfHeaders } from '@/Shared/Utils/csrf';
import { laravelErrorMessage } from '@/Shared/Utils/laravelValidation';
import type {
    CanvasNode,
    NodeParameterValue,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import {
    discoverMcpTools,
    mcpConnectionConfigFromNode,
} from './mcpConnection';
import * as S from './styled';

interface BaseProps {
    node: CanvasNode;
    readOnly?: boolean;
    onUpdateValue: (nodeId: string, key: string, value: NodeParameterValue) => void;
}

interface Props extends BaseProps {
    onCredentialsChanged: () => Promise<unknown>;
    setupRequest?: number;
    canEditCredential: boolean;
}

type Authentication = 'bearer' | 'header' | 'multipleHeaders' | 'mcpOAuth2';

type EditableCredential = {
    id: string;
    name: string;
    authentication: Authentication;
    scope: string;
    team_id?: string | null;
    config: {
        endpoint: string;
        transport?: 'httpStreamable' | 'sse';
        token?: string;
        name?: string;
        value?: string;
        headers?: { name: string; value: string }[];
        client_id?: string;
        client_secret?: string;
        scopes?: string;
    };
};

const AUTHENTICATION_OPTIONS: { value: Authentication; label: string }[] = [
    { value: 'mcpOAuth2', label: 'MCP OAuth 2.0' },
    { value: 'bearer', label: 'Bearer token' },
    { value: 'header', label: 'Single header' },
    { value: 'multipleHeaders', label: 'Multiple headers' },
];

function parseHeaders(raw: string): { name: string; value: string }[] {
    return raw.split('\n').map(line => {
        const separator = line.indexOf(':');
        return separator < 0
            ? { name: line.trim(), value: '' }
            : { name: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() };
    }).filter(header => header.name !== '');
}

export default function McpConnectionAssistant({
    node,
    readOnly,
    onUpdateValue,
    onCredentialsChanged,
    setupRequest = 0,
    canEditCredential,
}: Props) {
    const config = mcpConnectionConfigFromNode(node);
    const [testing, setTesting] = useState(false);
    const [feedback, setFeedback] = useState<{ message: string; error?: boolean } | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadingCredential, setLoadingCredential] = useState(false);
    const [editingCredentialId, setEditingCredentialId] = useState<string | null>(null);
    const [editingVariableId, setEditingVariableId] = useState<string | null>(null);
    const [originalAuthentication, setOriginalAuthentication] = useState<Authentication | null>(null);
    const [formError, setFormError] = useState('');
    const [name, setName] = useState('MCP Server');
    const [variableKey, setVariableKey] = useState('MCP Server Credential');
    const [endpoint, setEndpoint] = useState('');
    const [transport, setTransport] = useState<'httpStreamable' | 'sse'>('httpStreamable');
    const [authentication, setAuthentication] = useState<Authentication>('mcpOAuth2');
    const [selectedAuthentication, setSelectedAuthentication] = useState<Authentication | null>(null);
    const [credentialScope, setCredentialScope] = useState('user');
    const [credentialTeamId, setCredentialTeamId] = useState<string | null>(null);
    const [token, setToken] = useState('');
    const [headerName, setHeaderName] = useState('Authorization');
    const [headerValue, setHeaderValue] = useState('');
    const [headers, setHeaders] = useState('');
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [scopes, setScopes] = useState('');
    const [originalClientId, setOriginalClientId] = useState('');
    const [originalScopes, setOriginalScopes] = useState('');
    const [originalEndpoint, setOriginalEndpoint] = useState('');
    const handledSetupRequest = useRef(setupRequest);
    const setupLoadRequest = useRef(0);
    const connectionTestRequest = useRef(0);
    const connectionIdentity = `${config.credentialVariableId}\0${config.timeout}`;
    const connectionIdentityRef = useRef(connectionIdentity);
    connectionIdentityRef.current = connectionIdentity;

    useEffect(() => {
        setupLoadRequest.current++;
        setLoadingCredential(false);
    }, [config.credentialVariableId]);

    useEffect(() => {
        connectionTestRequest.current++;
        setTesting(false);
    }, [connectionIdentity]);

    const update = (key: string, value: string) => {
        onUpdateValue(node.id, key, { mode: 'fixed', value });
    };

    const resetSecretFields = useCallback(() => {
        setToken('');
        setHeaderName('Authorization');
        setHeaderValue('');
        setHeaders('');
        setClientId('');
        setClientSecret('');
        setScopes('');
        setOriginalClientId('');
        setOriginalScopes('');
        setOriginalEndpoint('');
    }, []);

    const openSetup = useCallback(async (forceCreate = false) => {
        const requestId = ++setupLoadRequest.current;
        const credentialVariableId = config.credentialVariableId;
        resetSecretFields();
        setName('MCP Server');
        setVariableKey('MCP Server Credential');
        setEndpoint('');
        setTransport('httpStreamable');
        setAuthentication('mcpOAuth2');
        setCredentialScope('user');
        setCredentialTeamId(null);
        setEditingCredentialId(null);
        setEditingVariableId(null);
        setOriginalAuthentication(null);
        setFormError('');
        if (forceCreate || !credentialVariableId) {
            setModalOpen(true);
            return;
        }

        setLoadingCredential(true);
        setFeedback(null);
        try {
            const query = new URLSearchParams({ credential_variable_id: credentialVariableId });
            const response = await fetch(`/mcp-credentials/from-variable?${query.toString()}`);
            const payload = await response.json().catch(() => ({})) as {
                credential?: EditableCredential;
                message?: string;
                errors?: Record<string, string[]>;
            };
            if (!response.ok || !payload.credential) {
                throw new Error(laravelErrorMessage(payload) ?? 'Unable to load the Stored Credential.');
            }
            if (requestId !== setupLoadRequest.current) return;
            const credential = payload.credential;
            setEditingCredentialId(credential.id);
            setEditingVariableId(credentialVariableId);
            setOriginalAuthentication(credential.authentication);
            setSelectedAuthentication(credential.authentication);
            setName(credential.name);
            setEndpoint(credential.config.endpoint || '');
            setTransport(credential.config.transport ?? 'httpStreamable');
            setOriginalEndpoint(credential.config.endpoint || '');
            setAuthentication(credential.authentication);
            setCredentialScope(credential.scope);
            setCredentialTeamId(credential.team_id ?? null);
            setHeaderName(credential.config.name || 'Authorization');
            setHeaders((credential.config.headers ?? []).map(header => `${header.name}:`).join('\n'));
            setClientId(credential.config.client_id ?? '');
            setScopes(credential.config.scopes ?? '');
            setOriginalClientId(credential.config.client_id ?? '');
            setOriginalScopes(credential.config.scopes ?? '');
            setModalOpen(true);
        } catch (error) {
            setFeedback({
                message: error instanceof Error ? error.message : 'Unable to load the Stored Credential.',
                error: true,
            });
        } finally {
            if (requestId === setupLoadRequest.current) setLoadingCredential(false);
        }
    }, [config.credentialVariableId, resetSecretFields]);

    useEffect(() => {
        if (setupRequest === handledSetupRequest.current) return;
        handledSetupRequest.current = setupRequest;
        void openSetup(true);
    }, [openSetup, setupRequest]);

    useEffect(() => {
        setSelectedAuthentication(null);
        if (!config.credentialVariableId || !canEditCredential) return;

        const controller = new AbortController();
        const query = new URLSearchParams({ credential_variable_id: config.credentialVariableId });
        void fetch(`/mcp-credentials/from-variable?${query.toString()}`, { signal: controller.signal })
            .then(async response => {
                if (!response.ok) return;
                const payload = await response.json() as { credential?: EditableCredential };
                if (payload.credential) setSelectedAuthentication(payload.credential.authentication);
            })
            .catch(() => undefined);

        return () => controller.abort();
    }, [canEditCredential, config.credentialVariableId]);

    const testConnection = async () => {
        if (!config.credentialVariableId) {
            setFeedback({ message: 'Select Credentials first.', error: true });
            return;
        }
        const requestId = ++connectionTestRequest.current;
        const testedIdentity = connectionIdentity;
        setTesting(true);
        setFeedback(null);
        try {
            const tools = await discoverMcpTools(config);
            if (
                requestId !== connectionTestRequest.current
                || testedIdentity !== connectionIdentityRef.current
            ) return;
            setFeedback({
                message: `Connected. ${tools.length} tool${tools.length === 1 ? '' : 's'} found.`,
            });
        } catch (error) {
            if (
                requestId !== connectionTestRequest.current
                || testedIdentity !== connectionIdentityRef.current
            ) return;
            setFeedback({
                message: error instanceof Error ? error.message : 'Unable to connect to the MCP server.',
                error: true,
            });
        }
        setTesting(false);
    };

    const authorize = async (
        credentialVariableId: string,
        credentialId?: string,
        openedPopup?: Window | null,
    ) => {
        const popup = openedPopup ?? window.open('about:blank', '_blank');
        if (popup) popup.opener = null;
        try {
            const route = credentialId
                ? `/mcp-credentials/${encodeURIComponent(credentialId)}/oauth`
                : '/mcp-oauth/authorize';
            const response = await fetch(route, {
                method: 'POST',
                headers: { ...csrfHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dynamic_registration: true,
                    ...(!credentialId ? { credential_variable_id: credentialVariableId } : {}),
                }),
            });
            const payload = await response.json().catch(() => ({})) as {
                authorization_url?: string;
                message?: string;
                errors?: Record<string, string[]>;
            };
            if (!response.ok || !payload.authorization_url) {
                throw new Error(laravelErrorMessage(payload) ?? 'Unable to start MCP OAuth.');
            }
            if (popup) popup.location.href = payload.authorization_url;
            else window.open(payload.authorization_url, '_blank', 'noopener,noreferrer');
            setFeedback({ message: 'OAuth authorization opened in a new tab.' });
        } catch (error) {
            popup?.close();
            throw error;
        }
    };

    const saveCredential = async (event: FormEvent) => {
        event.preventDefault();
        if (!endpoint.trim()) {
            setFormError('Enter an MCP endpoint before saving Credentials.');
            return;
        }
        const shouldAuthorize = authentication === 'mcpOAuth2'
            && (
                !editingCredentialId
                || originalAuthentication !== 'mcpOAuth2'
                || endpoint.trim() !== originalEndpoint.trim()
                || clientId.trim() !== originalClientId.trim()
                || scopes.trim() !== originalScopes.trim()
                || clientSecret !== ''
            );
        const oauthPopup = shouldAuthorize
            ? window.open('about:blank', '_blank')
            : null;
        if (oauthPopup) oauthPopup.opener = null;
        setSaving(true);
        setFormError('');
        const authenticationConfig = authentication === 'bearer'
            ? { token }
            : authentication === 'header'
                ? { name: headerName, value: headerValue }
                : authentication === 'multipleHeaders'
                    ? { headers: parseHeaders(headers) }
                    : {
                        client_id: clientId || null,
                        client_secret: clientSecret,
                        scopes,
                    };
        const credentialConfig = {
            endpoint: endpoint.trim(),
            transport,
            ...authenticationConfig,
        };
        try {
            const response = await fetch(
                editingCredentialId
                    ? `/mcp-credentials/from-variable/${encodeURIComponent(editingVariableId ?? '')}`
                    : '/mcp-credentials',
                {
                method: editingCredentialId ? 'PUT' : 'POST',
                headers: { ...csrfHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    ...(!editingCredentialId ? { variable_key: variableKey } : {}),
                    authentication,
                    config: credentialConfig,
                    scope: credentialScope,
                    team_id: credentialTeamId,
                    is_active: true,
                }),
            });
            const payload = await response.json().catch(() => ({})) as {
                credential?: { id: string };
                variable?: { id: string };
                message?: string;
                errors?: Record<string, string[]>;
            };
            if (!response.ok || !payload.credential || (!editingCredentialId && !payload.variable)) {
                throw new Error(laravelErrorMessage(payload) ?? 'Unable to save Credentials.');
            }
            const credentialVariableId = payload.variable?.id ?? editingVariableId ?? config.credentialVariableId;
            if (payload.variable) update('credentialId', payload.variable.id);
            setSelectedAuthentication(authentication);
            await onCredentialsChanged();
            setModalOpen(false);
            setFeedback({ message: editingCredentialId ? 'Credentials updated.' : 'Credentials created and selected.' });
            if (shouldAuthorize) {
                try {
                    await authorize(
                        credentialVariableId,
                        editingCredentialId ? undefined : payload.credential.id,
                        oauthPopup,
                    );
                } catch (error) {
                    setFeedback({
                        message: error instanceof Error ? error.message : 'Unable to start MCP OAuth.',
                        error: true,
                    });
                }
            }
        } catch (error) {
            oauthPopup?.close();
            setFormError(error instanceof Error ? error.message : 'Unable to save Credentials.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <S.Root>
                <S.CredentialsActions>
                    <S.ActionButton type="button" disabled={readOnly || testing} onClick={() => void testConnection()}>
                        <Icon icon={testing ? 'lucide:loader-circle' : 'lucide:plug-zap'} width={11} height={11} />
                        {testing ? 'Testing...' : 'Test'}
                    </S.ActionButton>
                    {(!config.credentialVariableId || canEditCredential) && (
                        <S.ActionButton
                            type="button"
                            disabled={readOnly || loadingCredential}
                            onClick={() => void openSetup()}
                        >
                            <Icon icon={loadingCredential ? 'lucide:loader-circle' : 'lucide:key-round'} width={11} height={11} />
                            {loadingCredential ? 'Loading...' : config.credentialVariableId ? 'Edit auth' : 'Set up auth'}
                        </S.ActionButton>
                    )}
                    {selectedAuthentication === 'mcpOAuth2' && config.credentialVariableId && (
                        <S.ActionButton
                            type="button"
                            disabled={readOnly}
                            onClick={() => void authorize(config.credentialVariableId).catch(error => {
                                setFeedback({
                                    message: error instanceof Error ? error.message : 'Unable to start MCP OAuth.',
                                    error: true,
                                });
                            })}
                        >
                            <Icon icon="lucide:external-link" width={11} height={11} />
                            Authorize
                        </S.ActionButton>
                    )}
                </S.CredentialsActions>
                {feedback && <S.Feedback $error={feedback.error}>{feedback.message}</S.Feedback>}
            </S.Root>
            <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingCredentialId ? 'Edit MCP Credentials' : 'Set up MCP Credentials'}
                caption={editingCredentialId
                    ? 'Update the Credentials selected by this MCP Client Tool.'
                    : 'Create Credentials and their variable without leaving the flow.'}
                width="500px"
                zIndex={1050}
                modalKind="mcp-credential-quick-create"
            >
                <S.Form onSubmit={saveCredential}>
                    <Input label="Credentials name" value={name} onChange={event => setName(event.target.value)} required />
                    {!editingCredentialId && (
                        <Input label="Variable label" value={variableKey} onChange={event => setVariableKey(event.target.value)} required />
                    )}
                    <Input
                        label="Endpoint"
                        type="url"
                        value={endpoint}
                        onChange={event => setEndpoint(event.target.value)}
                        placeholder="https://example.com/mcp"
                        required
                    />
                    <S.Field>
                        Transport
                        <select
                            value={transport}
                            onChange={event => setTransport(event.target.value === 'sse' ? 'sse' : 'httpStreamable')}
                        >
                            <option value="httpStreamable">Streamable HTTP</option>
                            <option value="sse">SSE (deprecated)</option>
                        </select>
                    </S.Field>
                    <S.Field>
                        Authentication
                        <select value={authentication} onChange={event => setAuthentication(event.target.value as Authentication)}>
                            {AUTHENTICATION_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </S.Field>
                    {authentication === 'bearer' && (
                        <Input
                            label="Bearer token"
                            type="password"
                            value={token}
                            onChange={event => setToken(event.target.value)}
                            required={!editingCredentialId || originalAuthentication !== 'bearer'}
                            placeholder={editingCredentialId && originalAuthentication === 'bearer' ? 'Leave blank to keep the current token' : undefined}
                        />
                    )}
                    {authentication === 'header' && (
                        <>
                            <Input label="Header name" value={headerName} onChange={event => setHeaderName(event.target.value)} required />
                            <Input
                                label="Header value"
                                type="password"
                                value={headerValue}
                                onChange={event => setHeaderValue(event.target.value)}
                                required={!editingCredentialId || originalAuthentication !== 'header'}
                                placeholder={editingCredentialId && originalAuthentication === 'header' ? 'Leave blank to keep the current value' : undefined}
                            />
                        </>
                    )}
                    {authentication === 'multipleHeaders' && (
                        <S.Field>
                            Headers
                            <S.Hint>One header per line, for example: Authorization: Bearer token</S.Hint>
                            <textarea value={headers} onChange={event => setHeaders(event.target.value)} required />
                        </S.Field>
                    )}
                    {authentication === 'mcpOAuth2' && (
                        <OptionalDetails title="OAuth client details (Optional)">
                            <Input label="Client ID" value={clientId} onChange={event => setClientId(event.target.value)} />
                            <Input label="Client secret" type="password" value={clientSecret} onChange={event => setClientSecret(event.target.value)} />
                            <Input label="Scopes" value={scopes} onChange={event => setScopes(event.target.value)} placeholder="openid profile" />
                        </OptionalDetails>
                    )}
                    {formError && <S.Error>{formError}</S.Error>}
                    <S.ModalActions>
                        <Button type="button" variant="secondary" disabled={saving} onClick={() => setModalOpen(false)}>Cancel</Button>
                        <Button type="submit" loading={saving}>
                            {editingCredentialId ? 'Save changes' : 'Create and connect'}
                        </Button>
                    </S.ModalActions>
                </S.Form>
            </Modal>
        </>
    );
}
