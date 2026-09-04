import { collectNamedResourcesFromCode } from './namedResourceSuggestions';

export const DEFAULT_COOKIE_JAR_NAME = 'Default';

export const collectNamedCookieJarsFromCode = (source: string) => (
    collectNamedResourcesFromCode(source, '$saveCookies', DEFAULT_COOKIE_JAR_NAME)
);
