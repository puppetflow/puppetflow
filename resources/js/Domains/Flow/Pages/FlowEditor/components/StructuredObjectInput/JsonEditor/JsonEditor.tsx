import { useCallback, useMemo, type MutableRefObject } from 'react';
import { CodeEditor } from '@/Shared/CodeEditor/components/CodeEditor';
import { usePuppetflowCompletions } from '@/Shared/CodeEditor/completion/usePuppetflowCompletions';
import JsonExpandable from '@/Shared/UI/JsonExpandable/JsonExpandable';
import { useThemeMode } from '@/App/Hooks/useThemeMode';
import { useReferenceLabelDecorations } from '@/Domains/Flow/Pages/FlowEditor/utils/referenceLabelDecorations';
import * as S from './styled';

interface JsonEditorProps {
    value: string;
    title: string;
    readOnly: boolean;
    height: number;
    flowId?: Id;
    openRef: MutableRefObject<(() => void) | null>;
    onChange: (value: string | undefined) => void;
}

export default function JsonEditor({
    value,
    title,
    readOnly,
    height,
    flowId,
    openRef,
    onChange,
}: JsonEditorProps) {
    const { resolved: theme } = useThemeMode();
    const completionOptions = useMemo(() => ({
        mode: 'code-flow' as const,
        flowId,
    }), [flowId]);
    const completionExtensions = usePuppetflowCompletions(completionOptions);
    const referenceExtensions = useReferenceLabelDecorations(flowId);
    const extensions = useMemo(
        () => [...completionExtensions, ...referenceExtensions],
        [completionExtensions, referenceExtensions],
    );

    const handleChange = useCallback((nextValue: string | undefined) => {
        onChange(nextValue || '{}');
    }, [onChange]);

    return (
        <JsonExpandable
            value={value}
            onChange={nextValue => onChange(nextValue)}
            title={title}
            readOnly={readOnly}
            hideDefaultTrigger
            openRef={openRef}
        >
            <S.EditorWrapper style={{ height }}>
                <CodeEditor
                    height="100%"
                    language="json"
                    theme={theme === 'dark' ? 'vs-dark' : 'light'}
                    value={value}
                    onChange={handleChange}
                    extensions={extensions}
                    options={{
                        fontSize: 12,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        lineNumbers: 'off',
                        tabSize: 2,
                        wordWrap: 'off',
                        padding: { top: 8 },
                        readOnly,
                    }}
                />
            </S.EditorWrapper>
        </JsonExpandable>
    );
}
