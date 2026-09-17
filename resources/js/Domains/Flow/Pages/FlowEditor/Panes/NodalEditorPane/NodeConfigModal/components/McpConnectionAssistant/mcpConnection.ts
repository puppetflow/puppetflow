import { csrfHeaders } from '@/Shared/Utils/csrf';
import { laravelErrorMessage } from '@/Shared/Utils/laravelValidation';
import type { CanvasNode } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import {
    normalizeParameterValue,
    normalizeScalarParameterValue,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/expression';

export interface McpToolOption {
    name: string;
    description: string;
}

export interface McpConnectionConfig {
    credentialVariableId: string;
    timeout: number;
}

export function mcpConnectionConfigFromNode(node: CanvasNode): McpConnectionConfig {
    const credential = normalizeScalarParameterValue(node.values.credentialId);
    const options = normalizeParameterValue(node.values.options);
    let timeout = 60000;
    if (options.mode === 'object' && options.inputMode === 'form') {
        const field = options.fields.find(candidate => candidate.key === 'timeout');
        const parsed = Number(normalizeScalarParameterValue(field?.value).value);
        if (Number.isFinite(parsed) && parsed > 0) timeout = parsed;
    } else if (options.mode === 'object') {
        try {
            const parsed = Number((JSON.parse(options.value) as { timeout?: unknown }).timeout);
            if (Number.isFinite(parsed) && parsed > 0) timeout = parsed;
        } catch {
            // Keep the default timeout while the options JSON is incomplete.
        }
    }

    return {
        credentialVariableId: credential.mode === 'fixed'
            ? credential.value.trim()
            : '',
        timeout,
    };
}

export async function discoverMcpTools(
    config: McpConnectionConfig,
    signal?: AbortSignal,
): Promise<McpToolOption[]> {
    const response = await fetch('/mcp-tools/discover', {
        method: 'POST',
        headers: { ...csrfHeaders(), 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
            credential_variable_id: config.credentialVariableId,
            timeout: config.timeout,
        }),
    });
    const payload = await response.json().catch(() => ({})) as {
        tools?: McpToolOption[];
        message?: string;
        errors?: Record<string, string[]>;
    };
    if (!response.ok) {
        throw new Error(laravelErrorMessage(payload) ?? 'Unable to connect to the MCP server.');
    }

    return Array.isArray(payload.tools) ? payload.tools : [];
}
