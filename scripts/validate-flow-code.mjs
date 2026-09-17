import { parse } from 'acorn';

let source = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) {
    source += chunk;
}

try {
    const program = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
    if (process.argv.includes('--syntax-only')) {
        process.exit(0);
    }

    const runs = program.body.filter(node => (
        node.type === 'FunctionDeclaration'
        && node.id?.name === 'run'
    ));
    const run = runs.length === 1 ? runs[0] : null;
    // $context and $client are optional trailing parameters.
    const validParameters = run !== null
        && run.params.length >= 2
        && run.params.length <= 4
        && run.params.every(param => param.type === 'Identifier')
        && run.params[0].name === '$page'
        && run.params[1].name === '$input';

    if (!run?.async || !validParameters) {
        throw new Error('The source must define a top-level async function run($page, $input, $context, $client).');
    }
} catch (error) {
    process.stderr.write(error instanceof Error ? error.message : 'The JavaScript source is invalid.');
    process.exitCode = 1;
}
