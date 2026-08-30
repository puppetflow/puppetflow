import { parse } from 'acorn';

let source = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) {
    source += chunk;
}

try {
    const program = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
    const runs = program.body.filter(node => (
        node.type === 'FunctionDeclaration'
        && node.id?.name === 'run'
    ));
    const run = runs.length === 1 ? runs[0] : null;
    const validParameters = run?.params.length === 2
        && run.params[0]?.type === 'Identifier'
        && run.params[0].name === '$page'
        && run.params[1]?.type === 'Identifier'
        && run.params[1].name === '$input';

    if (!run?.async || !validParameters) {
        throw new Error('The source must define a top-level async function run($page, $input).');
    }
} catch (error) {
    process.stderr.write(error instanceof Error ? error.message : 'The JavaScript source is invalid.');
    process.exitCode = 1;
}
