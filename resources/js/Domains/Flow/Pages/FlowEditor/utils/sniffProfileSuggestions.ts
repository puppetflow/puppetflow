import { collectNamedResourcesFromCode } from './namedResourceSuggestions';

export const DEFAULT_SNIFF_PROFILE_NAME = 'Default';

export const collectNamedSniffProfilesFromCode = (source: string) => (
    collectNamedResourcesFromCode(source, '$sniffNetwork', DEFAULT_SNIFF_PROFILE_NAME)
);
