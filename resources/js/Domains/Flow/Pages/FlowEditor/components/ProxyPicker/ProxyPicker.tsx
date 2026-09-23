import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import CustomSelect from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodeConfigModal/components/CustomSelect/CustomSelect';
import type { FlowEditorProps } from '@/Domains/Flow/Pages/FlowEditor/types';
import WorkspaceProxyFormModal from '@/Domains/Workspace/Pages/WorkspaceSettings/Sections/ProxiesSection/WorkspaceProxyFormModal';
import { countryFlag } from '@/Domains/Workspace/Pages/WorkspaceSettings/Sections/ProxiesSection/countries';
import type { WorkspaceProxy } from '@/Domains/Workspace/types';
import type { ProxyChoice } from './proxyChoice';

interface ProxyPickerProps {
    value: ProxyChoice;
    workspaceProxies: FlowEditorProps['workspaceProxies'];
    teams: FlowEditorProps['teams'];
    canManageWorkspaceProxies: boolean;
    ariaLabel?: string;
    invalid?: boolean;
    modalZIndex?: number;
    onChange: (value: ProxyChoice) => void;
}

// Select for none / auto / a specific workspace proxy, with inline proxy creation and refresh.
export default function ProxyPicker({
    value,
    workspaceProxies,
    teams,
    canManageWorkspaceProxies,
    ariaLabel = 'Proxy',
    invalid = false,
    modalZIndex = 1050,
    onChange,
}: ProxyPickerProps) {
    const [refreshing, setRefreshing] = useState(false);
    const [proxyModalOpen, setProxyModalOpen] = useState(false);
    const createResolverRef = useRef<((value: ProxyChoice | null) => void) | null>(null);
    const selectedUnavailable = value.startsWith('proxy:')
        && !workspaceProxies.some(proxy => `proxy:${proxy.id}` === value);
    const groups = useMemo(
        () => Array.from(new Set(
            workspaceProxies
                .map(proxy => proxy.group)
                .filter((group): group is string => Boolean(group)),
        )).sort((a, b) => a.localeCompare(b)),
        [workspaceProxies],
    );
    const options = useMemo(() => [
        {
            value: 'none' as ProxyChoice,
            label: 'None',
            detail: 'Connect directly without a proxy',
            icon: 'lucide:ban',
        },
        {
            value: 'auto' as ProxyChoice,
            label: 'Auto (round-robin)',
            detail: 'Rotate through the available proxy pool',
            icon: 'lucide:refresh-cw',
        },
        ...(selectedUnavailable ? [{
            value,
            label: 'Unavailable proxy',
            detail: 'This proxy is no longer available to you',
            icon: 'lucide:triangle-alert',
        }] : []),
        ...workspaceProxies.map(proxy => ({
            value: `proxy:${proxy.id}` as ProxyChoice,
            label: proxy.label,
            detail: proxy.group ?? '',
            iconText: proxy.country_code ? countryFlag(proxy.country_code) : '🌐',
        })),
    ], [selectedUnavailable, value, workspaceProxies]);

    useEffect(() => () => {
        createResolverRef.current?.(null);
        createResolverRef.current = null;
    }, []);

    const refreshProxies = () => new Promise<void>(resolve => {
        setRefreshing(true);
        router.reload({
            only: ['workspaceProxies'],
            onFinish: () => {
                setRefreshing(false);
                resolve();
            },
        });
    });

    const createProxy = () => new Promise<ProxyChoice | null>(resolve => {
        createResolverRef.current = resolve;
        setProxyModalOpen(true);
    });

    const closeProxyModal = () => {
        setProxyModalOpen(false);
        createResolverRef.current?.(null);
        createResolverRef.current = null;
    };

    const handleProxySaved = async (proxy: WorkspaceProxy) => {
        setProxyModalOpen(false);
        await refreshProxies();
        createResolverRef.current?.(`proxy:${proxy.id}`);
        createResolverRef.current = null;
    };

    return (
        <>
            <CustomSelect<ProxyChoice>
                value={value}
                options={options}
                searchThreshold={0}
                showOptionValue={false}
                placeholder="Select a proxy..."
                ariaLabel={ariaLabel}
                invalid={invalid}
                onChange={onChange}
                onRefresh={refreshProxies}
                refreshing={refreshing}
                actionSlot={canManageWorkspaceProxies ? {
                    label: '+ Add proxy',
                    onAction: createProxy,
                } : undefined}
            />

            <WorkspaceProxyFormModal
                isOpen={proxyModalOpen}
                teams={teams}
                groups={groups}
                zIndex={modalZIndex}
                onClose={closeProxyModal}
                onSaved={proxy => { void handleProxySaved(proxy); }}
            />
        </>
    );
}
