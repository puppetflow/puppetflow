import type { OnMount } from '@monaco-editor/react';
import {
    collectNamedResourcesFromCode,
    registerNamedResourceCompletions,
} from './namedResourceSuggestions';

export const DEFAULT_STOPWATCH_NAME = 'default';

export const collectNamedStopwatchesFromCode = (source: string) => (
    collectNamedResourcesFromCode(source, '$stopwatchStart', DEFAULT_STOPWATCH_NAME)
);

export function registerStopwatchNameCompletions(
    monaco: Parameters<OnMount>[1],
    modelUri?: string | null,
    knownNames: string[] = [],
) {
    return registerNamedResourceCompletions(monaco, modelUri, {
        declarationHelper: '$stopwatchStart',
        helperNames: ['stopwatchStart', 'stopwatchStop', 'stopwatchCheck'],
        creationHelper: 'stopwatchStart',
        defaultName: DEFAULT_STOPWATCH_NAME,
        knownNames,
        createDetail: 'Named stopwatch',
        existingDetail: 'Existing stopwatch',
        documentationLabel: 'Stopwatch',
    });
}
