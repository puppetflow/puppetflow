<?php

namespace App\Services\Flow;

use App\Enums\Authorization\Ability;
use App\Models\Flow;
use App\Models\Mailbox;
use App\Models\MailboxWatcher;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class FlowMailboxWatcherImportService
{
    /**
     * @param array<int, array<string, mixed>> $schemas
     * @param array<string, string> $mailboxMappings
     * @param array<string, mixed>|null $defaultInputs
     * @return array{
     *     default_inputs: array<string, mixed>|null,
     *     watchers: array<int, array<string, mixed>>
     * }
     */
    public function prepare(
        array $schemas,
        array $mailboxMappings,
        ?array $defaultInputs,
        string $workspaceId,
        User $user,
    ): array {
        if ($defaultInputs === null) {
            return ['default_inputs' => null, 'watchers' => []];
        }

        $schemasBySourceId = collect($schemas)->keyBy('source_id');
        $sourceIds = collect($defaultInputs)
            ->map(fn (mixed $value): ?string => $this->watcherReferenceId($value))
            ->filter()
            ->unique()
            ->values();
        $newIdBySourceId = [];
        $watchers = [];

        foreach ($sourceIds as $sourceId) {
            $definition = $schemasBySourceId->get($sourceId);
            if (! is_array($definition)) {
                throw ValidationException::withMessages([
                    'mailbox_watcher_schemas' => "The referenced Mailbox Watcher {$sourceId} is missing from the import.",
                ]);
            }

            $sourceMailboxId = $definition['mailbox']['source_id'];
            $destinationMailboxId = $mailboxMappings[$sourceMailboxId] ?? null;
            if (! is_string($destinationMailboxId)) {
                throw ValidationException::withMessages([
                    'mailbox_mappings' => "A destination mailbox is required for {$definition['mailbox']['address']}.",
                ]);
            }

            $mailbox = Mailbox::query()
                ->whereKey($destinationMailboxId)
                ->where('workspace_id', $workspaceId)
                ->where('is_active', true)
                ->where('stale', false)
                ->whereHas('domain', fn ($query) => $query->where('stale', false))
                ->first();
            if (! $mailbox || Gate::forUser($user)->denies(Ability::USE->value, $mailbox)) {
                throw ValidationException::withMessages([
                    'mailbox_mappings' => 'One of the selected destination mailboxes is unavailable.',
                ]);
            }

            $newId = MailboxWatcher::generateId();
            $newIdBySourceId[$sourceId] = $newId;
            $watchers[] = [
                'id' => $newId,
                'mailbox_id' => $mailbox->id,
                'name' => $definition['name'],
                'group' => $definition['group'] ?? null,
                'extract_enabled' => $definition['extract_enabled'],
                'extract_mode' => $definition['extract_mode'],
                'extract_expression' => $definition['extract_expression'] ?? null,
                'is_active' => $definition['is_active'],
                'timeout' => $definition['timeout'] ?? null,
                'rules' => $definition['rules'],
            ];
        }

        $remappedInputs = collect($defaultInputs)->map(function (mixed $value) use ($newIdBySourceId): mixed {
            $sourceId = $this->watcherReferenceId($value);
            if ($sourceId === null || ! isset($newIdBySourceId[$sourceId])) {
                return $value;
            }

            return '${mailboxWatchers.'.$newIdBySourceId[$sourceId].'}';
        })->all();

        return ['default_inputs' => $remappedInputs, 'watchers' => $watchers];
    }

    /** @param array<int, array<string, mixed>> $watchers */
    public function create(Flow $flow, array $watchers): void
    {
        foreach ($watchers as $definition) {
            $rules = $definition['rules'];
            $watcherId = $definition['id'];
            unset($definition['id'], $definition['rules']);
            $watcher = $flow->mailboxWatchers()->make([
                ...$definition,
                'user_id' => $flow->owner_id,
                'scope' => $flow->visibility,
                'team_id' => $flow->team_id,
                'stale' => false,
            ]);
            $watcher->id = $watcherId;
            $watcher->save();
            foreach ($rules as $rule) {
                $watcher->rules()->create($rule);
            }
        }
    }

    private function watcherReferenceId(mixed $value): ?string
    {
        if (! is_string($value) || preg_match('/^\$\{mailboxWatchers\.([^}]+)\}$/', $value, $matches) !== 1) {
            return null;
        }

        return $matches[1];
    }
}
