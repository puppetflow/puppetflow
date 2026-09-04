import { useThemeMode } from '@/App/Hooks/useThemeMode';
import { CodeEditor } from '@/Shared/CodeEditor/components/CodeEditor';
import { JSON_VIEWER_OPTIONS } from '@/Domains/Flow/Pages/FlowEditor/utils/runDisplay';
import { useReferenceLabelDecorations } from '@/Domains/Flow/Pages/FlowEditor/utils/referenceLabelDecorations';
import * as S from './styled';

interface JsonViewerProps {
    value: string;
    maxHeight?: number;
    fill?: boolean;
    flowId?: Id;
}

export default function JsonViewer({ value, maxHeight = 200, fill, flowId }: JsonViewerProps) {
    const { resolved: theme } = useThemeMode();
    const lineCount = value.split('\n').length;
    const height = fill ? '100%' : Math.min(lineCount * 18 + 10, maxHeight);
    const extensions = useReferenceLabelDecorations(flowId);

    return (
        <S.JsonViewerWrapper $maxHeight={fill ? undefined : maxHeight} $fill={fill}>
            <CodeEditor
                height={height}
                language="json"
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                value={value}
                extensions={extensions}
                options={JSON_VIEWER_OPTIONS}
            />
        </S.JsonViewerWrapper>
    );
}
