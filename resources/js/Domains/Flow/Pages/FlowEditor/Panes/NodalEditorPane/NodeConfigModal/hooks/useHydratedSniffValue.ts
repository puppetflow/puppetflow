import { useEffect, useMemo, useState } from 'react';

interface SniffBodyReference {
    captureId: string;
    contentJsonAvailable: boolean;
}

interface SniffBody {
    content: string;
    contentJson: unknown;
}

// `null` marks a body that could not be loaded so the value stops waiting for it.
type Bodies = ReadonlyMap<string, SniffBody | null>;

const bodyCache = new Map<string, Promise<SniffBody>>();
const MAX_CACHED_BODIES = 8;

const referenceFor = (value: unknown): SniffBodyReference | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const reference = (value as Record<string, unknown>).reference;
    if (!reference || typeof reference !== 'object') return null;
    const { captureId, contentJsonAvailable } = reference as Record<string, unknown>;

    return typeof captureId === 'string'
        ? { captureId, contentJsonAvailable: contentJsonAvailable === true }
        : null;
};

const collectReferences = (value: unknown, references: Map<string, SniffBodyReference>) => {
    const reference = referenceFor(value);
    if (reference) references.set(reference.captureId, reference);
    if (Array.isArray(value)) value.forEach(item => collectReferences(item, references));
    else if (value && typeof value === 'object') Object.values(value).forEach(item => collectReferences(item, references));
};

// Replaces hydrated references by their body; untouched branches keep their identity.
const hydrate = (value: unknown, bodies: Bodies): unknown => {
    const reference = referenceFor(value);
    if (reference) {
        const body = bodies.get(reference.captureId);
        if (!body) return value;
        // Body fields (content, contentJson) replace the reference; the metadata stays.
        const { reference: _reference, ...metadata } = value as Record<string, unknown>;
        return { ...metadata, ...body };
    }
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
        const items = value.map(item => hydrate(item, bodies));
        return items.some((item, index) => item !== value[index]) ? items : value;
    }
    const entries = Object.entries(value).map(([key, item]) => [key, hydrate(item, bodies)] as const);
    return entries.some(([key, item]) => item !== (value as Record<string, unknown>)[key])
        ? Object.fromEntries(entries)
        : value;
};

// The server returns the raw body; JSON is parsed here so PHP never decodes multi-megabyte payloads.
const loadBody = (flowId: Id, runId: Id, { captureId, contentJsonAvailable }: SniffBodyReference) => {
    const key = `${flowId}:${runId}:${captureId}`;
    let request = bodyCache.get(key);
    if (!request) {
        request = fetch(`/flows/${encodeURIComponent(String(flowId))}/runs/${runId}/sniff-bodies/${captureId}`)
            .then(async (response): Promise<SniffBody> => {
                if (!response.ok) throw new Error('Sniff body could not be loaded.');
                const content = await response.text();
                return { content, contentJson: contentJsonAvailable ? JSON.parse(content) : null };
            });
        request.catch(() => bodyCache.delete(key));
        bodyCache.set(key, request);
        if (bodyCache.size > MAX_CACHED_BODIES) bodyCache.delete(bodyCache.keys().next().value as string);
    }

    return request;
};

/**
 * Hydrates network capture references found in `value` with their stored bodies.
 * Pass only the values actually displayed: every distinct reference costs one request.
 * `loading` stays true while at least one referenced body is still missing.
 */
export default function useHydratedSniffValue<T>(value: T, flowId: Id | undefined, runId: Id | undefined) {
    const [bodies, setBodies] = useState<Bodies>(new Map());
    // A re-rendered value with the same capture ids keeps the same key, so nothing refetches.
    const referenceKey = useMemo(() => {
        const found = new Map<string, SniffBodyReference>();
        collectReferences(value, found);
        return [...found.values()].map(r => `${r.captureId}:${r.contentJsonAvailable ? 'json' : 'text'}`).sort().join('|');
    }, [value]);
    const references = useMemo((): SniffBodyReference[] => referenceKey === '' ? [] : referenceKey.split('|').map(entry => {
        const [captureId, mode] = entry.split(':');
        return { captureId, contentJsonAvailable: mode === 'json' };
    }), [referenceKey]);

    useEffect(() => {
        if (!flowId || !runId) return;

        let active = true;
        // Each body is applied as soon as it arrives so the fastest captures render first.
        references.forEach(reference => {
            void loadBody(flowId, runId, reference)
                .catch(() => null)
                .then(body => {
                    if (active) setBodies(current => new Map(current).set(reference.captureId, body));
                });
        });

        return () => {
            active = false;
        };
    }, [references, flowId, runId]);

    return useMemo(() => ({
        value: hydrate(value, bodies) as T,
        loading: references.some(({ captureId }) => !bodies.has(captureId)),
    }), [bodies, references, value]);
}
