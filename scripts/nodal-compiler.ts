import { compileNodalGraphToCode } from '../resources/js/Domains/Flow/Pages/FlowEditor/nodalCompiler';
import type { NodalGraph } from '../resources/js/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import { parse } from 'acorn';

const readStdin = async (): Promise<string> => {
    process.stdin.setEncoding('utf8');

    let input = '';
    for await (const chunk of process.stdin) {
        input += chunk;
    }

    return input;
};

try {
    const payload = JSON.parse(await readStdin()) as { graph?: NodalGraph };
    if (!payload.graph || typeof payload.graph !== 'object') {
        throw new Error('A nodal graph is required.');
    }

    const code = compileNodalGraphToCode(payload.graph);
    parse(code, { ecmaVersion: 'latest', sourceType: 'script' });
    process.stdout.write(JSON.stringify({ code }));
} catch (error) {
    const message = error instanceof Error ? error.message : 'Nodal compilation failed.';
    process.stdout.write(JSON.stringify({ error: message }));
    process.exitCode = 1;
}
