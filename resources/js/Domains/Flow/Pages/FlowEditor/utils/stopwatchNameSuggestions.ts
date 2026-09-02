import type { OnMount } from '@monaco-editor/react';
import { parse } from 'acorn';
import { matchesCompletionModelUri } from './completionCore';

export const DEFAULT_STOPWATCH_NAME = 'default';

const parseCode = (source: string): Record<string, unknown> | null => {
    const options = {
        ecmaVersion: 'latest' as const,
        sourceType: 'module' as const,
        allowAwaitOutsideFunction: true,
        allowReturnOutsideFunction: true,
    };

    try {
        return parse(source, options) as unknown as Record<string, unknown>;
    } catch {
        try {
            return parse(
                `async function __puppetflowCodeNode() {\nfor (;;) {\n${source}\n}\n}`,
                options,
            ) as unknown as Record<string, unknown>;
        } catch {
            return null;
        }
    }
};

const patternDeclaresStopwatchStart = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false;
    const pattern = value as Record<string, unknown>;
    if (pattern.type === 'Identifier') return pattern.name === '$stopwatchStart';
    if (pattern.type === 'RestElement') return patternDeclaresStopwatchStart(pattern.argument);
    if (pattern.type === 'AssignmentPattern') return patternDeclaresStopwatchStart(pattern.left);
    if (pattern.type === 'ArrayPattern') {
        return (pattern.elements as unknown[] | undefined)?.some(patternDeclaresStopwatchStart) ?? false;
    }
    if (pattern.type === 'ObjectPattern') {
        return (pattern.properties as Array<Record<string, unknown>> | undefined)?.some(property => (
            patternDeclaresStopwatchStart(property.value ?? property.argument)
        )) ?? false;
    }
    return false;
};

export function collectNamedStopwatchesFromCode(source: string): string[] {
    const ast = parseCode(source);
    if (!ast) return [];

    let helperIsShadowed = false;
    const names = new Set<string>();
    const visit = (value: unknown) => {
        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }
        if (!value || typeof value !== 'object') return;

        const node = value as Record<string, unknown>;
        if (
            (node.type === 'VariableDeclarator' && patternDeclaresStopwatchStart(node.id))
            || (
                ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(String(node.type))
                && (
                    patternDeclaresStopwatchStart(node.id)
                    || (node.params as unknown[] | undefined)?.some(patternDeclaresStopwatchStart)
                )
            )
            || (
                String(node.type).startsWith('Import')
                && patternDeclaresStopwatchStart(node.local)
            )
            || (node.type === 'CatchClause' && patternDeclaresStopwatchStart(node.param))
        ) {
            helperIsShadowed = true;
        }

        const callee = node.callee as Record<string, unknown> | undefined;
        if (
            node.type === 'CallExpression'
            && callee?.type === 'Identifier'
            && callee.name === '$stopwatchStart'
        ) {
            const argument = (node.arguments as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
            if (!argument) {
                names.add(DEFAULT_STOPWATCH_NAME);
            } else if (argument.type === 'Literal' && typeof argument.value === 'string') {
                const name = argument.value.trim();
                if (name) names.add(name);
            } else if (argument.type === 'TemplateLiteral') {
                const expressions = argument.expressions as unknown[] | undefined;
                const quasi = (argument.quasis as Array<Record<string, unknown>> | undefined)?.[0];
                const cooked = (quasi?.value as Record<string, unknown> | undefined)?.cooked;
                if (expressions?.length === 0 && typeof cooked === 'string' && cooked.trim()) {
                    names.add(cooked.trim());
                }
            }
        }

        Object.values(node).forEach(visit);
    };

    visit(ast);
    return helperIsShadowed ? [] : [...names];
}

const getCompletionContext = (source: string) => {
    const match = source.match(/\$(stopwatchStart|stopwatchStop|stopwatchCheck)\s*\(\s*(["'`])([^"'`]*)$/);
    if (!match) return null;

    return {
        helper: match[1],
        typed: match[3],
    };
};

export function registerStopwatchNameCompletions(
    monaco: Parameters<OnMount>[1],
    modelUri?: string | null,
    knownNames: string[] = [],
) {
    if (!monaco) return { dispose: () => {} };

    return monaco.languages.registerCompletionItemProvider('javascript', {
        triggerCharacters: ['"', "'", '`'],
        provideCompletionItems: (model, position) => {
            if (!matchesCompletionModelUri(model, modelUri)) return { suggestions: [] };

            const source = model.getValueInRange({
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
            });
            const context = getCompletionContext(source);
            if (!context) return { suggestions: [] };

            const names = [...new Set([
                ...(context.helper === 'stopwatchStart' ? [DEFAULT_STOPWATCH_NAME] : []),
                ...knownNames,
                ...collectNamedStopwatchesFromCode(model.getValue()),
            ])];
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column - context.typed.length,
                endColumn: position.column,
            };

            return {
                suggestions: names.map(name => ({
                    label: name,
                    kind: monaco.languages.CompletionItemKind.Value,
                    insertText: name,
                    detail: context.helper === 'stopwatchStart'
                        ? 'Named stopwatch'
                        : 'Existing stopwatch',
                    documentation: `Stopwatch: ${name}`,
                    range,
                    sortText: name === DEFAULT_STOPWATCH_NAME ? `0-${name}` : `1-${name}`,
                })),
            };
        },
    });
}
