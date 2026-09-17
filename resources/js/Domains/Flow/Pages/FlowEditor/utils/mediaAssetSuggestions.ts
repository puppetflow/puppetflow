import { useEffect, useState } from 'react';
import type { OnMount } from '@monaco-editor/react';
import { mediaIcon, mediaIconColor } from '@/Domains/Media/types';
import { getVisibilityMeta } from '@/Shared/Utils/visibility';
import type { QuickRequirementCreate } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/contexts/QuickRequirementCreationContext';
import {
    completionRange,
    idCompletionItem,
    matchesCompletionModelUri,
    type CompletionModel,
    type CompletionPosition,
} from './completionCore';

export type MediaAssetSuggestion = {
    id: Id;
    name: string;
    original_filename: string;
    mime_type: string;
    thumbnail_url: string | null;
    visibility: string;
    team_name?: string | null;
};

let cachedSuggestions: MediaAssetSuggestion[] | null = null;
let pendingRequest: Promise<MediaAssetSuggestion[]> | null = null;
let requestGeneration = 0;
/** Mounted consumers notified whenever the cache is refreshed (e.g. after an upload). */
const subscribers = new Set<(suggestions: MediaAssetSuggestion[]) => void>();
const UPLOAD_MEDIA_ARGUMENT_PATTERN = /\$upload\(.*,\s*(["'])([^"']*)$/;

export function fetchMediaAssetSuggestions(force = false): Promise<MediaAssetSuggestion[]> {
    if (!force && cachedSuggestions) return Promise.resolve(cachedSuggestions);
    if (!force && pendingRequest) return pendingRequest;

    const generation = ++requestGeneration;
    const request = fetch('/media-library/suggestions', { cache: 'no-store' })
        .then(response => {
            if (!response.ok) throw new Error('Unable to load media assets.');
            return response.json();
        })
        .then(payload => {
            const suggestions: MediaAssetSuggestion[] = Array.isArray(payload) ? payload : [];
            if (generation === requestGeneration) {
                cachedSuggestions = suggestions;
                subscribers.forEach(notify => notify(suggestions));
            }
            return suggestions;
        })
        .catch(() => cachedSuggestions ?? [])
        .finally(() => {
            if (pendingRequest === request) pendingRequest = null;
        });
    pendingRequest = request;

    return request;
}

/** Loads the cached suggestion list once the consumer needs it and follows later refreshes. */
export function useMediaAssetSuggestions(enabled: boolean): MediaAssetSuggestion[] {
    const [assets, setAssets] = useState<MediaAssetSuggestion[]>([]);

    useEffect(() => {
        if (!enabled) return;
        subscribers.add(setAssets);
        void fetchMediaAssetSuggestions().then(list => {
            if (subscribers.has(setAssets)) setAssets(list);
        });
        return () => {
            subscribers.delete(setAssets);
        };
    }, [enabled]);

    return assets;
}

/** "+ Add a media" dropdown action: uploads through the quick creation modal, then selects the new asset. */
export function addMediaAction(
    create: QuickRequirementCreate,
    refresh: () => Promise<unknown> = () => fetchMediaAssetSuggestions(true),
) {
    return {
        label: '+ Add a media',
        onAction: async () => {
            const asset = await create('media');
            if (!asset) return null;
            await refresh();
            return String(asset.id);
        },
    };
}

export function browseMediaAction(
    create: QuickRequirementCreate,
): () => Promise<string | null> {
    return async () => {
        const asset = await create('media-picker');
        if (asset) await fetchMediaAssetSuggestions(true);
        return asset ? String(asset.id) : null;
    };
}

/** Dropdown option matching the Media Library sidebar (type icon or thumbnail, visibility detail). */
export function mediaAssetOption(asset: MediaAssetSuggestion) {
    const visibility = getVisibilityMeta(asset.visibility, asset.team_name);

    return {
        value: String(asset.id),
        label: asset.name,
        detail: visibility ? `${visibility.label} - ${asset.mime_type}` : asset.mime_type,
        detailIcon: visibility?.icon,
        icon: mediaIcon(asset.mime_type),
        iconColor: mediaIconColor(asset.mime_type),
        iconUrl: asset.thumbnail_url,
    };
}

export function registerMediaAssetCompletions(
    monaco: Parameters<OnMount>[1],
    modelUri?: string | null,
) {
    if (!monaco) return { dispose: () => {} };

    return monaco.languages.registerCompletionItemProvider('javascript', {
        triggerCharacters: ['"', "'"],
        provideCompletionItems: async (model: CompletionModel, position: CompletionPosition) => {
            if (!matchesCompletionModelUri(model, modelUri)) return { suggestions: [] };

            const textBefore = model.getLineContent(position.lineNumber).substring(0, position.column - 1);
            const match = textBefore.match(UPLOAD_MEDIA_ARGUMENT_PATTERN);
            if (!match) return { suggestions: [] };

            const typed = match[2] ?? '';
            const assets = await fetchMediaAssetSuggestions();

            return {
                suggestions: assets.map(asset => idCompletionItem(asset, {
                    // Editors hide the File kind (suggest.showFiles: false); Value matches the other resource providers.
                    kind: monaco.languages.CompletionItemKind.Value,
                    detail: `${asset.mime_type} - ${asset.id}`,
                    documentation: [
                        `Media: ${asset.name}`,
                        `Original filename: ${asset.original_filename}`,
                        `Visibility: ${asset.visibility}`,
                    ].join('\n\n'),
                    range: completionRange(position, typed),
                })),
            };
        },
    });
}
