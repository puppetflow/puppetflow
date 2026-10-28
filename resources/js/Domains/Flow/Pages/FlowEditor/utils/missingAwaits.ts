import { parse } from 'acorn';
import { ASYNC_HELPER_NAMES } from './helpCatalog';

export interface MissingAwaitCall {
    name: string;
    start: number;
    lineNumber: number;
}

interface SyntaxNode {
    type: string;
    start: number;
    end: number;
    async?: boolean;
    name?: string;
    body?: SyntaxNode;
    callee?: SyntaxNode;
    argument?: SyntaxNode;
    arguments?: SyntaxNode[];
    elements?: Array<SyntaxNode | null>;
    id?: SyntaxNode;
    init?: SyntaxNode;
    left?: SyntaxNode;
    right?: SyntaxNode;
    object?: SyntaxNode;
    property?: SyntaxNode;
    operator?: string;
    loc?: { start: { line: number } };
    [key: string]: unknown;
}

const FUNCTION_NODE_TYPES = new Set([
    'ArrowFunctionExpression',
    'FunctionDeclaration',
    'FunctionExpression',
]);

function isHandledPromise(ancestors: SyntaxNode[]): boolean {
    for (let index = ancestors.length - 1; index >= 0; index -= 1) {
        const ancestor = ancestors[index];
        if (ancestor.type === 'AwaitExpression' || ancestor.type === 'ReturnStatement') {
            return true;
        }
        if (ancestor.type === 'UnaryExpression' && ancestor.operator === 'void') {
            return true;
        }
        if (!FUNCTION_NODE_TYPES.has(ancestor.type)) continue;

        return ancestor.type === 'ArrowFunctionExpression'
            && ancestor.body?.type !== 'BlockStatement';
    }

    return false;
}

function isInsideNonAsyncFunction(ancestors: SyntaxNode[]): boolean {
    for (let index = ancestors.length - 1; index >= 0; index -= 1) {
        const ancestor = ancestors[index];
        if (FUNCTION_NODE_TYPES.has(ancestor.type)) return ancestor.async !== true;
    }

    return false;
}

function getFunctionScopeStart(ancestors: SyntaxNode[]): number {
    for (let index = ancestors.length - 1; index >= 0; index -= 1) {
        if (FUNCTION_NODE_TYPES.has(ancestors[index].type)) return ancestors[index].start;
    }

    return 0;
}

function getBindingKey(name: string, ancestors: SyntaxNode[]): string {
    return `${getFunctionScopeStart(ancestors)}:${name}`;
}

function getCallBindingKey(node: SyntaxNode, ancestors: SyntaxNode[]): string | null {
    const parent = ancestors.at(-1);
    if (
        parent?.type === 'VariableDeclarator'
        && parent.init === node
        && parent.id?.type === 'Identifier'
        && parent.id.name
    ) {
        return getBindingKey(parent.id.name, ancestors);
    }
    if (
        parent?.type === 'AssignmentExpression'
        && parent.right === node
        && parent.left?.type === 'Identifier'
        && parent.left.name
    ) {
        return getBindingKey(parent.left.name, ancestors);
    }

    return null;
}

const PROMISE_COMBINATORS = new Set(['all', 'allSettled', 'any', 'race']);

function getHandledBindingNames(expression?: SyntaxNode): string[] {
    if (!expression) return [];
    if (expression.type === 'Identifier' && expression.name) return [expression.name];
    if (expression.type === 'ArrayExpression') {
        return (expression.elements ?? []).flatMap(element => getHandledBindingNames(element ?? undefined));
    }
    if (
        expression.type === 'CallExpression'
        && expression.callee?.type === 'MemberExpression'
        && expression.callee.object?.type === 'Identifier'
        && expression.callee.object.name === 'Promise'
        && expression.callee.property?.type === 'Identifier'
        && expression.callee.property.name
        && PROMISE_COMBINATORS.has(expression.callee.property.name)
    ) {
        return (expression.arguments ?? []).flatMap(argument => getHandledBindingNames(argument));
    }

    return [];
}

function walkSyntax(
    value: unknown,
    ancestors: SyntaxNode[],
    visit: (node: SyntaxNode, ancestors: SyntaxNode[]) => void,
) {
    if (!value || typeof value !== 'object') return;

    const node = value as Partial<SyntaxNode>;
    if (typeof node.type !== 'string' || typeof node.start !== 'number' || typeof node.end !== 'number') {
        return;
    }

    const syntaxNode = node as SyntaxNode;
    visit(syntaxNode, ancestors);
    const nextAncestors = [...ancestors, syntaxNode];

    Object.entries(syntaxNode).forEach(([key, child]) => {
        if (['loc', 'start', 'end'].includes(key)) return;
        if (Array.isArray(child)) {
            child.forEach(item => walkSyntax(item, nextAncestors, visit));
        } else {
            walkSyntax(child, nextAncestors, visit);
        }
    });
}

export function getMissingAwaitCalls(code: string): MissingAwaitCall[] {
    try {
        const ast = parse(code, {
            ecmaVersion: 'latest',
            sourceType: 'script',
            locations: true,
            allowAwaitOutsideFunction: true,
        }) as unknown as SyntaxNode;
        const calls: MissingAwaitCall[] = [];
        const callBindings = new Map<number, string>();
        const handledBindings = new Set<string>();

        walkSyntax(ast, [], (node, ancestors) => {
            if (node.type !== 'CallExpression') return;
            const callee = node.callee;
            const name = callee?.type === 'Identifier' ? callee.name : undefined;
            if (!name || !ASYNC_HELPER_NAMES.has(name)) return;

            const binding = getCallBindingKey(node, ancestors);
            if (binding) callBindings.set(node.start, binding);
        });

        walkSyntax(ast, [], (node, ancestors) => {
            if (node.type !== 'AwaitExpression' && node.type !== 'ReturnStatement') return;
            getHandledBindingNames(node.argument).forEach(name => {
                handledBindings.add(getBindingKey(name, ancestors));
            });
        });

        walkSyntax(ast, [], (node, ancestors) => {
            if (node.type !== 'CallExpression') return;

            const callee = node.callee;
            const name = callee?.type === 'Identifier' ? callee.name : undefined;
            if (!name || !ASYNC_HELPER_NAMES.has(name)) return;
            if (isHandledPromise(ancestors) || isInsideNonAsyncFunction(ancestors)) return;
            const binding = callBindings.get(node.start);
            if (binding && handledBindings.has(binding)) return;

            calls.push({
                name,
                start: node.start,
                lineNumber: node.loc?.start.line ?? 1,
            });
        });

        return calls;
    } catch {
        return [];
    }
}
