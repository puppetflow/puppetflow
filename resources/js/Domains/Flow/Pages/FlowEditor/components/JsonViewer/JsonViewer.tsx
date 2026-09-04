import Editor, { type OnMount } from '@monaco-editor/react';
import { useThemeMode } from '@/App/Hooks/useThemeMode';
import { registerReferenceLabelDecorations } from '@/Domains/Flow/Pages/FlowEditor/utils/referenceLabelDecorations';
import { JSON_VIEWER_OPTIONS } from '@/Domains/Flow/Pages/FlowEditor/utils/runDisplay';
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
    const handleMount: OnMount = (currentEditor, monaco) => {
        registerReferenceLabelDecorations(currentEditor, monaco, { flowId });
    };

    return (
        <S.JsonViewerWrapper $maxHeight={fill ? undefined : maxHeight} $fill={fill}>
            <Editor
                height={height}
                language="json"
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                value={value}
                onMount={handleMount}
                options={JSON_VIEWER_OPTIONS}
            />
        </S.JsonViewerWrapper>
    );
}
