import FlowEditorView from './components/FlowEditorView/FlowEditorView';
import { useFlowEditorController } from './hooks/useFlowEditorController';
import { NodeValidationProvider } from './Panes/NodalEditorPane/contexts/NodeValidationContext';
import { QuickRequirementCreationProvider } from './Panes/NodalEditorPane/contexts/QuickRequirementCreationContext';
import type { FlowEditorPageProps, FlowEditorProps } from './types';

const EMPTY_RUNS: FlowEditorProps['runs'] = {
    data: [],
    current_page: 1,
    last_page: 1,
    per_page: 20,
    from: null,
    to: null,
    total: 0,
    links: [],
};

const EMPTY_STATS: FlowEditorProps['stats'] = {
    total: 0,
    success: 0,
    failed: 0,
    cancelled: 0,
    total_duration_ms: 0,
};

export default function FlowEditor(pageProps: FlowEditorPageProps) {
    const runsLoading = pageProps.runs === undefined;
    const props: FlowEditorProps = {
        ...pageProps,
        runs: pageProps.runs ?? EMPTY_RUNS,
        stats: pageProps.stats ?? EMPTY_STATS,
    };
    const controller = useFlowEditorController(props);

    return (
        <NodeValidationProvider flowId={props.flow.id}>
            <QuickRequirementCreationProvider
                flowId={props.flow.id}
                isNodalFlow={props.flow.flow_type === 'nodal'}
            >
                <FlowEditorView {...props} controller={controller} runsLoading={runsLoading} />
            </QuickRequirementCreationProvider>
        </NodeValidationProvider>
    );
}
