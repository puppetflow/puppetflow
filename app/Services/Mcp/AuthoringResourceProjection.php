<?php

namespace App\Services\Mcp;

use App\Authorization\AuthorizationContext;
use App\Authorization\AuthorizationContextFactory;
use App\Authorization\Visibility\SharedResourceVisibility;
use App\Enums\Authorization\Ability;
use App\Enums\Integration\IntegrationCategoryEnum;
use App\Models\AiModel;
use App\Models\DataTable;
use App\Models\DataTableColumn;
use App\Models\Flow;
use App\Models\Integration;
use App\Models\MailboxWatcher;
use App\Models\NotificationChannel;
use App\Models\Snippet;
use App\Models\SnippetVersion;
use App\Models\User;
use App\Models\UserVariable;
use App\Models\Workspace;
use App\Services\FeatureFlags\FeatureFlagService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Gate;

final class AuthoringResourceProjection
{
    public const KINDS = [
        'ai_models',
        'notification_channels',
        'mailbox_watchers',
        'data_tables',
        'variables',
        'snippets',
    ];

    public function __construct(
        private readonly AuthorizationContextFactory $contexts,
        private readonly SharedResourceVisibility $visibility,
        private readonly FeatureFlagService $features,
    ) {}

    /**
     * @param  list<string>  $kinds
     * @param  array<string, list<string>>  $idsByKind
     * @return array<string, list<array<string, mixed>>>
     */
    public function project(
        Workspace $workspace,
        User $actor,
        ?Flow $flow = null,
        array $kinds = self::KINDS,
        ?string $search = null,
        ?int $limit = null,
        array $idsByKind = [],
    ): array {
        if ($flow) {
            abort_unless($flow->workspace_id === $workspace->id, 404);
            Gate::forUser($actor)->authorize(Ability::VIEW->value, $flow);
        }
        $context = $this->contexts->for($actor, $workspace->id);
        $requested = array_values(array_intersect(self::KINDS, $kinds));
        $resources = [];
        foreach ($requested as $kind) {
            $resources[$kind] = match ($kind) {
                'ai_models' => $this->aiModels($context, $actor, $search, $limit, $idsByKind[$kind] ?? []),
                'notification_channels' => $this->notificationChannels($context, $actor, $search, $limit, $idsByKind[$kind] ?? []),
                'mailbox_watchers' => $flow
                    ? $this->mailboxWatchers($flow, $context, $actor, $search, $limit, $idsByKind[$kind] ?? [])
                    : [],
                'data_tables' => $this->dataTables($context, $actor, $search, $limit, $idsByKind[$kind] ?? []),
                'variables' => $this->variables($context, $actor, $search, $limit, $idsByKind[$kind] ?? []),
                'snippets' => $this->snippets($context, $actor, $search, $limit, $idsByKind[$kind] ?? []),
            };
        }

        return $resources;
    }

    /** @param list<string> $ids
     * @return list<array<string, mixed>>
     */
    private function aiModels(
        AuthorizationContext $context,
        User $actor,
        ?string $search,
        ?int $limit,
        array $ids,
    ): array {
        if (! $this->features->enabled('ai_enabled')) {
            return [];
        }

        $integrations = Integration::query()
            ->where('category', IntegrationCategoryEnum::AI)
            ->where('is_active', true)
            ->where('stale', false);
        $this->visibility->applyUse($integrations, $context);

        $query = AiModel::query()
            ->where('is_active', true)
            ->where('stale', false)
            ->whereIn('ai_integration_id', $integrations->select('id'));
        if ($ids !== []) {
            $query->whereIn('id', $ids);
        }
        $this->visibility->applyUse($query, $context);
        if ($search !== null && $search !== '') {
            $query->where(fn (Builder $query) => $query
                ->where('name', 'like', "%{$search}%")
                ->orWhere('ai_model_id', 'like', "%{$search}%")
                ->orWhere('id', 'like', "%{$search}%"));
        }
        if ($limit !== null) {
            $query->limit($limit);
        }

        return array_values($query->orderBy('name')->get([
            'id',
            'workspace_id',
            'user_id',
            'team_id',
            'scope',
            'name',
            'ai_model_id',
            'capabilities',
        ])
            ->filter(fn (AiModel $model): bool => Gate::forUser($actor)->allows(Ability::USE->value, $model))
            ->map(fn (AiModel $model): array => [
                'id' => $model->id,
                'name' => $model->name,
                'model' => $model->ai_model_id,
                'capabilities' => collect($model->capabilities ?? [])
                    ->filter(fn (mixed $value, mixed $key): bool => is_string($key) && is_bool($value))
                    ->all(),
            ])
            ->values()
            ->all());
    }

    /** @param list<string> $ids
     * @return list<array<string, mixed>>
     */
    private function notificationChannels(
        AuthorizationContext $context,
        User $actor,
        ?string $search,
        ?int $limit,
        array $ids,
    ): array {
        if (! $this->features->enabled('messenger_enabled')) {
            return [];
        }

        $integrations = Integration::query()
            ->where('category', IntegrationCategoryEnum::MESSENGER)
            ->where('is_active', true)
            ->where('stale', false);
        $this->visibility->applyUse($integrations, $context);

        $query = NotificationChannel::query()
            ->where('is_active', true)
            ->where('stale', false)
            ->whereIn('messenger_integration_id', $integrations->select('id'));
        if ($ids !== []) {
            $query->whereIn('id', $ids);
        }
        $this->visibility->applyUse($query, $context);
        if ($search !== null && $search !== '') {
            $query->where(fn (Builder $query) => $query
                ->where('name', 'like', "%{$search}%")
                ->orWhere('provider', 'like', "%{$search}%")
                ->orWhere('id', 'like', "%{$search}%"));
        }
        if ($limit !== null) {
            $query->limit($limit);
        }

        return array_values($query->orderBy('name')->get([
            'id',
            'workspace_id',
            'user_id',
            'team_id',
            'scope',
            'name',
            'provider',
        ])
            ->filter(fn (NotificationChannel $channel): bool => Gate::forUser($actor)
                ->allows(Ability::USE->value, $channel))
            ->map(fn (NotificationChannel $channel): array => [
                'id' => $channel->id,
                'name' => $channel->name,
                'provider' => $channel->provider,
            ])
            ->values()
            ->all());
    }

    /** @param list<string> $ids
     * @return list<array<string, mixed>>
     */
    private function mailboxWatchers(
        Flow $flow,
        AuthorizationContext $context,
        User $actor,
        ?string $search,
        ?int $limit,
        array $ids,
    ): array {
        if (! $this->features->enabled('mailbox_enabled')) {
            return [];
        }

        $query = MailboxWatcher::query()
            ->select([
                'mailbox_watchers.id',
                'mailbox_watchers.flow_id',
                'mailbox_watchers.user_id',
                'mailbox_watchers.mailbox_id',
                'mailbox_watchers.name',
                'mailbox_watchers.is_active',
                'mailbox_watchers.stale',
                'mailbox_watchers.scope',
                'mailbox_watchers.team_id',
            ])
            ->join('flows', 'flows.id', '=', 'mailbox_watchers.flow_id')
            ->where('mailbox_watchers.flow_id', $flow->id)
            ->where('mailbox_watchers.is_active', true)
            ->where('mailbox_watchers.stale', false)
            ->whereHas('mailbox', function (Builder $mailbox) use ($context): void {
                $mailbox->where('is_active', true)
                    ->where('stale', false)
                    ->whereHas('domain', fn (Builder $domain) => $domain->where('stale', false));
                $this->visibility->applyUse($mailbox, $context);
            });
        if ($ids !== []) {
            $query->whereIn('mailbox_watchers.id', $ids);
        }
        $this->visibility->applyUse(
            $query,
            $context,
            workspaceColumn: 'flows.workspace_id',
            ownerColumn: 'mailbox_watchers.user_id',
            scopeColumn: 'mailbox_watchers.scope',
            teamColumn: 'mailbox_watchers.team_id',
        );
        if ($search !== null && $search !== '') {
            $query->where(fn (Builder $query) => $query
                ->where('mailbox_watchers.name', 'like', "%{$search}%")
                ->orWhere('mailbox_watchers.id', 'like', "%{$search}%"));
        }
        if ($limit !== null) {
            $query->limit($limit);
        }

        return array_values($query->orderBy('mailbox_watchers.name')->get()
            ->each(fn (MailboxWatcher $watcher) => $watcher->setRelation('flow', $flow))
            ->filter(fn (MailboxWatcher $watcher): bool => Gate::forUser($actor)
                ->allows(Ability::USE->value, $watcher))
            ->map(fn (MailboxWatcher $watcher): array => [
                'id' => $watcher->id,
                'name' => $watcher->name,
            ])
            ->values()
            ->all());
    }

    /** @param list<string> $ids
     * @return list<array<string, mixed>>
     */
    private function dataTables(
        AuthorizationContext $context,
        User $actor,
        ?string $search,
        ?int $limit,
        array $ids,
    ): array {
        $query = DataTable::query()->with('columns');
        if ($ids !== []) {
            $query->whereIn('id', $ids);
        }
        $this->visibility->applyView($query, $context, scopeColumn: 'visibility');
        if ($search !== null && $search !== '') {
            $query->where(fn (Builder $query) => $query
                ->where('name', 'like', "%{$search}%")
                ->orWhere('description', 'like', "%{$search}%")
                ->orWhere('id', 'like', "%{$search}%"));
        }
        if ($limit !== null) {
            $query->limit($limit);
        }

        return array_values($query->orderBy('name')->get()
            ->filter(fn (DataTable $table): bool => Gate::forUser($actor)->allows(Ability::VIEW->value, $table))
            ->map(function (DataTable $table) use ($actor): array {
                $canUpdate = Gate::forUser($actor)->allows(Ability::UPDATE->value, $table);

                return [
                    'id' => $table->id,
                    'name' => $table->name,
                    'description' => $table->description,
                    'schema' => $table->columns->map(fn (DataTableColumn $column): array => [
                        'id' => $column->id,
                        'name' => $column->name,
                        'type' => $column->type->value,
                    ])->values()->all(),
                    'capabilities' => [
                        'read_rows' => true,
                        'write_rows' => $canUpdate,
                        'alter_schema' => $canUpdate,
                        'delete_table' => Gate::forUser($actor)->allows(Ability::DELETE->value, $table),
                    ],
                ];
            })
            ->values()
            ->all());
    }

    /** @param list<string> $ids
     * @return list<array<string, mixed>>
     */
    private function variables(
        AuthorizationContext $context,
        User $actor,
        ?string $search,
        ?int $limit,
        array $ids,
    ): array {
        if (! $this->features->enabled('variables_enabled')) {
            return [];
        }

        $query = UserVariable::query()->where('stale', false);
        if ($ids !== []) {
            $query->whereIn('id', $ids);
        }
        $this->visibility->applyUse($query, $context);
        if ($search !== null && $search !== '') {
            $query->where(fn (Builder $query) => $query
                ->where('key', 'like', "%{$search}%")
                ->orWhere('id', 'like', "%{$search}%"));
        }
        if ($limit !== null) {
            $query->limit($limit);
        }

        return array_values($query->orderBy('key')->get([
            'id',
            'workspace_id',
            'user_id',
            'team_id',
            'scope',
            'key',
            'type',
        ])
            ->filter(fn (UserVariable $variable): bool => Gate::forUser($actor)
                ->allows(Ability::USE->value, $variable))
            ->map(fn (UserVariable $variable): array => [
                'id' => $variable->id,
                'key' => $variable->key,
                'type' => $variable->type,
            ])
            ->values()
            ->all());
    }

    /** @param list<string> $ids
     * @return list<array<string, mixed>>
     */
    private function snippets(
        AuthorizationContext $context,
        User $actor,
        ?string $search,
        ?int $limit,
        array $ids,
    ): array {
        if (! $this->features->enabled('snippets_enabled')) {
            return [];
        }

        $query = Snippet::query()
            ->where('is_active', true)
            ->where('stale', false)
            ->whereNotNull('published_version_id')
            ->with('publishedVersion:id,version,args,snippet_type');
        if ($ids !== []) {
            $query->whereIn('id', $ids);
        }
        $this->visibility->applyUse($query, $context);
        if ($search !== null && $search !== '') {
            $query->where(fn (Builder $query) => $query
                ->where('label', 'like', "%{$search}%")
                ->orWhere('description', 'like', "%{$search}%")
                ->orWhere('id', 'like', "%{$search}%"));
        }
        if ($limit !== null) {
            $query->limit($limit);
        }

        return array_values($query->orderBy('label')->get([
            'id',
            'workspace_id',
            'user_id',
            'team_id',
            'scope',
            'label',
            'description',
            'is_active',
            'stale',
            'published_version_id',
        ])
            ->filter(fn (Snippet $snippet): bool => Gate::forUser($actor)->allows(Ability::USE->value, $snippet))
            ->map(function (Snippet $snippet): ?array {
                $version = $snippet->publishedVersion;
                if (! $version instanceof SnippetVersion) {
                    return null;
                }

                return [
                    'id' => $snippet->id,
                    'label' => $snippet->label,
                    'description' => $snippet->description,
                    'args' => $version->args ?? '',
                    'type' => $version->snippet_type,
                    'version' => $version->version,
                ];
            })
            ->filter()
            ->values()
            ->all());
    }
}
