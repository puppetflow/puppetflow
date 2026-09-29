import React from 'react';
import { useForm } from '@inertiajs/react';
import AuthLayout from '@/App/Layout/AuthLayout/AuthLayout';
import Button from '@/Shared/UI/Button/Button';
import { Form } from '@/Domains/Auth/Components/Auth/shared.styled';
import * as S from './styled';

interface Workspace {
    id: string;
    name: string;
    slug: string | null;
}

interface Props {
    workspaces: Workspace[];
    /** Hidden fields forwarded as-is to the submit URL (broker OAuth params or the Passport auth token). */
    parameters: Record<string, string>;
    clientName: string;
    userEmail: string;
    submitUrl: string;
}

export default function McpBrokerAuthorize({ workspaces, parameters, clientName, userEmail, submitUrl }: Props) {
    const form = useForm({
        ...parameters,
        workspace_id: workspaces[0]?.id ?? '',
    });
    const error = form.errors.workspace_id ?? Object.values(form.errors)[0];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(submitUrl);
    };

    return (
        <AuthLayout
            title="Authorize MCP access"
            subtitle={`Choose the workspace that ${clientName} may access on your behalf.`}
            footer={(
                <S.Identity>
                    Signed in as <strong>{userEmail}</strong>
                </S.Identity>
            )}
        >
            <Form onSubmit={handleSubmit}>
                {workspaces.length === 0 ? (
                    <S.Notice>
                        No eligible MCP workspace is available. Ask a workspace administrator to enable MCP access.
                    </S.Notice>
                ) : (
                    <S.WorkspaceList role="radiogroup" aria-label="Workspace">
                        {workspaces.map(workspace => (
                            <S.WorkspaceOption
                                key={workspace.id}
                                type="button"
                                role="radio"
                                aria-checked={form.data.workspace_id === workspace.id}
                                $active={form.data.workspace_id === workspace.id}
                                onClick={() => {
                                    form.clearErrors();
                                    form.setData('workspace_id', workspace.id);
                                }}
                            >
                                <S.SelectionMark aria-hidden="true" />
                                <S.WorkspaceText>
                                    <strong>{workspace.name}</strong>
                                    <span>{workspace.slug ?? workspace.id}</span>
                                </S.WorkspaceText>
                            </S.WorkspaceOption>
                        ))}
                    </S.WorkspaceList>
                )}
                {error && <S.ErrorText role="alert">{error}</S.ErrorText>}
                <S.Notice>
                    {clientName} will receive a revocable MCP access token tied to your account and the selected workspace.
                    You can revoke it at any time from the workspace MCP settings.
                </S.Notice>
                <Button type="submit" fullWidth disabled={form.processing || workspaces.length === 0}>
                    {form.processing ? 'Authorizing...' : 'Authorize'}
                </Button>
            </Form>
        </AuthLayout>
    );
}
