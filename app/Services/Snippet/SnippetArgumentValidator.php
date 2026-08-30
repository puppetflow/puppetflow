<?php

namespace App\Services\Snippet;

use Illuminate\Validation\ValidationException;

final class SnippetArgumentValidator
{
    private const RESERVED = [
        'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
        'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false',
        'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let',
        'new', 'null', 'return', 'static', 'super', 'switch', 'this', 'throw',
        'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
        '$page', '$input', '$nodes', '$run', '$output', '$context', '$json',
        '$vars', '$userOutput', '$renderExpression', '$keyboardSpeed',
        '$viewportWidth', '$viewportHeight', '$',
    ];

    /** @return list<string> */
    public function validate(string $args): array
    {
        $arguments = array_map('trim', explode(',', $args));
        if (trim($args) === '') {
            return [];
        }
        if (in_array('', $arguments, true)) {
            throw ValidationException::withMessages([
                'args' => 'Snippet arguments cannot contain empty entries.',
            ]);
        }
        if (count($arguments) !== count(array_unique($arguments))) {
            throw ValidationException::withMessages([
                'args' => 'Snippet arguments must be unique.',
            ]);
        }

        foreach ($arguments as $argument) {
            if (
                preg_match('/^[A-Za-z_$][A-Za-z0-9_$]*$/', $argument) !== 1
                || in_array($argument, self::RESERVED, true)
                || str_starts_with($argument, '__pf')
                || str_starts_with($argument, 'nodeResult')
            ) {
                throw ValidationException::withMessages([
                    'args' => 'Snippet arguments must be JavaScript identifiers and cannot use reserved runtime names.',
                ]);
            }
        }

        return $arguments;
    }
}
