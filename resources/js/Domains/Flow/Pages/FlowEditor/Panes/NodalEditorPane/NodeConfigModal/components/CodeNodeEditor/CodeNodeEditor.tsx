import { useMemo } from 'react';
import { CodeEditor } from '@/Shared/CodeEditor/components/CodeEditor';
import { usePuppetflowCompletions } from '@/Shared/CodeEditor/completion/usePuppetflowCompletions';
import {
    buildNodalTypeLibrary,
    usePuppetflowTypeLibraries,
} from '@/Shared/CodeEditor/typescript/puppetflowTypeLibraries';
import { useTypeScriptSupport } from '@/Shared/CodeEditor/typescript/useTypeScriptSupport';
import { useThemeMode } from '@/App/Hooks/useThemeMode';
import { useReferenceLabelDecorations } from '@/Domains/Flow/Pages/FlowEditor/utils/referenceLabelDecorations';
import type { NodalAutocompleteContext } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/staticAnalysis';
import * as S from './styled';

const CODE_NODE_EDITOR_OPTIONS = {
    fontSize: 12,
    lineHeight: 19,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    wordWrap: 'on' as const,
    padding: { top: 10, bottom: 10 },
    contextmenu: false,
};

interface CodeNodeEditorProps {
    value: string;
    outputData: unknown;
    autocompleteContext: NodalAutocompleteContext;
    flowId?: Id;
    readOnly?: boolean;
    onChange: (value: string) => void;
}

export default function CodeNodeEditor({
    value,
    outputData,
    autocompleteContext,
    flowId,
    readOnly,
    onChange,
}: CodeNodeEditorProps) {
    const { resolved: theme } = useThemeMode();
    const completionOptions = useMemo(() => ({
        mode: 'nodal-code' as const,
        flowId,
        nodalContext: {
            ...autocompleteContext,
            outputData: outputData && typeof outputData === 'object' && !Array.isArray(outputData)
                ? outputData as Record<string, unknown>
                : null,
        },
    }), [autocompleteContext, flowId, outputData]);
    const completionExtensions = usePuppetflowCompletions(completionOptions);
    const baseTypeLibraries = usePuppetflowTypeLibraries('nodal');
    const typeLibraries = useMemo(() => ({
        ...baseTypeLibraries,
        '/puppetflow-nodal-context.d.ts': buildNodalTypeLibrary(completionOptions.nodalContext),
    }), [baseTypeLibraries, completionOptions.nodalContext]);
    const typeScriptExtensions = useTypeScriptSupport({
        code: value,
        extraLibs: typeLibraries,
    });
    const referenceExtensions = useReferenceLabelDecorations(flowId);
    const extensions = useMemo(
        () => [...completionExtensions, ...typeScriptExtensions, ...referenceExtensions],
        [completionExtensions, referenceExtensions, typeScriptExtensions],
    );

    return (
        <S.CodeNodeField>
            <S.CodeNodeEditor>
                <CodeEditor
                    height="100%"
                    defaultLanguage="javascript"
                    value={value}
                    theme={theme === 'dark' ? 'vs-dark' : 'light'}
                    options={{ ...CODE_NODE_EDITOR_OPTIONS, readOnly }}
                    extensions={extensions}
                    onChange={nextValue => onChange(nextValue ?? '')}
                />
            </S.CodeNodeEditor>
            <S.ExpressionHint>
                This code is inserted directly in the generated run function. Use $run for the current input snapshot, $('RUN') for initial run data, $nodes for named snapshots, and $vars(…) for workspace variables.
            </S.ExpressionHint>
        </S.CodeNodeField>
    );
}
