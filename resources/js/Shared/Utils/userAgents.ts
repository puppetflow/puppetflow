// Catalog of plausible browser user agents and a small builder used by the
// user agent picker. Templates follow the current reduced UA formats shipped by
// each vendor (frozen OS versions, "Android 10; K" on Chrome for Android, etc.).

export type BrowserId = 'chrome' | 'firefox' | 'safari' | 'edge' | 'opera' | 'samsung';
export type PlatformId = 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'ipados';

export interface PickerOption {
    id: string;
    label: string;
    hint?: string;
}

export interface BrowserDefinition extends PickerOption {
    id: BrowserId;
    icon: string;
    platforms: PlatformId[];
}

export interface PlatformDefinition extends PickerOption {
    id: PlatformId;
    icon: string;
}

export interface UserAgentSelection {
    browser: BrowserId;
    platform: PlatformId;
    version: string;
    variant: string;
}

const CHROME_MAJORS = [148, 147, 146, 145, 144, 143, 142, 141, 140, 139, 138];
const FIREFOX_MAJORS = [146, 145, 144, 143, 142, 141, 140, 139, 138];
const SAFARI_VERSIONS = ['26.1', '26.0', '18.6', '18.5', '18.4', '18.3', '18.2', '18.1', '18.0', '17.6'];
const IOS_VERSIONS = ['26.1', '26.0', '18.6', '18.5', '18.4', '18.3', '18.2', '18.1', '18.0', '17.6.1'];
// Opera desktop majors trail Chromium by 14 releases.
const OPERA_CHROMIUM_OFFSET = 14;
const OPERA_MAJORS = CHROME_MAJORS.map(major => major - OPERA_CHROMIUM_OFFSET);
// Samsung Internet major mapped to the Chromium it embeds.
const SAMSUNG_VERSIONS: Record<string, number> = { '30.0': 142, '29.0': 136, '28.0': 130, '27.0': 125 };

export const BROWSERS: BrowserDefinition[] = [
    { id: 'chrome', label: 'Chrome', icon: 'logos:chrome', platforms: ['windows', 'macos', 'linux', 'android', 'ios', 'ipados'] },
    { id: 'firefox', label: 'Firefox', icon: 'logos:firefox', platforms: ['windows', 'macos', 'linux', 'android', 'ios', 'ipados'] },
    { id: 'safari', label: 'Safari', icon: 'logos:safari', platforms: ['macos', 'ios', 'ipados'] },
    { id: 'edge', label: 'Edge', icon: 'logos:microsoft-edge', platforms: ['windows', 'macos', 'linux', 'android', 'ios'] },
    { id: 'opera', label: 'Opera', icon: 'logos:opera', platforms: ['windows', 'macos', 'linux', 'android'] },
    { id: 'samsung', label: 'Samsung Internet', icon: 'simple-icons:samsung', platforms: ['android'] },
];

export const PLATFORMS: Record<PlatformId, PlatformDefinition> = {
    windows: { id: 'windows', label: 'Windows', icon: 'lucide:monitor' },
    macos: { id: 'macos', label: 'macOS', icon: 'lucide:laptop' },
    linux: { id: 'linux', label: 'Linux', icon: 'lucide:terminal' },
    android: { id: 'android', label: 'Android', icon: 'lucide:smartphone' },
    ios: { id: 'ios', label: 'iPhone', icon: 'lucide:smartphone' },
    ipados: { id: 'ipados', label: 'iPad', icon: 'lucide:tablet' },
};

interface AndroidDevice {
    id: string;
    label: string;
    android: string;
    model: string;
}

const ANDROID_DEVICES: AndroidDevice[] = [
    { id: 'pixel-9-pro', label: 'Pixel 9 Pro', android: '16', model: 'Pixel 9 Pro' },
    { id: 'pixel-9', label: 'Pixel 9', android: '16', model: 'Pixel 9' },
    { id: 'pixel-8-pro', label: 'Pixel 8 Pro', android: '15', model: 'Pixel 8 Pro' },
    { id: 'pixel-8', label: 'Pixel 8', android: '15', model: 'Pixel 8' },
    { id: 'pixel-7', label: 'Pixel 7', android: '14', model: 'Pixel 7' },
    { id: 'galaxy-s25-ultra', label: 'Galaxy S25 Ultra', android: '15', model: 'SM-S938B' },
    { id: 'galaxy-s24-ultra', label: 'Galaxy S24 Ultra', android: '15', model: 'SM-S928B' },
    { id: 'galaxy-s23', label: 'Galaxy S23', android: '14', model: 'SM-S911B' },
    { id: 'galaxy-a55', label: 'Galaxy A55', android: '14', model: 'SM-A556B' },
    { id: 'oneplus-12', label: 'OnePlus 12', android: '15', model: 'CPH2581' },
    { id: 'xiaomi-14', label: 'Xiaomi 14', android: '15', model: '23127PN0CG' },
];

const ANDROID_VERSIONS = ['16', '15', '14', '13'];

function isApplePlatform(platform: PlatformId): boolean {
    return platform === 'ios' || platform === 'ipados';
}

export function browserDefinition(browser: BrowserId): BrowserDefinition {
    return BROWSERS.find(entry => entry.id === browser) ?? BROWSERS[0];
}

export function platformsFor(browser: BrowserId): PlatformDefinition[] {
    return browserDefinition(browser).platforms.map(id => PLATFORMS[id]);
}

// Version column. For Safari on iPhone and iPad the browser version is the OS version.
export function versionsFor(browser: BrowserId, platform: PlatformId): PickerOption[] {
    if (browser === 'safari') {
        return isApplePlatform(platform)
            ? IOS_VERSIONS.map(version => ({ id: version, label: `iOS ${version}`, hint: `Safari ${version.split('.').slice(0, 2).join('.')}` }))
            : SAFARI_VERSIONS.map(version => ({ id: version, label: `Safari ${version}` }));
    }
    if (browser === 'firefox') {
        return FIREFOX_MAJORS.map(major => ({ id: String(major), label: `Firefox ${major}` }));
    }
    if (browser === 'opera') {
        return OPERA_MAJORS.map(major => ({ id: String(major), label: `Opera ${major}`, hint: `Chromium ${major + OPERA_CHROMIUM_OFFSET}` }));
    }
    if (browser === 'samsung') {
        return Object.entries(SAMSUNG_VERSIONS).map(([version, chromium]) => ({ id: version, label: `Samsung Internet ${version}`, hint: `Chromium ${chromium}` }));
    }
    const label = browser === 'edge' ? 'Edge' : 'Chrome';
    return CHROME_MAJORS.map(major => ({ id: String(major), label: `${label} ${major}` }));
}

// Variant column: device or OS release. Desktop platforms report frozen OS
// versions so they expose a single entry.
export function variantsFor(browser: BrowserId, platform: PlatformId): PickerOption[] {
    switch (platform) {
        case 'windows':
            return [{ id: 'win64', label: 'Windows 10 / 11', hint: 'Win64; x64' }];
        case 'macos':
            return [{ id: 'intel', label: 'Mac (Intel or Apple silicon)', hint: browser === 'firefox' ? 'Mac OS X 10.15' : 'Mac OS X 10_15_7' }];
        case 'linux':
            return browser === 'firefox'
                ? [
                    { id: 'x86_64', label: 'Generic x86_64', hint: 'X11; Linux x86_64' },
                    { id: 'ubuntu', label: 'Ubuntu', hint: 'X11; Ubuntu; Linux x86_64' },
                    { id: 'fedora', label: 'Fedora', hint: 'X11; Fedora; Linux x86_64' },
                ]
                : [{ id: 'x86_64', label: 'Generic x86_64', hint: 'X11; Linux x86_64' }];
        case 'android':
            if (browser === 'firefox') {
                return ANDROID_VERSIONS.map(version => ({ id: `android-${version}`, label: `Android ${version}`, hint: 'No device model' }));
            }
            if (browser === 'samsung') {
                return ANDROID_DEVICES
                    .filter(device => device.model.startsWith('SM-'))
                    .map(device => ({ id: device.id, label: device.label, hint: `Android ${device.android}; SAMSUNG ${device.model}` }));
            }
            return [
                { id: 'reduced', label: 'Reduced (default)', hint: 'Android 10; K' },
                ...ANDROID_DEVICES.map(device => ({ id: device.id, label: device.label, hint: `Android ${device.android}; ${device.model}` })),
            ];
        case 'ios':
        case 'ipados':
            if (browser === 'safari') {
                return [{ id: 'default', label: platform === 'ios' ? 'iPhone' : 'iPad' }];
            }
            return IOS_VERSIONS.map(version => ({ id: version, label: `iOS ${version}` }));
        default:
            return [];
    }
}

export function defaultSelection(browser: BrowserId, platform?: PlatformId): UserAgentSelection {
    const definition = browserDefinition(browser);
    const resolvedPlatform = platform && definition.platforms.includes(platform) ? platform : definition.platforms[0];
    return {
        browser,
        platform: resolvedPlatform,
        version: versionsFor(browser, resolvedPlatform)[0]?.id ?? '',
        variant: variantsFor(browser, resolvedPlatform)[0]?.id ?? '',
    };
}

function underscore(version: string): string {
    return version.replace(/\./g, '_');
}

function androidToken(browser: BrowserId, variant: string): string {
    if (browser === 'firefox') {
        const version = variant.replace(/^android-/, '');
        return `Android ${ANDROID_VERSIONS.includes(version) ? version : ANDROID_VERSIONS[0]}; Mobile`;
    }
    const device = ANDROID_DEVICES.find(entry => entry.id === variant);
    if (!device) return 'Linux; Android 10; K';
    const model = browser === 'samsung' ? `SAMSUNG ${device.model}` : device.model;
    return `Linux; Android ${device.android}; ${model}`;
}

function appleToken(platform: PlatformId, osVersion: string): string {
    const version = underscore(osVersion);
    return platform === 'ipados'
        ? `iPad; CPU OS ${version} like Mac OS X`
        : `iPhone; CPU iPhone OS ${version} like Mac OS X`;
}

function desktopToken(browser: BrowserId, platform: PlatformId, variant: string, firefoxMajor?: number): string {
    const gecko = firefoxMajor !== undefined ? `; rv:${firefoxMajor}.0` : '';
    switch (platform) {
        case 'windows':
            return `Windows NT 10.0; Win64; x64${gecko}`;
        case 'macos':
            return browser === 'firefox'
                ? `Macintosh; Intel Mac OS X 10.15${gecko}`
                : 'Macintosh; Intel Mac OS X 10_15_7';
        case 'linux':
            if (variant === 'ubuntu') return `X11; Ubuntu; Linux x86_64${gecko}`;
            if (variant === 'fedora') return `X11; Fedora; Linux x86_64${gecko}`;
            return `X11; Linux x86_64${gecko}`;
        default:
            return `Windows NT 10.0; Win64; x64${gecko}`;
    }
}

export function buildUserAgent(selection: UserAgentSelection): string {
    const { browser, platform, version, variant } = selection;
    const chromiumMajor = browser === 'opera'
        ? Number(version) + OPERA_CHROMIUM_OFFSET
        : browser === 'samsung'
            ? SAMSUNG_VERSIONS[version] ?? CHROME_MAJORS[0]
            : Number(version) || CHROME_MAJORS[0];

    if (isApplePlatform(platform)) {
        const osVersion = browser === 'safari' ? version : variant;
        const token = appleToken(platform, osVersion || IOS_VERSIONS[0]);
        const webkit = 'AppleWebKit/605.1.15 (KHTML, like Gecko)';
        switch (browser) {
            case 'safari': {
                const safariVersion = (osVersion || IOS_VERSIONS[0]).split('.').slice(0, 2).join('.');
                return `Mozilla/5.0 (${token}) ${webkit} Version/${safariVersion} Mobile/15E148 Safari/604.1`;
            }
            case 'firefox':
                return `Mozilla/5.0 (${token}) ${webkit} FxiOS/${version}.0 Mobile/15E148 Safari/605.1.15`;
            case 'edge':
                return `Mozilla/5.0 (${token}) ${webkit} EdgiOS/${chromiumMajor}.0.0.0 Mobile/15E148 Safari/605.1.15`;
            default:
                return `Mozilla/5.0 (${token}) ${webkit} CriOS/${chromiumMajor}.0.0.0 Mobile/15E148 Safari/604.1`;
        }
    }

    if (platform === 'android') {
        const token = androidToken(browser, variant);
        if (browser === 'firefox') {
            return `Mozilla/5.0 (${token}; rv:${version}.0) Gecko/${version}.0 Firefox/${version}.0`;
        }
        const base = `Mozilla/5.0 (${token}) AppleWebKit/537.36 (KHTML, like Gecko)`;
        switch (browser) {
            case 'edge':
                return `${base} Chrome/${chromiumMajor}.0.0.0 Mobile Safari/537.36 EdgA/${chromiumMajor}.0.0.0`;
            case 'opera':
                return `${base} Chrome/${chromiumMajor}.0.0.0 Mobile Safari/537.36 OPR/${Math.max(60, Number(version) - 40)}.0.0.0`;
            case 'samsung':
                return `${base} SamsungBrowser/${version} Chrome/${chromiumMajor}.0.0.0 Mobile Safari/537.36`;
            default:
                return `${base} Chrome/${chromiumMajor}.0.0.0 Mobile Safari/537.36`;
        }
    }

    if (browser === 'firefox') {
        const major = Number(version) || FIREFOX_MAJORS[0];
        return `Mozilla/5.0 (${desktopToken(browser, platform, variant, major)}) Gecko/20100101 Firefox/${major}.0`;
    }

    if (browser === 'safari') {
        return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version || SAFARI_VERSIONS[0]} Safari/605.1.15`;
    }

    const base = `Mozilla/5.0 (${desktopToken(browser, platform, variant)}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromiumMajor}.0.0.0 Safari/537.36`;
    switch (browser) {
        case 'edge':
            return `${base} Edg/${chromiumMajor}.0.0.0`;
        case 'opera':
            return `${base} OPR/${version}.0.0.0`;
        default:
            return base;
    }
}

function pick<T>(items: readonly T[]): T {
    return items[Math.floor(Math.random() * items.length)];
}

export function randomSelection(): UserAgentSelection {
    const browser = pick(BROWSERS);
    const platform = pick(browser.platforms);
    const version = pick(versionsFor(browser.id, platform)).id;
    const variant = pick(variantsFor(browser.id, platform)).id;
    return { browser: browser.id, platform, version, variant };
}

export function describeSelection(selection: UserAgentSelection): string {
    const browser = browserDefinition(selection.browser);
    const version = versionsFor(selection.browser, selection.platform).find(option => option.id === selection.version);
    const variant = variantsFor(selection.browser, selection.platform).find(option => option.id === selection.variant);
    const parts = [version?.label ?? browser.label, PLATFORMS[selection.platform].label];
    if (variant && variant.id !== 'default') parts.push(variant.label);
    return parts.join(' / ');
}
