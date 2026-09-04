import DataInspector from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/DataInspector/DataInspector';
import CustomSelect from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodeConfigModal/components/CustomSelect/CustomSelect';
import * as S from './styled';

export interface PreviewSource {
    id: string;
    label: string;
    icon: string;
    iconColor?: string;
    detail?: string;
    rootPath: string;
    value?: unknown;
    latestValue?: unknown;
    executions?: PreviewExecution[];
    executionStatus?: PreviewExecutionStatus;
}

export interface PreviewExecutionStatus {
    total: number;
    dropped: number;
    dropReason: 'count' | 'size' | 'history';
}

export interface PreviewExecution {
    value: unknown;
    ordinal: number;
    total: number;
    dropped: number;
    dropReason: 'count' | 'size' | 'history';
    detail?: string;
    detailBadge?: string;
    loopIndex?: number;
}

interface PreviewSectionProps {
    title: 'Before' | 'After';
    value: unknown;
    copyValue: unknown;
    rootPath: string;
    emptyText: string;
    flowId?: Id;
    sources?: PreviewSource[];
    selectedSourceId?: string;
    onSelectSource?: (sourceId: string) => void;
    executions?: PreviewExecution[];
    executionStatus?: PreviewExecutionStatus;
    selectedExecutionIndex?: number;
    onSelectExecution?: (index: number) => void;
    draggable?: boolean;
}

export default function PreviewSection({
    sources,
    selectedSourceId = '',
    onSelectSource,
    executions = [],
    executionStatus,
    selectedExecutionIndex = 0,
    onSelectExecution,
    ...props
}: PreviewSectionProps) {
    const droppedExecutions = executionStatus?.dropped ?? executions[0]?.dropped ?? 0;
    const dropReason = executionStatus?.dropReason ?? executions[0]?.dropReason ?? 'history';
    const executionFooterHint = droppedExecutions > 0
        ? `${droppedExecutions} hidden, ${dropReason} limit reached`
        : undefined;
    const showExecutionSelector = executions.length > 1 || droppedExecutions > 0;
    const executionOptions = executions.map((execution, index) => ({
        value: String(index),
        label: `${execution.ordinal} of ${execution.total}`,
        detail: execution.detail,
        detailBadge: execution.detailBadge,
        dividerBefore: index > 0 && execution.loopIndex === 0,
    }));
    const sourceControl = sources || showExecutionSelector ? (
        <S.PreviewControls>
            {sources && (
                <S.SourceSelector>
                    <CustomSelect
                        value={selectedSourceId}
                        options={sources.map(source => ({
                            value: source.id,
                            label: source.label,
                            detail: source.detail,
                            icon: source.icon,
                            iconColor: source.iconColor,
                        }))}
                        placeholder="No upstream node"
                        ariaLabel="Select upstream node output"
                        compact
                        compactHeight={32}
                        showOptionValue={false}
                        searchThreshold={8}
                        dropdownMinWidth={280}
                        disabled={sources.length === 0}
                        onChange={value => onSelectSource?.(value)}
                    />
                </S.SourceSelector>
            )}
            {showExecutionSelector && (
                <S.ExecutionSelector>
                    <CustomSelect
                        value={String(selectedExecutionIndex)}
                        options={executionOptions}
                        placeholder="No iterations"
                        ariaLabel={`Select ${props.title.toLowerCase()} execution`}
                        compact
                        compactHeight={32}
                        showOptionValue={false}
                        searchThreshold={executionOptions.some(option => option.detailBadge) ? 0 : 8}
                        dropdownMinWidth={240}
                        footerHint={executionFooterHint}
                        onChange={value => onSelectExecution?.(Number(value))}
                    />
                </S.ExecutionSelector>
            )}
        </S.PreviewControls>
    ) : null;

    return (
        <S.Pane>
            <DataInspector
                {...props}
                sourceControl={sourceControl}
                schemaSources={sources?.map(source => ({
                    id: source.id,
                    label: source.label,
                    icon: source.icon,
                    iconColor: source.iconColor,
                    rootPath: source.rootPath,
                    value: source.latestValue ?? source.value,
                }))}
                tabStorageKey={`puppetflow:node-config:${props.title.toLowerCase()}:inspector-tab`}
            />
        </S.Pane>
    );
}
