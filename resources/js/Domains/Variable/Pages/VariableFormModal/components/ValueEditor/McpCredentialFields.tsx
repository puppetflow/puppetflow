import Input from '@/Shared/UI/Input/Input';
import OptionalDetails from '@/Shared/UI/OptionalDetails/OptionalDetails';
import type {
    McpAuthentication,
    VariableFormData,
} from '@/Domains/Variable/Pages/VariableFormModal/types';
import * as S from './styled';

interface McpCredentialFieldsProps {
    data: VariableFormData;
    errors: Partial<Record<keyof VariableFormData, string>>;
    onChange: (key: keyof VariableFormData, value: string) => void;
}

const AUTHENTICATION_OPTIONS: { value: McpAuthentication; label: string }[] = [
    { value: 'mcpOAuth2', label: 'MCP OAuth 2.0' },
    { value: 'bearer', label: 'Bearer token' },
    { value: 'header', label: 'Single header' },
    { value: 'multipleHeaders', label: 'Multiple headers' },
];

export default function McpCredentialFields({ data, errors, onChange }: McpCredentialFieldsProps) {
    const keepsExistingSecret = data.mcp_original_authentication === data.mcp_authentication;

    return (
        <S.McpFields>
            <Input
                label="Endpoint"
                type="url"
                value={data.mcp_endpoint}
                onChange={event => onChange('mcp_endpoint', event.target.value)}
                error={errors.mcp_endpoint}
                required
                placeholder="https://example.com/mcp"
            />
            <S.Field>
                Transport
                <select
                    value={data.mcp_transport}
                    onChange={event => onChange('mcp_transport', event.target.value)}
                >
                    <option value="httpStreamable">Streamable HTTP</option>
                    <option value="sse">SSE (deprecated)</option>
                </select>
                {errors.mcp_transport && <S.Error>{errors.mcp_transport}</S.Error>}
            </S.Field>
            <S.Field>
                Authentication
                <select
                    value={data.mcp_authentication}
                    onChange={event => onChange('mcp_authentication', event.target.value as McpAuthentication)}
                >
                    {AUTHENTICATION_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
                {errors.mcp_authentication && <S.Error>{errors.mcp_authentication}</S.Error>}
            </S.Field>

            {data.mcp_authentication === 'bearer' && (
                <Input
                    label="Bearer token"
                    type="password"
                    value={data.mcp_token}
                    onChange={event => onChange('mcp_token', event.target.value)}
                    error={errors.mcp_token}
                    required={!keepsExistingSecret}
                    placeholder={keepsExistingSecret ? 'Leave blank to keep the current token' : undefined}
                />
            )}

            {data.mcp_authentication === 'header' && (
                <>
                    <Input
                        label="Header name"
                        value={data.mcp_header_name}
                        onChange={event => onChange('mcp_header_name', event.target.value)}
                        error={errors.mcp_header_name}
                        required
                    />
                    <Input
                        label="Header value"
                        type="password"
                        value={data.mcp_header_value}
                        onChange={event => onChange('mcp_header_value', event.target.value)}
                        error={errors.mcp_header_value}
                        required={!keepsExistingSecret}
                        placeholder={keepsExistingSecret ? 'Leave blank to keep the current value' : undefined}
                    />
                </>
            )}

            {data.mcp_authentication === 'multipleHeaders' && (
                <S.Field>
                    Headers
                    <S.Hint>
                        One header per line. Existing values stay unchanged when only the header name is provided.
                    </S.Hint>
                    <textarea
                        value={data.mcp_headers}
                        onChange={event => onChange('mcp_headers', event.target.value)}
                        placeholder="Authorization: Bearer token"
                        required
                    />
                    {errors.mcp_headers && <S.Error>{errors.mcp_headers}</S.Error>}
                </S.Field>
            )}

            {data.mcp_authentication === 'mcpOAuth2' && (
                <>
                    <S.Hint>Authorize this credential from an MCP Client Tool before using it.</S.Hint>
                    <OptionalDetails title="OAuth client details (Optional)">
                        <Input
                            label="Client ID"
                            value={data.mcp_client_id}
                            onChange={event => onChange('mcp_client_id', event.target.value)}
                            error={errors.mcp_client_id}
                        />
                        <Input
                            label="Client secret"
                            type="password"
                            value={data.mcp_client_secret}
                            onChange={event => onChange('mcp_client_secret', event.target.value)}
                            error={errors.mcp_client_secret}
                            placeholder={keepsExistingSecret ? 'Leave blank to keep the current secret' : undefined}
                        />
                        <Input
                            label="Scopes"
                            value={data.mcp_scopes}
                            onChange={event => onChange('mcp_scopes', event.target.value)}
                            error={errors.mcp_scopes}
                            placeholder="openid profile"
                        />
                    </OptionalDetails>
                </>
            )}
        </S.McpFields>
    );
}
