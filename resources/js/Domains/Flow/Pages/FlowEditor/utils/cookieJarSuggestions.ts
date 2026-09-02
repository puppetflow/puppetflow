import type { OnMount } from '@monaco-editor/react';
import {
    collectNamedResourcesFromCode,
    registerNamedResourceCompletions,
} from './namedResourceSuggestions';

export const DEFAULT_COOKIE_JAR_NAME = 'Default';

export const collectNamedCookieJarsFromCode = (source: string) => (
    collectNamedResourcesFromCode(source, '$saveCookies', DEFAULT_COOKIE_JAR_NAME)
);

export function registerCookieJarCompletions(
    monaco: Parameters<OnMount>[1],
    modelUri?: string | null,
    knownNames: string[] = [],
) {
    return registerNamedResourceCompletions(monaco, modelUri, {
        declarationHelper: '$saveCookies',
        helperNames: ['saveCookies', 'loadCookies'],
        creationHelper: 'saveCookies',
        defaultName: DEFAULT_COOKIE_JAR_NAME,
        knownNames,
        createDetail: 'Named cookie jar',
        existingDetail: 'Existing cookie jar',
        documentationLabel: 'Cookie jar',
    });
}
