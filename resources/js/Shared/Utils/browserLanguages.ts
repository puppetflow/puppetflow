// Browser language presets. Values are Accept-Language lists (comma-separated
// BCP 47 tags) as stored on workspaces and flows and sent to Chromium.
export interface BrowserLanguageOption {
    value: string;
    label: string;
}

export const BROWSER_LANGUAGE_OPTIONS: readonly BrowserLanguageOption[] = [
    { value: 'en-US,en', label: 'English (United States)' },
    { value: 'en-GB,en', label: 'English (United Kingdom)' },
    { value: 'fr-FR,fr', label: 'French (France)' },
    { value: 'fr-CA,fr', label: 'French (Canada)' },
    { value: 'de-DE,de', label: 'German (Germany)' },
    { value: 'es-ES,es', label: 'Spanish (Spain)' },
    { value: 'es-MX,es', label: 'Spanish (Mexico)' },
    { value: 'it-IT,it', label: 'Italian (Italy)' },
    { value: 'pt-PT,pt', label: 'Portuguese (Portugal)' },
    { value: 'pt-BR,pt', label: 'Portuguese (Brazil)' },
    { value: 'nl-NL,nl', label: 'Dutch (Netherlands)' },
    { value: 'pl-PL,pl', label: 'Polish (Poland)' },
    { value: 'ru-RU,ru', label: 'Russian (Russia)' },
    { value: 'uk-UA,uk', label: 'Ukrainian (Ukraine)' },
    { value: 'tr-TR,tr', label: 'Turkish (Turkey)' },
    { value: 'ar-SA,ar', label: 'Arabic (Saudi Arabia)' },
    { value: 'he-IL,he', label: 'Hebrew (Israel)' },
    { value: 'hi-IN,hi', label: 'Hindi (India)' },
    { value: 'ja-JP,ja', label: 'Japanese (Japan)' },
    { value: 'ko-KR,ko', label: 'Korean (South Korea)' },
    { value: 'zh-CN,zh', label: 'Chinese (Simplified, China)' },
    { value: 'zh-TW,zh', label: 'Chinese (Traditional, Taiwan)' },
    { value: 'sv-SE,sv', label: 'Swedish (Sweden)' },
    { value: 'da-DK,da', label: 'Danish (Denmark)' },
    { value: 'nb-NO,nb', label: 'Norwegian (Norway)' },
    { value: 'fi-FI,fi', label: 'Finnish (Finland)' },
    { value: 'cs-CZ,cs', label: 'Czech (Czechia)' },
    { value: 'el-GR,el', label: 'Greek (Greece)' },
    { value: 'ro-RO,ro', label: 'Romanian (Romania)' },
    { value: 'hu-HU,hu', label: 'Hungarian (Hungary)' },
    { value: 'vi-VN,vi', label: 'Vietnamese (Vietnam)' },
    { value: 'th-TH,th', label: 'Thai (Thailand)' },
    { value: 'id-ID,id', label: 'Indonesian (Indonesia)' },
];

// Human label for a stored value, falling back to the raw tags for custom
// values set through the API.
export function formatBrowserLanguage(value: string | null | undefined): string {
    const normalized = normalizeBrowserLanguage(value);
    if (!normalized) return '';
    const preset = BROWSER_LANGUAGE_OPTIONS.find(option => option.value === normalized);
    return preset ? `${preset.label} (${normalized})` : normalized;
}

// Emoji flag for the region of the first tag ("fr-CA,fr" -> 🇨🇦), or a globe
// when the tag carries no region ("fr").
export function browserLanguageFlag(value: string | null | undefined): string {
    const primary = normalizeBrowserLanguage(value).split(',')[0] ?? '';
    const region = primary.split('-').slice(1).find(part => /^[A-Za-z]{2}$/.test(part));
    if (!region) return '🌐';
    return [...region.toUpperCase()]
        .map(character => String.fromCodePoint(127397 + character.charCodeAt(0)))
        .join('');
}

export function normalizeBrowserLanguage(value: string | null | undefined): string {
    return (value ?? '')
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean)
        .join(',');
}
