import type { OnMount } from '@monaco-editor/react';
import { parse } from 'acorn';
import { matchesCompletionModelUri } from './completionCore';

interface NamedResourceCompletionOptions {
    declarationHelper: string;
    helperNames: string[];
    creationHelper: string;
    defaultName: string;
    knownNames: string[];
    createDetail: string;
    existingDetail: string;
    documentationLabel: string;
}

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

const patternDeclaresIdentifier = (value: unknown, identifier: string): boolean => {
    if (!value || typeof value !== 'object') return false;
    const pattern = value as Record<string, unknown>;
    if (pattern.type === 'Identifier') return pattern.name === identifier;
    if (pattern.type === 'RestElement') return patternDeclaresIdentifier(pattern.argument, identifier);
    if (pattern.type === 'AssignmentPattern') return patternDeclaresIdentifier(pattern.left, identifier);
    if (pattern.type === 'ArrayPattern') {
        return (pattern.elements as unknown[] | undefined)
            ?.some(item => patternDeclaresIdentifier(item, identifier)) ?? false;
    }
    if (pattern.type === 'ObjectPattern') {
        return (pattern.properties as Array<Record<string, unknown>> | undefined)?.some(property => (
            patternDeclaresIdentifier(property.value ?? property.argument, identifier)
        )) ?? false;
    }
    return false;
};

const literalString = (value: Record<string, unknown> | undefined) => {
    if (value?.type === 'Literal' && typeof value.value === 'string') {
        return value.value.trim() || null;
    }
    if (value?.type !== 'TemplateLiteral') return null;

    const expressions = value.expressions as unknown[] | undefined;
    const quasi = (value.quasis as Array<Record<string, unknown>> | undefined)?.[0];
    const cooked = (quasi?.value as Record<string, unknown> | undefined)?.cooked;
    return expressions?.length === 0 && typeof cooked === 'string'
        ? cooked.trim() || null
        : null;
};

export function collectNamedResourcesFromCode(
    source: string,
    declarationHelper: string,
    defaultName: string,
): string[] {
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
            (node.type === 'VariableDeclarator' && patternDeclaresIdentifier(node.id, declarationHelper))
            || (
                ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(String(node.type))
                && (
                    patternDeclaresIdentifier(node.id, declarationHelper)
                    || (node.params as unknown[] | undefined)
                        ?.some(item => patternDeclaresIdentifier(item, declarationHelper))
                )
            )
            || (
                String(node.type).startsWith('Import')
                && patternDeclaresIdentifier(node.local, declarationHelper)
            )
            || (
                node.type === 'CatchClause'
                && patternDeclaresIdentifier(node.param, declarationHelper)
            )
        ) {
            helperIsShadowed = true;
        }

        const callee = node.callee as Record<string, unknown> | undefined;
        if (
            node.type === 'CallExpression'
            && callee?.type === 'Identifier'
            && callee.name === declarationHelper
        ) {
            const argument = (node.arguments as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
            const name = argument ? literalString(argument) : defaultName;
            if (name) names.add(name);
        }

        Object.values(node).forEach(visit);
    };

    visit(ast);
    return helperIsShadowed ? [] : [...names];
}

const escapeStringContent = (value: string, quote: string) => {
    const escaped = value
        .replace(/\\/g, '\\\\')
        .split(quote)
        .join(`\\${quote}`);
    return quote === '`' ? escaped.replace(/\$\{/g, '\\${') : escaped;
};

export function registerNamedResourceCompletions(
    monaco: Parameters<OnMount>[1],
    modelUri: string | null | undefined,
    options: NamedResourceCompletionOptions,
) {
    if (!monaco) return { dispose: () => {} };

    const helpersPattern = options.helperNames.join('|');
    const contextPattern = new RegExp(`\\$(${helpersPattern})\\s*\\(\\s*(["'\`])([^"'\`]*)$`);

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
            const context = source.match(contextPattern);
            if (!context) return { suggestions: [] };

            const helper = context[1];
            const quote = context[2] ?? '"';
            const typed = context[3] ?? '';
            const names = [...new Set([
                ...(helper === options.creationHelper ? [options.defaultName] : []),
                ...options.knownNames,
                ...collectNamedResourcesFromCode(
                    model.getValue(),
                    options.declarationHelper,
                    options.defaultName,
                ),
            ])];
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column - typed.length,
                endColumn: position.column,
            };

            return {
                suggestions: names.map(name => ({
                    label: name,
                    kind: monaco.languages.CompletionItemKind.Value,
                    insertText: escapeStringContent(name, quote),
                    detail: helper === options.creationHelper
                        ? options.createDetail
                        : options.existingDetail,
                    documentation: `${options.documentationLabel}: ${name}`,
                    range,
                    sortText: name === options.defaultName ? `0-${name}` : `1-${name}`,
                })),
            };
        },
    });
}
