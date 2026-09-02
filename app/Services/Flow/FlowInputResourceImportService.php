<?php

namespace App\Services\Flow;

use App\Models\Flow;
use App\Models\User;
use App\Models\Workspace;
use App\Services\Mcp\AuthoringResourceProjection;
use Illuminate\Support\Collection;

final class FlowInputResourceImportService
{
    private const KIND_BY_NAMESPACE = [
        'channels' => 'notification_channels',
        'mailboxWatchers' => 'mailbox_watchers',
        'aiModels' => 'ai_models',
        'dataTables' => 'data_tables',
    ];

    public function __construct(
        private readonly AuthoringResourceProjection $resources,
    ) {}

    /**
     * @param  array<string, mixed>|null  $inputs
     * @return array<string, mixed>|null
     */
    public function clearUnavailable(
        ?array $inputs,
        Flow $flow,
        User $user,
        Workspace $workspace,
    ): ?array {
        if ($inputs === null) {
            return null;
        }

        $idsByKind = [];
        $this->collectReferences($inputs, $idsByKind);
        if ($idsByKind === []) {
            return $inputs;
        }

        $projected = $this->resources->project(
            $workspace,
            $user,
            $flow,
            array_keys($idsByKind),
            idsByKind: array_map(
                fn (array $ids): array => array_values(array_unique($ids)),
                $idsByKind,
            ),
        );
        $availableIds = collect($projected)->map(
            fn (array $resources) => collect($resources)
                ->pluck('id')
                ->map(fn (mixed $id): string => (string) $id)
                ->flip(),
        );

        return array_map(
            fn (mixed $value): mixed => $this->clearUnavailableValue($value, $availableIds),
            $inputs,
        );
    }

    /** @param array<string, list<string>> $idsByKind */
    private function collectReferences(array $values, array &$idsByKind): void
    {
        foreach ($values as $value) {
            $reference = $this->reference($value);
            if ($reference !== null) {
                $idsByKind[$reference['kind']][] = $reference['id'];
            } elseif (is_array($value)) {
                $this->collectReferences($value, $idsByKind);
            }
        }
    }

    /** @param Collection<string, Collection<string, int>> $availableIds */
    private function clearUnavailableValue(mixed $value, Collection $availableIds): mixed
    {
        $reference = $this->reference($value);
        if ($reference !== null) {
            return $availableIds->get($reference['kind'], collect())->has($reference['id'])
                ? $value
                : '${'.$reference['namespace'].'}';
        }

        return is_array($value)
            ? array_map(fn (mixed $nested): mixed => $this->clearUnavailableValue($nested, $availableIds), $value)
            : $value;
    }

    /** @return array{namespace: string, kind: string, id: string}|null */
    private function reference(mixed $value): ?array
    {
        if (
            ! is_string($value)
            || preg_match('/^\$\{(channels|mailboxWatchers|aiModels|dataTables)\.([a-zA-Z0-9_.-]+)\}$/', $value, $matches) !== 1
        ) {
            return null;
        }

        return [
            'namespace' => $matches[1],
            'kind' => self::KIND_BY_NAMESPACE[$matches[1]],
            'id' => $matches[2],
        ];
    }
}
