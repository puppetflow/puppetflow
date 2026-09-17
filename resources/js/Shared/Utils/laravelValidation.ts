export type LaravelValidationErrors = Record<string, string | string[]>;

export function normalizeLaravelValidationErrors(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    return Object.entries(value as LaravelValidationErrors).reduce<Record<string, string>>(
        (errors, [key, error]) => {
            const message = Array.isArray(error) ? error.find(item => typeof item === 'string') : error;
            if (typeof message === 'string') errors[key] = message;
            return errors;
        },
        {},
    );
}

/** The first message carried by a Laravel error payload ({ message, errors }), if any. */
export function laravelErrorMessage(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const { message, errors } = payload as { message?: unknown; errors?: unknown };

    return Object.values(normalizeLaravelValidationErrors(errors))[0]
        ?? (typeof message === 'string' && message.trim() !== '' ? message : null);
}
