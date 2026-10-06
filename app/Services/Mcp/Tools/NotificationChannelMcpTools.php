<?php

namespace App\Services\Mcp\Tools;

use App\Authorization\AuthorizationContextFactory;
use App\Authorization\Visibility\SharedResourceVisibility;
use App\Enums\Authorization\Ability;
use App\Models\NotificationChannel;
use App\Services\FeatureFlags\FeatureFlagService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * @phpstan-type Arguments array<string, mixed>
 * @phpstan-type ToolDefinition array{name: string, description: string, inputSchema: array<string, mixed>}
 */
final class NotificationChannelMcpTools implements McpToolHandler
{
    public const TOOL_NAMES = [
        'search_notification_channels',
        'get_notification_channel',
        'update_notification_channel',
    ];

    public function __construct(
        private readonly AuthorizationContextFactory $contexts,
        private readonly SharedResourceVisibility $visibility,
        private readonly FeatureFlagService $features,
    ) {}

    /** @return list<ToolDefinition> */
    public function definitions(): array
    {
        $channelId = ['type' => 'string', 'description' => 'Channel ID returned by search_notification_channels.'];

        return [
            [
                'name' => 'search_notification_channels',
                'description' => 'Search visible notification channels. Provider secrets and integration credentials are never returned.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'properties' => [
                        'query' => ['type' => 'string', 'description' => 'Search name, provider, group, or ID.'],
                        'provider' => ['type' => 'string'],
                        'group' => ['type' => ['string', 'null'], 'description' => 'Exact group. Null selects ungrouped channels.'],
                        'scope' => ['type' => 'string', 'enum' => ['user', 'workspace', 'team']],
                        'active_only' => ['type' => 'boolean', 'default' => false],
                        'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 100, 'default' => 20],
                    ],
                ],
            ],
            [
                'name' => 'get_notification_channel',
                'description' => 'Get safe notification channel metadata and its integration identity without returning configuration secrets.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['channel_id'],
                    'properties' => ['channel_id' => $channelId],
                ],
            ],
            [
                'name' => 'update_notification_channel',
                'description' => 'Rename, regroup, or enable or disable a notification channel without changing provider configuration.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['channel_id'],
                    'anyOf' => [
                        ['required' => ['name']],
                        ['required' => ['group']],
                        ['required' => ['is_active']],
                    ],
                    'properties' => [
                        'channel_id' => $channelId,
                        'name' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 255],
                        'group' => ['type' => ['string', 'null'], 'maxLength' => 100],
                        'is_active' => ['type' => 'boolean'],
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
            'search_notification_channels' => $this->search($arguments, $context),
            'get_notification_channel' => $this->get($arguments, $context),
            'update_notification_channel' => $this->update($arguments, $context),
            default => throw ValidationException::withMessages(['name' => 'Unknown notification channel tool.']),
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
            'provider' => ['sometimes', 'string', 'max:100'],
            'group' => ['sometimes', 'nullable', 'string', 'max:100'],
            'scope' => ['sometimes', 'string', 'in:user,workspace,team'],
            'active_only' => ['sometimes', 'boolean'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ])->validate();
        $query = NotificationChannel::query()
            ->where('stale', false)
            ->with(['messengerIntegration:id,name,provider', 'user:id,name', 'team:id,name']);
        $this->visibility->applyView(
            $query,
            $this->contexts->for($context->user, $context->workspace->id),
            scopeColumn: 'scope',
        );
        $search = trim((string) ($validated['query'] ?? ''));
        if ($search !== '') {
            $query->where(fn (Builder $query) => $query
                ->where('id', 'like', "%{$search}%")
                ->orWhere('name', 'like', "%{$search}%")
                ->orWhere('provider', 'like', "%{$search}%")
                ->orWhere('group', 'like', "%{$search}%"));
        }
        if (($provider = trim((string) ($validated['provider'] ?? ''))) !== '') {
            $query->where('provider', $provider);
        }
        $this->applyGroup($query, $validated);
        if (isset($validated['scope'])) {
            $query->where('scope', $validated['scope']);
        }
        if (($validated['active_only'] ?? false) === true) {
            $query->where('is_active', true);
        }

        $channels = $query
            ->orderBy('group')
            ->orderBy('name')
            ->limit((int) ($validated['limit'] ?? 20))
            ->get()
            ->filter(fn (NotificationChannel $channel): bool => Gate::forUser($context->user)
                ->allows(Ability::VIEW->value, $channel))
            ->map(fn (NotificationChannel $channel): array => $this->serialize($channel, $context))
            ->values()
            ->all();

        return ['notification_channels' => $channels];
    }

    /**
     * @param  Arguments  $arguments
     * @return array<string, mixed>
     */
    private function get(array $arguments, McpToolContext $context): array
    {
        $channel = $this->channel(
            McpToolArguments::string($arguments, 'channel_id'),
            $context,
            Ability::VIEW,
        );

        return ['notification_channel' => $this->serialize($channel, $context)];
    }

    /**
     * @param  Arguments  $arguments
     * @return array<string, mixed>
     */
    private function update(array $arguments, McpToolContext $context): array
    {
        $validated = validator($arguments, [
            'channel_id' => ['required', 'string'],
            'name' => ['sometimes', 'string', 'max:255'],
            'group' => ['sometimes', 'nullable', 'string', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
        ])->validate();
        $channel = $this->channel((string) $validated['channel_id'], $context, Ability::UPDATE);
        unset($validated['channel_id']);
        if ($validated === []) {
            throw ValidationException::withMessages(['channel' => 'Provide at least one channel change.']);
        }
        if (array_key_exists('name', $validated)) {
            $validated['name'] = trim((string) $validated['name']);
            if ($validated['name'] === '') {
                throw ValidationException::withMessages(['name' => 'The channel name is required.']);
            }
        }
        if (array_key_exists('group', $validated) && is_string($validated['group'])) {
            $validated['group'] = trim($validated['group']) ?: null;
        }
        $channel->update($validated);
        $channel->refresh();

        return ['notification_channel' => $this->serialize($channel, $context)];
    }

    private function channel(string $id, McpToolContext $context, Ability $ability): NotificationChannel
    {
        $channel = NotificationChannel::query()
            ->where('workspace_id', $context->workspace->id)
            ->where('stale', false)
            ->with(['messengerIntegration:id,name,provider', 'user:id,name', 'team:id,name'])
            ->find($id);
        if (! $channel || Gate::forUser($context->user)->denies($ability->value, $channel)) {
            throw ValidationException::withMessages([
                'channel_id' => 'Notification channel not found or not accessible.',
            ]);
        }

        return $channel;
    }

    /**
     * @param  Builder<NotificationChannel>  $query
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
    private function serialize(NotificationChannel $channel, McpToolContext $context): array
    {
        $channel->loadMissing(['messengerIntegration:id,name,provider', 'user:id,name', 'team:id,name']);

        return [
            'id' => $channel->id,
            'name' => $channel->name,
            'provider' => $channel->provider,
            'group' => $channel->group,
            'is_active' => $channel->is_active,
            'integration_id' => $channel->messenger_integration_id,
            'integration_name' => $channel->messengerIntegration?->name,
            'scope' => $channel->scope,
            'owner_id' => $channel->user_id,
            'owner_name' => $channel->user?->name,
            'team_id' => $channel->team_id,
            'team_name' => $channel->team?->name,
            'created_at' => $channel->created_at?->toIso8601String(),
            'updated_at' => $channel->updated_at?->toIso8601String(),
            'capabilities' => [
                'view' => Gate::forUser($context->user)->allows(Ability::VIEW->value, $channel),
                'update_metadata' => Gate::forUser($context->user)->allows(Ability::UPDATE->value, $channel),
            ],
        ];
    }

    private function ensureEnabled(): void
    {
        if (! $this->features->enabled('messenger_enabled')) {
            throw ValidationException::withMessages([
                'notification_channels' => 'Notification channels are disabled for this workspace.',
            ]);
        }
    }
}
