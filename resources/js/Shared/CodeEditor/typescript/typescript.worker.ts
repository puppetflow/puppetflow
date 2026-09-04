import * as Comlink from 'comlink';
import {
    createSystem,
    createVirtualTypeScriptEnvironment,
} from '@typescript/vfs';
import ts from 'typescript';
import type {
    TypeScriptDiagnostic,
    TypeScriptWorkerApi,
    TypeScriptWorkerRoot,
} from './types';
import { getResourceArgumentRule } from '../completion/resourceArgumentRules';

const libraryModules = import.meta.glob<string>(
    '../../../../../node_modules/typescript/lib/lib.*.d.ts',
    { eager: true, query: '?raw', import: 'default' },
);
const UNDEFINED_SYMBOL_CODES = new Set([2304, 2552]);
const RESOURCE_ARGUMENT_DIAGNOSTIC_CODE = 90001;

const flattenMessage = (message: string | ts.DiagnosticMessageChain): string => (
    typeof message === 'string'
        ? message
        : ts.flattenDiagnosticMessageText(message, ' ')
);

const displayParts = (parts: readonly ts.SymbolDisplayPart[] | undefined) => (
    ts.displayPartsToString(parts ? [...parts] : undefined)
);

const resolveStaticString = (
    expression: ts.Expression,
    checker: ts.TypeChecker,
    seen = new Set<ts.Symbol>(),
): string | null => {
    if (ts.isStringLiteralLike(expression)) return expression.text;
    if (ts.isParenthesizedExpression(expression)) {
        return resolveStaticString(expression.expression, checker, seen);
    }
    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const left = resolveStaticString(expression.left, checker, seen);
        const right = resolveStaticString(expression.right, checker, seen);
        return left === null || right === null ? null : left + right;
    }
    if (ts.isTemplateExpression(expression)) {
        let value = expression.head.text;
        for (const span of expression.templateSpans) {
            const part = resolveStaticString(span.expression, checker, seen);
            if (part === null) return null;
            value += part + span.literal.text;
        }
        return value;
    }
    if (!ts.isIdentifier(expression)) return null;

    const symbol = checker.getSymbolAtLocation(expression);
    if (!symbol || seen.has(symbol)) return null;
    const declaration = symbol.valueDeclaration;
    if (
        !declaration
        || !ts.isVariableDeclaration(declaration)
        || !declaration.initializer
        || !ts.isVariableDeclarationList(declaration.parent)
        || !(declaration.parent.flags & ts.NodeFlags.Const)
    ) {
        return null;
    }

    const nextSeen = new Set(seen);
    nextSeen.add(symbol);
    return resolveStaticString(declaration.initializer, checker, nextSeen);
};

const getResourceArgumentDiagnostics = (
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
): TypeScriptDiagnostic[] => {
    const diagnostics: TypeScriptDiagnostic[] = [];
    const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
            const helper = node.expression.text.replace(/^\$/, '');
            const rule = getResourceArgumentRule(helper);
            const argument = rule?.idPrefix
                ? node.arguments[rule.argumentIndex]
                : undefined;
            if (argument && rule?.idPrefix) {
                const value = resolveStaticString(argument, checker);
                const expectedPrefix = `${rule.idPrefix}_`;
                if (value !== null && !value.startsWith(expectedPrefix)) {
                    diagnostics.push({
                        from: argument.getStart(sourceFile),
                        to: argument.getEnd(),
                        severity: 'error',
                        message: `Expected a resource ID starting with "${expectedPrefix}".`,
                        code: RESOURCE_ARGUMENT_DIAGNOSTIC_CODE,
                        source: 'Puppetflow',
                    });
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return diagnostics;
};

const collectDeclaredNames = (code: string) => {
    const names = new Set<string>();
    const source = ts.createSourceFile('/flow.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const collectBindingName = (name: ts.BindingName) => {
        if (ts.isIdentifier(name)) {
            names.add(name.text);
            return;
        }
        name.elements.forEach(element => {
            if (!ts.isOmittedExpression(element)) collectBindingName(element.name);
        });
    };
    const visit = (node: ts.Node) => {
        if (
            ts.isVariableDeclaration(node)
            || ts.isParameter(node)
            || ts.isBindingElement(node)
        ) {
            collectBindingName(node.name);
        } else if (
            (ts.isFunctionDeclaration(node)
                || ts.isClassDeclaration(node)
                || ts.isFunctionExpression(node))
            && node.name
        ) {
            names.add(node.name.text);
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return names;
};

function createService(initialCode: string, initialExtraLibs: Record<string, string>): TypeScriptWorkerApi {
    const codeFile = '/flow.js';
    const pageCompletionFile = '/puppetflow-page-completion.js';
    const clientCompletionFile = '/puppetflow-client-completion.js';
    const pageCompletionCode = '$page.';
    const clientCompletionCode = '$client.';
    const files = new Map<string, string>();
    let currentCode = initialCode;
    let localNames = collectDeclaredNames(initialCode);

    Object.entries(libraryModules).forEach(([path, content]) => {
        files.set(`/${path.split('/').pop()}`, content);
    });
    Object.entries(initialExtraLibs).forEach(([path, content]) => {
        files.set(path, content || '\n');
    });
    files.set(codeFile, initialCode);
    files.set(pageCompletionFile, pageCompletionCode);
    files.set(clientCompletionFile, clientCompletionCode);
    const compilerOptions = {
        allowJs: true,
        checkJs: true,
        noEmit: true,
        target: ts.ScriptTarget.ES2023,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    };
    const environment = createVirtualTypeScriptEnvironment(
        createSystem(files),
        [codeFile, pageCompletionFile, clientCompletionFile, ...Object.keys(initialExtraLibs)],
        ts,
        compilerOptions,
    );
    const service = environment.languageService;
    const completionLocation = (position: number) => {
        const prefix = currentCode.slice(0, position);
        if (/\$page\.[\w$]*$/.test(prefix)) {
            return { file: pageCompletionFile, position: pageCompletionCode.length };
        }
        if (/\$client\.[\w$]*$/.test(prefix)) {
            return { file: clientCompletionFile, position: clientCompletionCode.length };
        }
        return { file: codeFile, position };
    };

    return {
        updateCode(code) {
            currentCode = code;
            localNames = collectDeclaredNames(code);
            environment.updateFile(codeFile, code);
        },
        updateExtraLibs(extraLibs) {
            Object.keys(initialExtraLibs).forEach(path => environment.deleteFile(path));
            initialExtraLibs = extraLibs;
            Object.entries(extraLibs).forEach(([path, content]) => {
                environment.createFile(path, content || '\n');
            });
            service.cleanupSemanticCache();
        },
        getCompletions(position) {
            const location = completionLocation(position);
            const result = service.getCompletionsAtPosition(location.file, location.position, {
                includeCompletionsForModuleExports: false,
                includeCompletionsWithInsertText: true,
            });
            return result?.entries.map(entry => ({
                label: entry.name,
                kind: entry.kind,
                sortText: entry.sortText,
                source: entry.source,
                insertText: entry.insertText,
                local: location.file === codeFile && localNames.has(entry.name),
                replacementSpan: location.file === codeFile ? entry.replacementSpan : undefined,
            })) ?? [];
        },
        getCompletionDetails(position, name, source) {
            const location = completionLocation(position);
            const detail = service.getCompletionEntryDetails(
                location.file,
                location.position,
                name,
                undefined,
                source,
                undefined,
                undefined,
            );
            if (!detail) return null;
            return {
                name: detail.name,
                kind: detail.kind,
                display: displayParts(detail.displayParts),
                documentation: displayParts(detail.documentation),
            };
        },
        getDiagnostics() {
            const syntacticDiagnostics = service.getSyntacticDiagnostics(codeFile);
            const semanticDiagnostics = service.getSemanticDiagnostics(codeFile)
                .filter(diagnostic => (
                    UNDEFINED_SYMBOL_CODES.has(diagnostic.code)
                    && diagnostic.start != null
                ));

            const typeScriptDiagnostics = [...syntacticDiagnostics, ...semanticDiagnostics]
                .filter(diagnostic => diagnostic.start != null)
                .map((diagnostic): TypeScriptDiagnostic => ({
                    from: diagnostic.start ?? 0,
                    to: (diagnostic.start ?? 0) + Math.max(1, diagnostic.length ?? 1),
                    severity: diagnostic.category === ts.DiagnosticCategory.Warning ? 'warning' : 'error',
                    message: flattenMessage(diagnostic.messageText),
                    code: diagnostic.code,
                }));
            const program = service.getProgram();
            const sourceFile = program?.getSourceFile(codeFile);
            const resourceDiagnostics = program && sourceFile
                ? getResourceArgumentDiagnostics(sourceFile, program.getTypeChecker())
                : [];
            return [...typeScriptDiagnostics, ...resourceDiagnostics];
        },
        getHover(position) {
            const info = service.getQuickInfoAtPosition(codeFile, position);
            if (!info) return null;
            return {
                from: info.textSpan.start,
                to: info.textSpan.start + info.textSpan.length,
                display: displayParts(info.displayParts),
                documentation: displayParts(info.documentation),
                tags: (info.tags ?? []).map(tag => ({
                    name: tag.name,
                    text: displayParts(tag.text),
                })),
            };
        },
        getFormattingEdits() {
            return service.getFormattingEditsForDocument(codeFile, {
                indentSize: 4,
                tabSize: 4,
                convertTabsToSpaces: true,
                newLineCharacter: '\n',
                insertSpaceAfterCommaDelimiter: true,
                insertSpaceAfterSemicolonInForStatements: true,
                insertSpaceBeforeAndAfterBinaryOperators: true,
                insertSpaceAfterKeywordsInControlFlowStatements: true,
                insertSpaceAfterFunctionKeywordForAnonymousFunctions: true,
                insertSpaceBeforeFunctionParenthesis: false,
                placeOpenBraceOnNewLineForFunctions: false,
                placeOpenBraceOnNewLineForControlBlocks: false,
            }).map(edit => ({
                from: edit.span.start,
                to: edit.span.start + edit.span.length,
                insert: edit.newText,
            }));
        },
    };
}

const root: TypeScriptWorkerRoot = {
    create(code, extraLibs) {
        return Comlink.proxy(createService(code, extraLibs));
    },
};

Comlink.expose(root);
