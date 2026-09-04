import { useMemo, useState, type ReactNode } from 'react';
import { useToast } from '@/App/Hooks/useToast';
import InspectorSchemaTree from './components/InspectorSchemaTree/InspectorSchemaTree';
import InspectorToolbar, { type InspectorTab } from './components/InspectorToolbar/InspectorToolbar';
import InspectorTreeNode from './components/InspectorTreeNode/InspectorTreeNode';
import { useReferenceDisplays } from './referenceDisplays';
import { useCollapsedPaths } from './useCollapsedPaths';
import { buildTreeRows, defaultCollapsedContainerPaths, stringifyJson } from './utils';
import * as S from './styled';

const withoutSystemVariables = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;

    return Object.fromEntries(
        Object.entries(value).filter(([key]) => !['$input', '$output', '$context'].includes(key)),
    );
};

interface DataInspectorSchemaSource {
    id: string;
    label: string;
    icon?: string;
    iconColor?: string;
    rootPath: string;
    value: unknown;
}

interface DataInspectorProps {
    title: string;
    value: unknown;
    copyValue?: unknown;
    rootPath: string;
    emptyText: string;
    tabStorageKey?: string;
    flowId?: Id;
    sourceControl?: ReactNode;
    draggable?: boolean;
    schemaSources?: DataInspectorSchemaSource[];
}

export default function DataInspector({
    title,
    value,
    copyValue,
    rootPath,
    emptyText,
    tabStorageKey,
    flowId,
    sourceControl,
    draggable = true,
    schemaSources,
}: DataInspectorProps) {
    const { toast } = useToast();
    const [tab, setTab] = useState<InspectorTab>(() => {
        if (!tabStorageKey || typeof window === 'undefined') return 'json';
        return window.localStorage.getItem(tabStorageKey) === 'schema' ? 'schema' : 'json';
    });
    const systemVariablesStorageKey = tabStorageKey ? `${tabStorageKey}:show-system-variables` : null;
    const [showSystemVariables, setShowSystemVariables] = useState(() => {
        if (!systemVariablesStorageKey || typeof window === 'undefined') return true;
        return window.localStorage.getItem(systemVariablesStorageKey) !== 'false';
    });
    const references = useReferenceDisplays(flowId);
    const displayValue = useMemo(
        () => showSystemVariables ? value : withoutSystemVariables(value),
        [showSystemVariables, value],
    );
    const defaultCollapsedPaths = useMemo(
        () => defaultCollapsedContainerPaths(buildTreeRows(displayValue, rootPath)),
        [displayValue, rootPath],
    );
    const { collapsedPaths, toggleCollapsedPath } = useCollapsedPaths(defaultCollapsedPaths);
    const clipboardValue = useMemo(
        () => showSystemVariables ? copyValue ?? value : withoutSystemVariables(copyValue ?? value),
        [copyValue, showSystemVariables, value],
    );
    const rows = useMemo(() => {
        if (!schemaSources) return buildTreeRows(displayValue, rootPath);

        return schemaSources.flatMap(source => {
            const sourceValue = showSystemVariables
                ? source.value
                : withoutSystemVariables(source.value);
            return buildTreeRows(sourceValue, source.rootPath).map((row, index) => (
                index === 0 ? { ...row, key: source.label } : row
            ));
        });
    }, [displayValue, rootPath, schemaSources, showSystemVariables]);
    const schemaRootDisplays = useMemo(() => new Map(
        schemaSources?.map(source => [
            source.rootPath,
            { icon: source.icon, iconColor: source.iconColor },
        ]) ?? [],
    ), [schemaSources]);
    const hasValue = displayValue !== undefined;
    const changeTab = (nextTab: InspectorTab) => {
        setTab(nextTab);
        if (tabStorageKey && typeof window !== 'undefined') {
            window.localStorage.setItem(tabStorageKey, nextTab);
        }
    };
    const toggleSystemVariables = () => {
        setShowSystemVariables(current => {
            const next = !current;
            if (systemVariablesStorageKey && typeof window !== 'undefined') {
                window.localStorage.setItem(systemVariablesStorageKey, String(next));
            }
            return next;
        });
    };
    const copyJson = () => {
        if (!hasValue) return;
        if (!navigator.clipboard) {
            toast('Clipboard is not available');
            return;
        }

        let serialized: string | undefined;
        try {
            serialized = stringifyJson(clipboardValue);
        } catch {
            toast('Unable to copy JSON');
            return;
        }
        if (serialized === undefined) {
            toast('Unable to copy JSON');
            return;
        }

        navigator.clipboard.writeText(serialized)
            .then(() => toast(`${title} JSON copied to clipboard`))
            .catch(() => toast('Unable to copy JSON'));
    };

    return (
        <S.InspectorPanel>
            <InspectorToolbar
                title={title}
                tab={tab}
                hasValue={hasValue}
                showSystemVariables={showSystemVariables}
                sourceControl={tab === 'json' ? sourceControl : undefined}
                onTabChange={changeTab}
                onCopy={copyJson}
                onToggleSystemVariables={toggleSystemVariables}
            />
            <S.InspectorBody>
                {!hasValue ? (
                    <S.InspectorEmpty>{emptyText}</S.InspectorEmpty>
                ) : tab === 'json' ? (
                    <S.InspectorJsonTree>
                        <InspectorTreeNode
                            value={displayValue}
                            path={rootPath}
                            draggable={draggable}
                            references={references}
                            collapsedPaths={collapsedPaths}
                            onToggleCollapse={toggleCollapsedPath}
                        />
                    </S.InspectorJsonTree>
                ) : (
                    <InspectorSchemaTree
                        key={schemaSources?.map(source => source.id).join(':') ?? rootPath}
                        rows={rows}
                        references={references}
                        draggable={draggable}
                        showRoots={Boolean(schemaSources)}
                        initialOpenRootPath={schemaSources?.[0]?.rootPath}
                        rootDisplays={schemaRootDisplays}
                    />
                )}
            </S.InspectorBody>
        </S.InspectorPanel>
    );
}
