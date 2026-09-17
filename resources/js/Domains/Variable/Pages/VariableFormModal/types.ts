import type React from 'react';

export type VariableType = 'text' | 'secret' | 'mcp_credentials' | 'object' | 'array' | 'json' | 'vault' | 'otp';
export type McpAuthentication = 'bearer' | 'header' | 'multipleHeaders' | 'mcpOAuth2';

export type VariableFormData = {
    key: string;
    value: string;
    type: VariableType;
    scope: string;
    group: string;
    vault_provider: string;
    vault_integration_id: Id;
    vault_vault_id: string;
    vault_vault_name: string;
    vault_item_id: string;
    vault_item_name: string;
    vault_field_label: string;
    vault_field_type: string;
    mcp_endpoint: string;
    mcp_transport: 'httpStreamable' | 'sse';
    mcp_authentication: McpAuthentication;
    mcp_original_authentication: McpAuthentication | '';
    mcp_token: string;
    mcp_header_name: string;
    mcp_header_value: string;
    mcp_headers: string;
    mcp_client_id: string;
    mcp_client_secret: string;
    mcp_scopes: string;
};

export type VaultFormPatch = Partial<{
    integrationId: Id;
    vaultId: string;
    vaultName: string;
    itemId: string;
    itemName: string;
    fieldLabel: string;
    fieldType: string;
}>;

export type ConfirmVariableAction = (options: {
    title?: string;
    message: React.ReactNode;
    confirmLabel?: string;
    variant?: 'danger' | 'primary';
}) => Promise<boolean>;
