import { useEffect, useMemo, useState } from 'react';
import Button from '@/Shared/UI/Button/Button';
import { Icon } from '@/Shared/UI/Icon/Icon';
import Switch from '@/Shared/UI/Switch/Switch';
import type {
    CanvasNode,
    ScalarNodeParameterValue,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import {
    discoverMcpTools,
    mcpConnectionConfigFromNode,
    type McpToolOption,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodeConfigModal/components/McpConnectionAssistant/mcpConnection';
import * as S from './styled';

interface Props {
    node: CanvasNode;
    value: ScalarNodeParameterValue;
    readOnly?: boolean;
    onChange: (value: ScalarNodeParameterValue) => void;
}

function selectedNames(value: ScalarNodeParameterValue): string[] {
    if (value.mode !== 'fixed') return [];
    try {
        const parsed = JSON.parse(value.value);
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
        return [];
    }
}

export default function McpToolsSelect({ node, value, readOnly, onChange }: Props) {
    const {
        credentialVariableId,
        timeout,
    } = mcpConnectionConfigFromNode(node);
    const [tools, setTools] = useState<McpToolOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [discovered, setDiscovered] = useState(false);
    const [refreshRequest, setRefreshRequest] = useState(0);
    const selected = useMemo(() => new Set(selectedNames(value)), [value]);

    useEffect(() => {
        if (!credentialVariableId) {
            setTools([]);
            setError('');
            setLoading(false);
            setDiscovered(false);
            return;
        }
        setTools([]);
        setDiscovered(false);
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setLoading(true);
            setError('');
            discoverMcpTools({
                    credentialVariableId,
                    timeout,
                }, controller.signal)
                .then(result => {
                    setTools(result);
                    setDiscovered(true);
                })
                .catch(fetchError => {
                    if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
                    setTools([]);
                    setError(fetchError instanceof Error ? fetchError.message : 'Unable to discover MCP tools.');
                })
                .finally(() => {
                    if (!controller.signal.aborted) setLoading(false);
                });
        }, 300);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [credentialVariableId, refreshRequest, timeout]);

    const toggle = (name: string) => {
        const next = new Set(selected);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        onChange({ mode: 'fixed', value: JSON.stringify([...next]) });
    };

    const selectAll = () => {
        onChange({ mode: 'fixed', value: JSON.stringify(tools.map(tool => tool.name)) });
    };

    const deselectAll = () => {
        onChange({ mode: 'fixed', value: '[]' });
    };

    const allSelected = tools.every(tool => selected.has(tool.name));
    const noneSelected = tools.every(tool => !selected.has(tool.name));

    return (
        <S.Root>
            {loading && <S.Status>Discovering tools...</S.Status>}
            {!loading && error && <S.ErrorMessage>{error}</S.ErrorMessage>}
            {!loading && !error && tools.length === 0 && (
                <S.Status>{discovered ? 'This server exposes no tools.' : 'Select Credentials to discover tools.'}</S.Status>
            )}
            {credentialVariableId && (
                <S.SelectionActions>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={readOnly || loading}
                        onClick={() => {
                            setLoading(true);
                            setRefreshRequest(current => current + 1);
                        }}
                    >
                        <Icon icon="lucide:refresh-cw" width={13} height={13} />
                        Refresh
                    </Button>
                    {tools.length > 0 && (
                        <>
                            <Button type="button" variant="secondary" size="sm" disabled={readOnly || allSelected} onClick={selectAll}>
                                Select all
                            </Button>
                            <Button type="button" variant="secondary" size="sm" disabled={readOnly || noneSelected} onClick={deselectAll}>
                                Deselect all
                            </Button>
                        </>
                    )}
                </S.SelectionActions>
            )}
            {tools.length > 0 && (
                <S.ToolList>
                    {tools.map(tool => (
                        <S.ToolOption key={tool.name}>
                            <S.ToolName
                                type="button"
                                disabled={readOnly}
                                onClick={() => toggle(tool.name)}
                            >
                                {tool.name}
                            </S.ToolName>
                            <Switch
                                id={`mcp-tool-${tool.name}`}
                                checked={selected.has(tool.name)}
                                disabled={readOnly}
                                ariaLabel={`${selected.has(tool.name) ? 'Deselect' : 'Select'} ${tool.name}`}
                                onChange={() => toggle(tool.name)}
                            />
                        </S.ToolOption>
                    ))}
                </S.ToolList>
            )}
        </S.Root>
    );
}
