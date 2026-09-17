import type { OnMount } from '@monaco-editor/react';
import {
    collectNamedResourcesFromCode,
    registerNamedResourceCompletions,
} from './namedResourceSuggestions';

export const DEFAULT_COOKIE_PROFILE_NAME = 'Default';

export const collectNamedCookieProfilesFromCode = (source: string) => (
    collectNamedResourcesFromCode(source, '$saveCookies', DEFAULT_COOKIE_PROFILE_NAME)
);

export function registerCookieProfileCompletions(
    monaco: Parameters<OnMount>[1],
    modelUri?: string | null,
    knownNames: string[] = [],
) {
    return registerNamedResourceCompletions(monaco, modelUri, {
        declarationHelper: '$saveCookies',
        helperNames: ['saveCookies', 'loadCookies', 'clearCookies'],
        creationHelper: 'saveCookies',
        defaultName: DEFAULT_COOKIE_PROFILE_NAME,
        knownNames,
        createDetail: 'Named cookie profile',
        existingDetail: 'Existing cookie profile',
        documentationLabel: 'Cookie profile',
    });
}
