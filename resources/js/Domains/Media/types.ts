import type { ExplorerItem, ExplorerPageData } from '@/Shared/Explorer/types';

/** Compact projection embedded in the sidebar trees. */
export interface MediaTreeItem extends ExplorerItem {
    folder_id: Id | null;
    mime_type: string;
    thumbnail_url?: string | null;
}

/** Full projection used by the explorer results and the metadata modal. */
export interface MediaAsset extends MediaTreeItem {
    original_filename: string;
    extension?: string | null;
    size_bytes: number;
    url: string;
    download_url?: string | null;
    alt_text?: string | null;
    description?: string | null;
    tags?: string[];
    owner?: { id: Id; name: string } | null;
    can_manage: boolean;
    can_transfer_ownership: boolean;
    updated_at: string;
}

export interface MediaLibraryProps extends ExplorerPageData<MediaAsset> {
    maxUploadSize: number;
    tagSuggestions: string[];
    activeTag: string | null;
    inspectingItem: MediaAsset | null;
}

const EDITABLE_TEXT_EXTENSIONS = new Set([
    'bash', 'c', 'cc', 'cfg', 'cjs', 'conf', 'cpp', 'cs', 'css', 'csv',
    'env', 'fish', 'go', 'gql', 'graphql', 'h', 'hpp', 'htm', 'html', 'ini',
    'java', 'js', 'json', 'jsonl', 'jsx', 'less', 'log', 'markdown', 'md',
    'mjs', 'ndjson', 'php', 'properties', 'py', 'rb', 'rs', 'sass', 'scss',
    'sh', 'sql', 'svg', 'toml', 'ts', 'tsv', 'tsx', 'txt', 'xml', 'yaml',
    'yml', 'zsh',
]);

const EDITABLE_APPLICATION_MIMES = new Set([
    'application/ecmascript',
    'application/javascript',
    'application/json',
    'application/sql',
    'application/toml',
    'application/x-httpd-php',
    'application/x-sh',
    'application/x-yaml',
    'application/xml',
    'application/yaml',
    'image/svg+xml',
]);

export function isEditableTextMedia(mime: string, extension?: string | null): boolean {
    const normalized = mime.split(';', 1)[0].trim().toLowerCase();
    const normalizedExtension = extension?.replace(/^\./, '').toLowerCase() ?? '';
    return normalized.startsWith('text/')
        || EDITABLE_APPLICATION_MIMES.has(normalized)
        || normalized.endsWith('+json')
        || normalized.endsWith('+xml')
        || EDITABLE_TEXT_EXTENSIONS.has(normalizedExtension);
}

export function mediaIcon(mime: string): string {
    if (mime.startsWith('image/')) return 'lucide:image';
    if (mime.startsWith('video/')) return 'lucide:film';
    if (mime.startsWith('audio/')) return 'lucide:music';
    if (mime === 'application/pdf') return 'mdi:file-pdf-box';
    if (isEditableTextMedia(mime)) return 'lucide:file-code-2';
    return 'lucide:file';
}

export function mediaIconColor(mime: string): string | undefined {
    return mime.toLowerCase() === 'application/pdf' ? '#ec1c24' : undefined;
}

export function formatMediaSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
