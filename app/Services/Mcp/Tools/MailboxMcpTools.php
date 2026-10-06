<?php

namespace App\Services\Mcp\Tools;

use App\Authorization\AuthorizationContextFactory;
use App\Authorization\Visibility\SharedResourceVisibility;
use App\Enums\Authorization\Ability;
use App\Models\Mailbox;
use App\Models\MailboxWatcher;
use App\Models\MailboxWatcherRule;
use App\Services\FeatureFlags\FeatureFlagService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * @phpstan-type Arguments array<string, mixed>
 * @phpstan-type ToolDefinition array{name: string, description: string, inputSchema: array<string, mixed>}
 */
final class MailboxMcpTools implements McpToolHandler
{
    public const TOOL_NAMES = [
        'search_mailboxes',
        'get_mailbox',
        'update_mailbox',
    ];

    public function __construct(
        private readonly AuthorizationContextFactory $contexts,
        private readonly SharedResourceVisibility $visibility,
        private readonly FeatureFlagService $features,
    ) {}

    /** @return list<ToolDefinition> */
    public function definitions(): array
    {
        $mailboxId = ['type' => 'string', 'description' => 'Mailbox ID returned by search_mailboxes.'];

        return [
            [
                'name' => 'search_mailboxes',
                'description' => 'Search visible mailboxes and return their address, group, domain, usage counts, scope, and capabilities.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'properties' => [
                        'query' => ['type' => 'string', 'description' => 'Search address, slug, description, group, domain, or ID.'],
                        'group' => ['type' => ['string', 'null'], 'description' => 'Exact group. Null selects ungrouped mailboxes.'],
                        'scope' => ['type' => 'string', 'enum' => ['user', 'workspace', 'team']],
                        'active_only' => ['type' => 'boolean', 'default' => false],
                        'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 100, 'default' => 20],
                    ],
                ],
            ],
            [
                'name' => 'get_mailbox',
                'description' => 'Get safe mailbox metadata and its configured flow watchers and matching rules.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['mailbox_id'],
                    'properties' => ['mailbox_id' => $mailboxId],
                ],
            ],
            [
                'name' => 'update_mailbox',
                'description' => 'Update mailbox description or group without changing its address, domain, scope, or watcher configuration.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['mailbox_id'],
                    'anyOf' => [
                        ['required' => ['description']],
                        ['required' => ['group']],
                    ],
                    'properties' => [
                        'mailbox_id' => $mailboxId,
                        'description' => ['type' => ['string', 'null'], 'maxLength' => 255],
                        'group' => ['type' => ['string', 'null'], 'maxLength' => 100],
                    ],
                ],
            ],
        ];
    }

    public function handles(string $name): bool
    {
        return in_array($name, self::TOOL_NAMES, true);
    }

    public function call(string $name, array $arguments, McpToolContext $context): array
    {
        $this->ensureEnabled();

        return match ($name) {
            'search_mailboxes' => $this->search($arguments, $context),
            'get_mailbox' => $this->get($arguments, $context),
            'update_mailbox' => $this->update($arguments, $context),
            default => throw ValidationException::withMessages(['name' => 'Unknown mailbox tool.']),
        };
    }

    /**
     * @param  Arguments  $arguments
     * @return array<string, mixed>
     */
    private function search(array $arguments, McpToolContext $context): array
    {
        $validated = validator($arguments, [
            'query' => ['sometimes', 'string', 'max:255'],
            'group' => ['sometimes', 'nullable', 'string', 'max:100'],
            'scope' => ['sometimes', 'string', 'in:user,workspace,team'],
            'active_only' => ['sometimes', 'boolean'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ])->validate();
        $query = Mailbox::query()
            ->where('stale', false)
            ->with(['domain', 'user:id,name', 'team:id,name'])
            ->withCount([
                'emails',
                'emails as unread_count' => fn (Builder $query) => $query->where('is_read', false),
            ]);
        $this->visibility->applyView(
            $query,
            $this->contexts->for($context->user, $context->workspace->id),
            scopeColumn: 'scope',
        );
        $search = trim((string) ($validated['query'] ?? ''));
        if ($search !== '') {
            $query->where(fn (Builder $query) => $query
                ->where('id', 'like', "%{$search}%")
                ->orWhere('address', 'like', "%{$search}%")
                ->orWhere('slug', 'like', "%{$search}%")
                ->orWhere('description', 'like', "%{$search}%")
                ->orWhere('group', 'like', "%{$search}%")
                ->orWhereHas('domain', fn (Builder $domain) => $domain->where('name', 'like', "%{$search}%")));
        }
        $this->applyGroup($query, $validated);
        if (isset($validated['scope'])) {
            $query->where('scope', $validated['scope']);
        }
        if (($validated['active_only'] ?? false) === true) {
            $query->where('is_active', true);
        }

        $mailboxes = $query
            ->orderBy('group')
            ->orderBy('address')
            ->limit((int) ($validated['limit'] ?? 20))
            ->get()
            ->filter(fn (Mailbox $mailbox): bool => Gate::forUser($context->user)
                ->allows(Ability::VIEW->value, $mailbox))
            ->map(fn (Mailbox $mailbox): array => $this->serialize($mailbox, $context))
            ->values()
            ->all();

        return ['mailboxes' => $mailboxes];
    }

    /**
     * @param  Arguments  $arguments
     * @return array<string, mixed>
     */
    private function get(array $arguments, McpToolContext $context): array
    {
        $mailbox = $this->mailbox(McpToolArguments::string($arguments, 'mailbox_id'), $context, Ability::VIEW);
        $watcherQuery = MailboxWatcher::query()
            ->where('mailbox_id', $mailbox->id)
            ->where('stale', false)
            ->with(['flow:id,name', 'rules'])
            ->orderBy('name');
        $watchers = $watcherQuery
            ->get()
            ->filter(fn (MailboxWatcher $watcher): bool => Gate::forUser($context->user)
                ->allows(Ability::VIEW->value, $watcher));

        return ['mailbox' => [
            ...$this->serialize($mailbox, $context),
            'watchers' => $watchers
                ->map(fn (MailboxWatcher $watcher): array => [
                    'id' => $watcher->id,
                    'name' => $watcher->name,
                    'group' => $watcher->group,
                    'flow_id' => $watcher->flow_id,
                    'flow_name' => $watcher->flow?->name,
                    'is_active' => $watcher->is_active,
                    'extract_enabled' => $watcher->extract_enabled,
                    'extract_mode' => $watcher->extract_mode,
                    'extract_expression' => $watcher->extract_expression,
                    'timeout' => $watcher->timeout,
                    'scope' => $watcher->scope,
                    'team_id' => $watcher->team_id,
                    'rules' => $watcher->rules
                        ->map(fn (MailboxWatcherRule $rule): array => [
                            'group' => $rule->rule_group,
                            'field' => $rule->field->value,
                            'operator' => $rule->operator->value,
                            'value' => $rule->value,
                        ])
                        ->values()
                        ->all(),
                ])
                ->values()
                ->all(),
        ]];
    }

    /**
     * @param  Arguments  $arguments
     * @return array<string, mixed>
     */
    private function update(array $arguments, McpToolContext $context): array
    {
        $validated = validator($arguments, [
            'mailbox_id' => ['required', 'string'],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'group' => ['sometimes', 'nullable', 'string', 'max:100'],
        ])->validate();
        $mailbox = $this->mailbox((string) $validated['mailbox_id'], $context, Ability::UPDATE);
        unset($validated['mailbox_id']);
        if ($validated === []) {
            throw ValidationException::withMessages(['mailbox' => 'Provide at least one mailbox change.']);
        }
        foreach (['description', 'group'] as $field) {
            if (array_key_exists($field, $validated) && is_string($validated[$field])) {
                $validated[$field] = trim($validated[$field]) ?: null;
            }
        }
        $mailbox->update($validated);
        $mailbox->refresh();

        return ['mailbox' => $this->serialize($mailbox, $context)];
    }

    private function mailbox(string $id, McpToolContext $context, Ability $ability): Mailbox
    {
        $mailbox = Mailbox::query()
            ->where('workspace_id', $context->workspace->id)
            ->where('stale', false)
            ->with(['domain', 'user:id,name', 'team:id,name'])
            ->withCount([
                'emails',
                'emails as unread_count' => fn (Builder $query) => $query->where('is_read', false),
            ])
            ->find($id);
        if (! $mailbox || Gate::forUser($context->user)->denies($ability->value, $mailbox)) {
            throw ValidationException::withMessages([
                'mailbox_id' => 'Mailbox not found or not accessible.',
            ]);
        }

        return $mailbox;
    }

    /**
     * @param  Builder<Mailbox>  $query
     * @param  array<string, mixed>  $validated
     */
    private function applyGroup(Builder $query, array $validated): void
    {
        if (! array_key_exists('group', $validated)) {
            return;
        }
        $group = is_string($validated['group']) ? trim($validated['group']) : null;
        $group === null || $group === ''
            ? $query->whereNull('group')
            : $query->where('group', $group);
    }

    /** @return array<string, mixed> */
    private function serialize(Mailbox $mailbox, McpToolContext $context): array
    {
        $mailbox->loadMissing(['domain', 'user:id,name', 'team:id,name']);

        return [
            'id' => $mailbox->id,
            'address' => $mailbox->address,
            'slug' => $mailbox->slug,
            'description' => $mailbox->description,
            'group' => $mailbox->group,
            'domain_id' => $mailbox->domain_id,
            'domain_name' => $mailbox->domain->name,
            'is_active' => $mailbox->is_active,
            'emails_count' => (int) ($mailbox->emails_count ?? 0),
            'unread_count' => (int) ($mailbox->unread_count ?? 0),
            'scope' => $mailbox->scope,
            'owner_id' => $mailbox->user_id,
            'owner_name' => $mailbox->user?->name,
            'team_id' => $mailbox->team_id,
            'team_name' => $mailbox->team?->name,
            'created_at' => $mailbox->created_at?->toIso8601String(),
            'updated_at' => $mailbox->updated_at?->toIso8601String(),
            'capabilities' => [
                'view' => Gate::forUser($context->user)->allows(Ability::VIEW->value, $mailbox),
                'update_metadata' => Gate::forUser($context->user)->allows(Ability::UPDATE->value, $mailbox),
            ],
        ];
    }

    private function ensureEnabled(): void
    {
        if (! $this->features->enabled('mailbox_enabled')) {
            throw ValidationException::withMessages(['mailboxes' => 'Mailboxes are disabled for this workspace.']);
        }
    }
}
