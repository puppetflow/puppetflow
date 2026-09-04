import React, { useState } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import Button from '@/Shared/UI/Button/Button';
import Input from '@/Shared/UI/Input/Input';
import { DocHelpLink } from '@/Shared/UI/DocHelpLink/DocHelpLink';
import { useConfirm } from '@/Shared/Hooks/useConfirm';
import type { McpOauthClient, McpOauthConnection } from '@/Domains/Workspace/types';
import * as SharedS from '@/Domains/Workspace/Pages/WorkspaceSettings/shared.styled';
import { usePersistedAccordion } from '@/Domains/Workspace/Pages/WorkspaceSettings/Sections/InstanceMcpSection/usePersistedAccordion';
import { formatDate, requestJson } from '@/Domains/Workspace/Pages/WorkspaceSettings/Sections/InstanceMcpSection/utils';
import * as S from './styled';

interface Props {
    endpoint: string;
    authorizeUrl: string;
    tokenUrl: string;
    oauthClients: McpOauthClient[];
    oauthConnections: McpOauthConnection[];
    busy: boolean;
    clientBusy: boolean;
    readOnly?: boolean;
    setBusy: (busy: boolean) => void;
    setClientBusy: (busy: boolean) => void;
    setError: (error: string | null) => void;
}

export default function OauthCard({ endpoint, authorizeUrl, tokenUrl, oauthClients, oauthConnections, busy, clientBusy, readOnly, setBusy, setClientBusy, setError }: Props) {
    const { confirm, ConfirmModal } = useConfirm();
    const [expanded, setExpanded] = usePersistedAccordion('oauth');
    const [currentClients, setCurrentClients] = useState(oauthClients);
    const [currentConnections, setCurrentConnections] = useState(oauthConnections);
    const [activePane, setActivePane] = useState<'registered' | 'connected'>('registered');
    const [clientName, setClientName] = useState('');
    const [redirectUri, setRedirectUri] = useState('');

    const createClient = async (event: React.FormEvent) => {
        event.preventDefault();
        if (readOnly || busy || !clientName.trim() || !redirectUri.trim()) return;

        setBusy(true);
        setClientBusy(true);
        setError(null);
        try {
            const payload = await requestJson('/workspace/mcp/oauth-clients', {
                method: 'POST',
                body: JSON.stringify({
                    name: clientName.trim(),
                    redirect_uri: redirectUri.trim(),
                }),
            });
            setCurrentClients(current => [payload, ...current]);
            setClientName('');
            setRedirectUri('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to create OAuth client.');
        } finally {
            setClientBusy(false);
            setBusy(false);
        }
    };

    const revokeClient = async (client: McpOauthClient) => {
        if (readOnly || busy) return;

        const ok = await confirm({
            title: 'Revoke OAuth client',
            message: `Revoke "${client.name}"? This also revokes its active OAuth connections.`,
            confirmLabel: 'Revoke client',
            variant: 'danger',
        });
        if (!ok) return;

        setBusy(true);
        setError(null);
        try {
            await requestJson(`/workspace/mcp/oauth-clients/${client.id}`, { method: 'DELETE' });
            setCurrentClients(current => current.filter(item => item.id !== client.id));
            setCurrentConnections(current => current.filter(item => item.oauth_client_id !== client.oauth_client_id));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to revoke OAuth client.');
        } finally {
            setBusy(false);
        }
    };

    const revokeConnection = async (connection: McpOauthConnection) => {
        if (readOnly || busy) return;

        const ok = await confirm({
            title: 'Revoke OAuth connection',
            message: `Revoke access for "${connection.client_name}"?`,
            confirmLabel: 'Revoke connection',
            variant: 'danger',
        });
        if (!ok) return;

        setBusy(true);
        setError(null);
        try {
            await requestJson(`/workspace/mcp/oauth-connections/${connection.id}`, { method: 'DELETE' });
            setCurrentConnections(current => current.filter(item => item.id !== connection.id));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to revoke OAuth connection.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <SharedS.AccordionCard open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
                <SharedS.AccordionSummary>
                    <SharedS.AccordionSummaryContent>
                        <S.ModeLabel>Direct connection with automatic sign-in</S.ModeLabel>
                        <SharedS.CardTitle>
                            <Icon icon="lucide:shield-check" width={15} height={15} />
                            Direct Workspace OAuth
                            <DocHelpLink
                                path="/guide/mcp#use-the-oauth-mcp-endpoint"
                                label="Open OAuth MCP endpoint documentation"
                            />
                        </SharedS.CardTitle>
                        <S.SectionHint>
                            Use this workspace-specific endpoint for a private or custom connector. The client handles OAuth and asks the user to approve this exact workspace without copying an access token.
                        </S.SectionHint>
                    </SharedS.AccordionSummaryContent>
                    <SharedS.AccordionToggle data-accordion-toggle>
                        {expanded ? 'Close' : 'Open'}
                        <Icon data-accordion-chevron icon="lucide:chevron-down" width={15} height={15} />
                    </SharedS.AccordionToggle>
                </SharedS.AccordionSummary>
                <SharedS.AccordionBody>
                    <S.EndpointGrid>
                    <Input label="Workspace OAuth MCP endpoint" value={endpoint} readOnly />
                    <Input label="Authorize URL" value={authorizeUrl} readOnly />
                    <Input label="Token URL" value={tokenUrl} readOnly />
                    </S.EndpointGrid>

                {!readOnly && (
                    <S.Form onSubmit={createClient}>
                        <S.SubsectionTitle>Optional fixed OAuth client</S.SubsectionTitle>
                        <S.ClientForm>
                            <Input
                                label="Client name"
                                value={clientName}
                                onChange={event => setClientName(event.target.value)}
                                placeholder="Claude Desktop OAuth"
                            />
                            <Input
                                label="Redirect URI"
                                value={redirectUri}
                                onChange={event => setRedirectUri(event.target.value)}
                                placeholder="https://client.example.com/oauth/callback"
                            />
                            <Button type="submit" size="md" loading={clientBusy} disabled={busy || !clientName.trim() || !redirectUri.trim()}>
                                <Icon icon="lucide:plus" width={14} />
                                Create OAuth client
                            </Button>
                        </S.ClientForm>
                    </S.Form>
                )}

                <S.ClientsPane>
                    <S.PaneSwitcher role="tablist" aria-label="OAuth client tables">
                        <S.PaneButton
                            type="button"
                            role="tab"
                            $active={activePane === 'registered'}
                            aria-selected={activePane === 'registered'}
                            aria-controls="registered-oauth-clients"
                            onClick={() => setActivePane('registered')}
                        >
                            Registered OAuth clients
                            <S.PaneCount>({currentClients.length})</S.PaneCount>
                        </S.PaneButton>
                        <S.PaneButton
                            type="button"
                            role="tab"
                            $active={activePane === 'connected'}
                            aria-selected={activePane === 'connected'}
                            aria-controls="connected-oauth-clients"
                            onClick={() => setActivePane('connected')}
                        >
                            OAuth connected clients
                            <S.PaneCount>({currentConnections.length})</S.PaneCount>
                        </S.PaneButton>
                    </S.PaneSwitcher>

                    {activePane === 'registered' ? (
                        <S.TableViewport id="registered-oauth-clients" role="tabpanel">
                            <S.ClientTable>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Client ID</th>
                                        <th>Owner</th>
                                        <th>Redirect URI</th>
                                        <th>Created</th>
                                        {!readOnly && <th aria-label="Actions" />}
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentClients.length === 0 ? (
                                        <tr>
                                            <S.EmptyCell colSpan={readOnly ? 5 : 6}>No OAuth clients configured.</S.EmptyCell>
                                        </tr>
                                    ) : currentClients.map(client => (
                                        <tr key={client.id}>
                                            <td>{client.name}</td>
                                            <td><S.CodeValue title={client.oauth_client_id}>{client.oauth_client_id}</S.CodeValue></td>
                                            <td>{client.user?.name || '-'}</td>
                                            <td><S.TruncatedValue title={client.redirect_uri}>{client.redirect_uri}</S.TruncatedValue></td>
                                            <td>{formatDate(client.created_at)}</td>
                                            {!readOnly && (
                                                <S.ActionCell>
                                                    <Button type="button" variant="ghost" size="sm" onClick={() => void revokeClient(client)}>
                                                        <Icon icon="lucide:ban" width={13} />
                                                        Revoke
                                                    </Button>
                                                </S.ActionCell>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </S.ClientTable>
                        </S.TableViewport>
                    ) : (
                        <S.TableViewport id="connected-oauth-clients" role="tabpanel">
                            <S.ClientTable>
                                <thead>
                                    <tr>
                                        <th>Client</th>
                                        <th>Client ID</th>
                                        <th>User</th>
                                        <th>Last used</th>
                                        <th>Created</th>
                                        {!readOnly && <th aria-label="Actions" />}
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentConnections.length === 0 ? (
                                        <tr>
                                            <S.EmptyCell colSpan={readOnly ? 5 : 6}>No OAuth clients connected yet.</S.EmptyCell>
                                        </tr>
                                    ) : currentConnections.map(connection => (
                                        <tr key={connection.id}>
                                            <td>{connection.client_name}</td>
                                            <td><S.CodeValue title={connection.oauth_client_id}>{connection.oauth_client_id}</S.CodeValue></td>
                                            <td>{connection.user?.name || '-'}</td>
                                            <td>{formatDate(connection.last_used_at)}</td>
                                            <td>{formatDate(connection.created_at)}</td>
                                            {!readOnly && (
                                                <S.ActionCell>
                                                    <Button type="button" variant="ghost" size="sm" onClick={() => void revokeConnection(connection)}>
                                                        <Icon icon="lucide:ban" width={13} />
                                                        Revoke
                                                    </Button>
                                                </S.ActionCell>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </S.ClientTable>
                        </S.TableViewport>
                    )}
                    </S.ClientsPane>
                </SharedS.AccordionBody>
            </SharedS.AccordionCard>
            <ConfirmModal />
        </>
    );
}
