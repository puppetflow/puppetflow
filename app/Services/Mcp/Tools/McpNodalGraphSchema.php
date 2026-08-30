<?php

namespace App\Services\Mcp\Tools;

final class McpNodalGraphSchema
{
    /** @return array<string, mixed> */
    public static function make(string $context): array
    {
        $flow = $context === 'flow';

        return [
            'type' => 'object',
            'additionalProperties' => false,
            'required' => ['nodes', 'edges'],
            'properties' => [
                'nodes' => [
                    'type' => 'array',
                    'maxItems' => 2000,
                    'items' => [
                        'type' => 'object',
                        'additionalProperties' => false,
                        'required' => ['id', 'name', 'x', 'y'],
                        'properties' => [
                            'id' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 255],
                            'name' => [
                                'type' => 'string',
                                'description' => $flow
                                    ? 'Exact catalog name, RUN, TERMINATE, FUNCTION, a private-function call, or a returned $$ snippet reference.'
                                    : 'Exact catalog name, FUNCTION, a private-function call, or a returned $$ snippet reference.',
                            ],
                            'label' => ['type' => 'string'],
                            'x' => ['type' => 'number'],
                            'y' => ['type' => 'number'],
                            'values' => [
                                'type' => 'object',
                                'additionalProperties' => [
                                    'description' => 'A raw string or typed value. Scalar: {mode:"fixed"|"expression",value:string}. Expressions execute only inside {{ ... }}. Object: {mode:"object",inputMode:"json"|"form",jsonMode?,value,fields}. If condition: {mode:"if-condition",combinator:"and"|"or",rules}.',
                                    'oneOf' => [
                                        ['type' => 'string'],
                                        ['type' => 'object', 'additionalProperties' => true],
                                    ],
                                ],
                            ],
                            'system' => [
                                'type' => 'string',
                                'enum' => $flow ? ['run', 'terminate', 'function'] : ['function'],
                            ],
                            'kind' => ['type' => 'string', 'enum' => ['stickyNote']],
                            'deactivated' => ['type' => 'boolean'],
                            'callArguments' => ['type' => 'array', 'items' => ['type' => 'string']],
                            'scopeId' => ['type' => 'string'],
                            'localFunctionId' => ['type' => 'string'],
                            'stickyNote' => ['type' => 'object', 'additionalProperties' => true],
                        ],
                    ],
                ],
                'edges' => [
                    'type' => 'array',
                    'maxItems' => 5000,
                    'items' => [
                        'type' => 'object',
                        'additionalProperties' => false,
                        'required' => ['id', 'sourceNodeId', 'targetNodeId'],
                        'properties' => [
                            'id' => ['type' => 'string', 'minLength' => 1],
                            'sourceNodeId' => ['type' => 'string'],
                            'targetNodeId' => ['type' => 'string'],
                            'sourcePort' => [
                                'type' => 'string',
                                'pattern' => '^[A-Za-z0-9_-]{1,64}$',
                                'default' => 'output',
                            ],
                            'targetPort' => [
                                'type' => 'string',
                                'pattern' => '^[A-Za-z0-9_-]{1,64}$',
                                'default' => 'input',
                            ],
                        ],
                    ],
                ],
            ],
        ];
    }
}
