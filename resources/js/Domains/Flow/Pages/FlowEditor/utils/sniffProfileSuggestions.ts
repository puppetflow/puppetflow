import type { OnMount } from '@monaco-editor/react';
import {
    collectNamedResourcesFromCode,
    registerNamedResourceCompletions,
} from './namedResourceSuggestions';

export const DEFAULT_SNIFF_PROFILE_NAME = 'Default';

export const collectNamedSniffProfilesFromCode = (source: string) => (
    collectNamedResourcesFromCode(source, '$sniffNetwork', DEFAULT_SNIFF_PROFILE_NAME)
);

export function registerSniffProfileCompletions(
    monaco: Parameters<OnMount>[1],
    modelUri?: string | null,
    knownNames: string[] = [],
) {
    return registerNamedResourceCompletions(monaco, modelUri, {
        declarationHelper: '$sniffNetwork',
        helperNames: ['sniffNetwork', 'stopSniffing'],
        creationHelper: 'sniffNetwork',
        defaultName: DEFAULT_SNIFF_PROFILE_NAME,
        knownNames,
        createDetail: 'Named sniffing profile',
        existingDetail: 'Existing sniffing profile',
        documentationLabel: 'Network sniffing profile',
    });
}
