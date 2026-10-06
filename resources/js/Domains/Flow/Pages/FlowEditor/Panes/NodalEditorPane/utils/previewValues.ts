const isRecord = (value: unknown): value is Record<string, unknown> => {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

export const normalizePreviewPath = (path: string) => path.trim()
    .replace(/^\$(?:input|run|output|nodes)\./, '')
    .replace(/^\./, '');

export const setPreviewPathValue = (
    target: Record<string, unknown>,
    path: string,
    value: unknown,
) => {
    const segments = normalizePreviewPath(path).split('.').filter(Boolean);
    if (
        segments.length === 0
        || segments.some(segment => ['__proto__', 'prototype', 'constructor'].includes(segment))
    ) return;

    let cursor = target;
    segments.forEach((segment, index) => {
        if (index === segments.length - 1) {
            cursor[segment] = value;
            return;
        }

        if (
            !Object.prototype.hasOwnProperty.call(cursor, segment)
            || !isRecord(cursor[segment])
        ) cursor[segment] = Object.create(null);
        cursor = cursor[segment] as Record<string, unknown>;
    });
};

export const parseFixedPreviewValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (trimmed === 'undefined') return undefined;

    if (/^[{["']/.test(trimmed)) {
        try {
            return JSON.parse(trimmed);
        } catch {
            return trimmed.replace(/^(['"])([\s\S]*)\1$/, '$2');
        }
    }

    return trimmed;
};

export const parseLiteralPreviewValue = (value: string) => {
    const trimmed = value.trim();
    if (!/^[{[]/.test(trimmed)) return undefined;

    try {
        return JSON.parse(trimmed);
    } catch {
        try {
            return Function(`"use strict"; return (${trimmed});`)();
        } catch {
            return undefined;
        }
    }
};

export const coerceJsonPreviewValue = (
    value: unknown,
    seen = new WeakMap<object, unknown>(),
): unknown => {
    if (value && typeof value === 'object') {
        const prototype = Object.getPrototypeOf(value);
        const isPlainObject = prototype === null
            || (Object.getPrototypeOf(prototype) === null && prototype.constructor?.name === 'Object');
        if (!Array.isArray(value) && !isPlainObject) return value;
        const cached = seen.get(value);
        if (cached !== undefined) return cached;
        const clone: unknown[] | Record<PropertyKey, unknown> = Array.isArray(value)
            ? new Array(value.length)
            : Object.create(prototype);
        seen.set(value, clone);
        for (const key of Reflect.ownKeys(value)) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor?.enumerable) continue;
            if ('value' in descriptor) descriptor.value = coerceJsonPreviewValue(descriptor.value, seen);
            Object.defineProperty(clone, key, descriptor);
        }
        return clone;
    }
    if (typeof value !== 'string') return value;

    const trimmed = value.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    const parsedLiteral = parseLiteralPreviewValue(trimmed);
    return parsedLiteral === undefined ? value : coerceJsonPreviewValue(parsedLiteral, seen);
};
