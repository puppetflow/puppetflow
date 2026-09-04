import { collectNamedResourcesFromCode } from './namedResourceSuggestions';

export const DEFAULT_STOPWATCH_NAME = 'default';

export const collectNamedStopwatchesFromCode = (source: string) => (
    collectNamedResourcesFromCode(source, '$stopwatchStart', DEFAULT_STOPWATCH_NAME)
);
