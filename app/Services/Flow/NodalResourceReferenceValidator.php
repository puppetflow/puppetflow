<?php

namespace App\Services\Flow;

use App\Models\Flow;
use App\Models\User;
use App\Models\Workspace;
use App\Services\Mcp\AuthoringResourceProjection;
use Illuminate\Validation\ValidationException;

final class NodalResourceReferenceValidator
{
    private const RESOURCE_KIND_BY_INPUT = [
        'channel' => 'notification_channels',
        'mailbox-watcher' => 'mailbox_watchers',
        'ai-model' => 'ai_models',
        'ai-vision-model' => 'ai_models',
        'data-table' => 'data_tables',
    ];

    public function __construct(
        private readonly NodalCatalogService $catalog,
        private readonly AuthoringResourceProjection $resources,
    ) {}

    /** @param array<string, mixed> $graph */
    public function validate(
        array $graph,
        User $user,
        Workspace $workspace,
        ?Flow $flow = null,
    ): void {
        $catalog = collect($this->catalog->entries())->keyBy('name');
        $nodes = is_array($graph['nodes'] ?? null) ? $graph['nodes'] : [];
        $idsByKind = [];
        foreach ($nodes as $node) {
            if (! is_array($node) || ($node['deactivated'] ?? false) || ! is_string($node['name'] ?? null)) {
                continue;
            }
            $name = $node['name'];
            if (str_starts_with($name, '$$')) {
                $idsByKind['snippets'][] = substr($name, 2);

                continue;
            }
            $entry = $catalog->get($name);
            $values = is_array($node['values'] ?? null) ? $node['values'] : [];
            foreach (is_array($entry) && is_array($entry['parameterFields'] ?? null) ? $entry['parameterFields'] : [] as $field) {
                $definition = is_array($field) ? $this->resourceField($name, $field) : null;
                if (! $definition) {
                    continue;
                }
                $resourceId = $this->fixedValue($values, $definition['path']);
                if (is_string($resourceId) && $resourceId !== '') {
                    $idsByKind[$definition['kind']][] = $definition['kind'] === 'variables'
                        ? explode('.', $resourceId, 2)[0]
                        : $resourceId;
                }
            }
        }
        $kinds = array_keys($idsByKind);
        if ($kinds === []) {
            return;
        }

        $idsByKind = array_map(
            fn (array $ids): array => array_values(array_unique($ids)),
            $idsByKind,
        );
        $resources = $this->resources->project(
            $workspace,
            $user,
            $flow,
            $kinds,
            idsByKind: $idsByKind,
        );
        $ids = collect($resources)->map(
            fn (array $items) => collect($items)->pluck('id')->filter('is_string')->flip(),
        );
        foreach ($nodes as $node) {
            if (! is_array($node) || ($node['deactivated'] ?? false)) {
                continue;
            }
            $name = $node['name'] ?? null;
            if (! is_string($name)) {
                continue;
            }
            if (str_starts_with($name, '$$')) {
                $this->validateSnippetNode($node, $name, $resources['snippets'] ?? []);

                continue;
            }

            $entry = $catalog->get($name);
            $values = is_array($node['values'] ?? null) ? $node['values'] : [];
            foreach (is_array($entry) && is_array($entry['parameterFields'] ?? null) ? $entry['parameterFields'] : [] as $field) {
                if (! is_array($field)) {
                    continue;
                }
                $definition = $this->resourceField($name, $field);
                if (! $definition) {
                    continue;
                }
                ['input' => $input, 'kind' => $kind, 'path' => $path] = $definition;
                $resourceId = $this->fixedValue($values, $path);
                $lookupId = is_string($resourceId) && $kind === 'variables'
                    ? explode('.', $resourceId, 2)[0]
                    : $resourceId;
                if (
                    is_string($resourceId)
                    && $resourceId !== ''
                    && (
                        ! is_string($lookupId)
                        || $lookupId === ''
                        || ! $ids->get($kind, collect())->has($lookupId)
                    )
                ) {
                    $resourceLabel = $kind === 'variables' ? 'variable' : $input;
                    throw ValidationException::withMessages([
                        'nodal_graph' => "{$name} references an unavailable {$resourceLabel} resource.",
                    ]);
                }
                if (is_string($lookupId) && $lookupId !== '') {
                    $this->validateCapability($name, $input, $lookupId, $resources[$kind]);
                }
            }
        }
    }

    /**
     * @param  array<array-key, mixed>  $field
     * @return array{input: string, kind: string, path: list<string>}|null
     */
    private function resourceField(string $nodeName, array $field): ?array
    {
        $input = is_string($field['input'] ?? null)
            ? $field['input']
            : (is_string($field['valueType'] ?? null) ? $field['valueType'] : '');
        $path = is_array($field['path'] ?? null)
            ? array_values(array_filter($field['path'], 'is_string'))
            : [];
        $kind = $nodeName === '$vars' && $path === ['variableId']
            ? 'variables'
            : (self::RESOURCE_KIND_BY_INPUT[$input] ?? null);

        return $kind !== null && $path !== []
            ? ['input' => $input, 'kind' => $kind, 'path' => $path]
            : null;
    }

    /**
     * @param  array<string, mixed>  $node
     * @param  list<array<string, mixed>>  $snippets
     */
    private function validateSnippetNode(array $node, string $name, array $snippets): void
    {
        $snippet = collect($snippets)->first(function (array $candidate) use ($name): bool {
            $id = $candidate['id'] ?? null;

            return is_string($id) && '$$'.$id === $name;
        });
        if (! is_array($snippet)) {
            throw ValidationException::withMessages([
                'nodal_graph' => "{$name} is not an available published snippet.",
            ]);
        }

        $arguments = array_values(array_filter(array_map(
            'trim',
            explode(',', is_string($snippet['args'] ?? null) ? $snippet['args'] : ''),
        )));
        $values = is_array($node['values'] ?? null) ? $node['values'] : [];
        $explicitCallArguments = is_array($node['callArguments'] ?? null)
            ? array_values(array_filter($node['callArguments'], 'is_string'))
            : [];
        $callArguments = $explicitCallArguments !== []
            ? $explicitCallArguments
            : array_values(array_filter(
                array_keys($values),
                fn (string $key): bool => $key !== '__runOutputKey',
            ));
        if ($callArguments !== $arguments) {
            throw ValidationException::withMessages([
                'nodal_graph' => "{$name} must use its published argument list.",
            ]);
        }

        foreach ($arguments as $argument) {
            if (! $this->hasValue($values[$argument] ?? null)) {
                throw ValidationException::withMessages([
                    'nodal_graph' => "{$name} requires the {$argument} argument.",
                ]);
            }
        }
    }

    /**
     * @param  array<string, mixed>  $values
     * @param  list<string>  $path
     */
    private function fixedValue(array $values, array $path): mixed
    {
        $current = $values[$path[0]] ?? null;
        foreach (array_slice($path, 1) as $segment) {
            if (! is_array($current)) {
                return null;
            }
            if (($current['mode'] ?? null) === 'object') {
                if (($current['inputMode'] ?? null) === 'json') {
                    if (($current['jsonMode'] ?? null) === 'expression') {
                        return null;
                    }
                    $decoded = json_decode(is_string($current['value'] ?? null) ? $current['value'] : '', true);
                    $current = is_array($decoded) ? ($decoded[$segment] ?? null) : null;

                    continue;
                }
                $field = collect(is_array($current['fields'] ?? null) ? $current['fields'] : [])
                    ->first(fn (mixed $candidate): bool => is_array($candidate) && ($candidate['key'] ?? null) === $segment);
                $current = is_array($field) ? ($field['value'] ?? null) : null;

                continue;
            }
            if (($current['mode'] ?? null) === 'expression') {
                return null;
            }
            $current = $current[$segment] ?? null;
        }

        if (is_array($current) && isset($current['mode'])) {
            return $current['mode'] === 'fixed' ? ($current['value'] ?? null) : null;
        }

        return $current;
    }

    private function hasValue(mixed $value): bool
    {
        if (is_array($value) && isset($value['mode'])) {
            if ($value['mode'] === 'object') {
                return ($value['fields'] ?? []) !== []
                    || (is_string($value['value'] ?? null) && trim($value['value']) !== '');
            }
            $value = $value['value'] ?? null;
        }

        return is_string($value) ? trim($value) !== '' : $value !== null;
    }

    /** @param list<array<string, mixed>> $resources */
    private function validateCapability(string $nodeName, string $input, string $resourceId, array $resources): void
    {
        $resource = collect($resources)->first(
            fn (array $candidate): bool => ($candidate['id'] ?? null) === $resourceId,
        );
        if (! is_array($resource)) {
            return;
        }
        $requiredCapability = match (true) {
            $input === 'ai-vision-model' => 'vision',
            $input === 'ai-model' => 'text',
            $nodeName === '$dataTableDelete' => 'delete_table',
            $nodeName === '$dataTableUpdate' => 'alter_schema',
            in_array($nodeName, [
                '$dataTableInsertRow',
                '$dataTableUpdateRows',
                '$dataTableUpsertRows',
                '$dataTableDeleteRows',
            ], true) => 'write_rows',
            default => null,
        };
        if ($requiredCapability === null) {
            return;
        }
        $capabilities = is_array($resource['capabilities'] ?? null) ? $resource['capabilities'] : [];
        if (($capabilities[$requiredCapability] ?? false) !== true) {
            throw ValidationException::withMessages([
                'nodal_graph' => "{$nodeName} requires a resource with the {$requiredCapability} capability.",
            ]);
        }
    }
}
