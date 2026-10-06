import { parse } from 'acorn';

export interface CodeSyntaxIssue {
    message: string;
    line: number;
    column: number;
}

type AcornSyntaxError = Error & {
    loc?: {
        line: number;
        column: number;
    };
};

const WRAPPER_PREFIX = 'const __puppetflowCodeNode = async () => {\n';
const WRAPPER_SUFFIX = '\n};';

export function getCodeSyntaxIssue(source: string): CodeSyntaxIssue | null {
    try {
        parse(`${WRAPPER_PREFIX}${source}${WRAPPER_SUFFIX}`, {
            ecmaVersion: 'latest',
            sourceType: 'script',
        });
        return null;
    } catch (error) {
        const syntaxError = error as AcornSyntaxError;
        const sourceLineCount = Math.max(1, source.split('\n').length);
        const line = Math.min(
            sourceLineCount,
            Math.max(1, (syntaxError.loc?.line ?? 2) - 1),
        );
        const column = Math.max(1, (syntaxError.loc?.column ?? 0) + 1);
        const message = syntaxError.message
            .replace(/\s+\(\d+:\d+\)$/, '')
            .trim() || 'Invalid JavaScript syntax';

        return { message, line, column };
    }
}
