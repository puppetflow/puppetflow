/**
 * Puppeteer instances (ElementHandle, HTTPResponse, Page) cannot be serialized, so the runtime
 * records a plain summary object tagged with `$runtime` in the nodal preview. This module
 * recognizes these summaries in the editor so they are displayed as instances rather than
 * browsable JSON, and so expression previews behave like the runtime (no property access).
 */

export const RUNTIME_INSTANCE_KEY = '$runtime';

export type RuntimeInstanceKind = 'element' | 'handle' | 'httpResponse' | 'page';

const RUNTIME_INSTANCE_KINDS: ReadonlySet<string> = new Set<RuntimeInstanceKind>(['element', 'handle', 'httpResponse', 'page']);

export interface RuntimeInstanceSummary {
    [RUNTIME_INSTANCE_KEY]: RuntimeInstanceKind;
    [key: string]: unknown;
}

export const asRuntimeInstanceSummary = (value: unknown): RuntimeInstanceSummary | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const kind = (value as Record<string, unknown>)[RUNTIME_INSTANCE_KEY];
    return typeof kind === 'string' && RUNTIME_INSTANCE_KINDS.has(kind)
        ? value as RuntimeInstanceSummary
        : null;
};

export const runtimeInstanceTitle = (summary: RuntimeInstanceSummary): string => {
    switch (summary[RUNTIME_INSTANCE_KEY]) {
        case 'element': return 'Element';
        case 'handle': return 'JS Handle';
        case 'httpResponse': return 'HTTP Response';
        case 'page': return 'Page';
        default: return 'Instance';
    }
};

const asText = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

const elementSelectorLabel = (summary: RuntimeInstanceSummary): string => {
    const tag = asText(summary.tag);
    const id = asText(summary.id);
    const className = asText(summary.class);
    if (!tag) return asText(summary.description) ?? asText(summary.className) ?? 'element';

    const classes = className ? className.split(/\s+/).filter(Boolean).slice(0, 2) : [];
    return `${tag}${id ? `#${id}` : ''}${classes.map(item => `.${item}`).join('')}`;
};

export const runtimeInstanceLabel = (summary: RuntimeInstanceSummary): string => {
    switch (summary[RUNTIME_INSTANCE_KEY]) {
        case 'element': {
            const selector = elementSelectorLabel(summary);
            const text = asText(summary.text);
            const snippet = text ? ` "${text.length > 40 ? `${text.slice(0, 40)}…` : text}"` : '';
            return `${selector}${snippet}`;
        }
        case 'handle':
            return asText(summary.description) ?? asText(summary.className) ?? 'handle';
        case 'httpResponse': {
            const status = typeof summary.status === 'number' ? String(summary.status) : null;
            const url = asText(summary.url);
            return [status, url].filter(Boolean).join(' ') || 'response';
        }
        case 'page':
            return asText(summary.url) ?? 'page';
        default:
            return '';
    }
};

/** Summary entries worth showing as details (everything but the discriminator). */
export const runtimeInstanceDetails = (summary: RuntimeInstanceSummary): Array<[string, unknown]> => (
    Object.entries(summary).filter(([key]) => key !== RUNTIME_INSTANCE_KEY)
);

const previewSummaries = new WeakMap<RuntimeInstancePreview, RuntimeInstanceSummary>();

/**
 * Opaque stand-in used while evaluating expressions in the editor. It exposes no properties,
 * so `$run.$result.anything` resolves to `undefined` exactly like the real instance at runtime,
 * and it stringifies to a short readable marker.
 */
export class RuntimeInstancePreview {
    constructor(summary: RuntimeInstanceSummary) {
        previewSummaries.set(this, summary);
        Object.freeze(this);
    }

    toJSON(): string {
        return this.toString();
    }

    toString(): string {
        const summary = previewSummaries.get(this);
        return summary ? `[${runtimeInstanceTitle(summary)} ${runtimeInstanceLabel(summary)}]` : '[Instance]';
    }
}

export const isRuntimeInstancePreview = (value: unknown): value is RuntimeInstancePreview => (
    value instanceof RuntimeInstancePreview
);

export const runtimeInstancePreviewSummary = (value: RuntimeInstancePreview): RuntimeInstanceSummary | null => (
    previewSummaries.get(value) ?? null
);

const scopeValueCache = new WeakMap<object, unknown>();

/**
 * Deeply replaces runtime instance summaries with opaque previews. Results are cached per
 * source object, so repeated evaluations against the same preview data stay cheap.
 */
export const toExpressionScopeValue = (value: unknown): unknown => {
    if (!value || typeof value !== 'object') return value;
    if (isRuntimeInstancePreview(value)) return value;

    const summary = asRuntimeInstanceSummary(value);
    if (summary) {
        const cached = scopeValueCache.get(value);
        if (cached) return cached;
        const preview = new RuntimeInstancePreview(summary);
        scopeValueCache.set(value, preview);
        return preview;
    }

    const cached = scopeValueCache.get(value);
    if (cached) return cached;

    if (Array.isArray(value)) {
        let changed = false;
        const mapped = value.map(item => {
            const next = toExpressionScopeValue(item);
            if (next !== item) changed = true;
            return next;
        });
        const result = changed ? mapped : value;
        scopeValueCache.set(value, result);
        return result;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        // Dates, class instances and other exotic objects are left untouched.
        scopeValueCache.set(value, value);
        return value;
    }

    let changed = false;
    const mapped: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
        const next = toExpressionScopeValue(item);
        if (next !== item) changed = true;
        mapped[key] = next;
    }
    const result = changed ? mapped : value;
    scopeValueCache.set(value, result);
    return result;
};
