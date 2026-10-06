<?php

namespace App\Services\Mcp\Tools;

use App\Authorization\AuthorizationContextFactory;
use App\Authorization\Visibility\SharedResourceVisibility;
use App\Enums\Authorization\Ability;
use App\Models\AiModel;
use App\Services\FeatureFlags\FeatureFlagService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * @phpstan-type Arguments array<string, mixed>
 * @phpstan-type ToolDefinition array{name: string, description: string, inputSchema: array<string, mixed>}
 */
final class AiModelMcpTools implements McpToolHandler
{
    public const TOOL_NAMES = [
        'search_ai_models',
        'get_ai_model',
        'update_ai_model',
    ];

    public function __construct(
        private readonly AuthorizationContextFactory $contexts,
        private readonly SharedResourceVisibility $visibility,
        private readonly FeatureFlagService $features,
    ) {}

    /** @return list<ToolDefinition> */
    public function definitions(): array
    {
        $modelId = ['type' => 'string', 'description' => 'AI Model resource ID returned by search_ai_models.'];

        return [
            [
                'name' => 'search_ai_models',
                'description' => 'Search visible AI Model resources and return provider, model ID, capabilities, group, scope, and availability.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'properties' => [
                        'query' => ['type' => 'string', 'description' => 'Search name, provider model ID, group, or resource ID.'],
                        'capability' => ['type' => 'string', 'description' => 'Require a capability such as text, image, audio, or tools.'],
                        'group' => ['type' => ['string', 'null'], 'description' => 'Exact group. Null selects ungrouped models.'],
                        'scope' => ['type' => 'string', 'enum' => ['user', 'workspace', 'team']],
                        'active_only' => ['type' => 'boolean', 'default' => false],
                        'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 100, 'default' => 20],
                    ],
                ],
            ],
            [
                'name' => 'get_ai_model',
                'description' => 'Get safe AI Model metadata, provider integration identity, capabilities, scope, and permissions.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['ai_model_id'],
                    'properties' => ['ai_model_id' => $modelId],
                ],
            ],
            [
                'name' => 'update_ai_model',
                'description' => 'Rename, regroup, or enable or disable an AI Model resource without changing its provider integration.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['ai_model_id'],
                    'anyOf' => [
                        ['required' => ['name']],
                        ['required' => ['group']],
                        ['required' => ['is_active']],
                    ],
                    'properties' => [
                        'ai_model_id' => $modelId,
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
            'search_ai_models' => $this->search($arguments, $context),
            'get_ai_model' => $this->get($arguments, $context),
            'update_ai_model' => $this->update($arguments, $context),
            default => throw ValidationException::withMessages(['name' => 'Unknown AI Model tool.']),
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
            'capability' => ['sometimes', 'string', 'max:100', 'regex:/^[a-zA-Z0-9_-]+$/'],
            'group' => ['sometimes', 'nullable', 'string', 'max:100'],
            'scope' => ['sometimes', 'string', 'in:user,workspace,team'],
            'active_only' => ['sometimes', 'boolean'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ])->validate();
        $query = AiModel::query()
            ->where('stale', false)
            ->with(['aiIntegration:id,name,provider', 'user:id,name', 'team:id,name']);
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
                ->orWhere('ai_model_id', 'like', "%{$search}%")
                ->orWhere('group', 'like', "%{$search}%"));
        }
        if (($capability = trim((string) ($validated['capability'] ?? ''))) !== '') {
            $query->whereJsonContains("capabilities->{$capability}", true);
        }
        $this->applyGroup($query, $validated);
        if (isset($validated['scope'])) {
            $query->where('scope', $validated['scope']);
        }
        if (($validated['active_only'] ?? false) === true) {
            $query->where('is_active', true);
        }

        $models = $query
            ->orderBy('group')
            ->orderBy('name')
            ->limit((int) ($validated['limit'] ?? 20))
            ->get()
            ->filter(fn (AiModel $model): bool => Gate::forUser($context->user)
                ->allows(Ability::VIEW->value, $model))
            ->map(fn (AiModel $model): array => $this->serialize($model, $context))
            ->values()
            ->all();

        return ['ai_models' => $models];
    }

    /**
     * @param  Arguments  $arguments
     * @return array<string, mixed>
     */
    private function get(array $arguments, McpToolContext $context): array
    {
        $model = $this->model(
            McpToolArguments::string($arguments, 'ai_model_id'),
            $context,
            Ability::VIEW,
        );

        return ['ai_model' => $this->serialize($model, $context)];
    }

    /**
     * @param  Arguments  $arguments
     * @return array<string, mixed>
     */
    private function update(array $arguments, McpToolContext $context): array
    {
        $validated = validator($arguments, [
            'ai_model_id' => ['required', 'string'],
            'name' => ['sometimes', 'string', 'max:255'],
            'group' => ['sometimes', 'nullable', 'string', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
        ])->validate();
        $model = $this->model((string) $validated['ai_model_id'], $context, Ability::UPDATE);
        unset($validated['ai_model_id']);
        if ($validated === []) {
            throw ValidationException::withMessages(['ai_model' => 'Provide at least one AI Model change.']);
        }
        if (array_key_exists('name', $validated)) {
            $validated['name'] = trim((string) $validated['name']);
            if ($validated['name'] === '') {
                throw ValidationException::withMessages(['name' => 'The AI Model name is required.']);
            }
        }
        if (array_key_exists('group', $validated) && is_string($validated['group'])) {
            $validated['group'] = trim($validated['group']) ?: null;
        }
        $model->update($validated);
        $model->refresh();

        return ['ai_model' => $this->serialize($model, $context)];
    }

    private function model(string $id, McpToolContext $context, Ability $ability): AiModel
    {
        $model = AiModel::query()
            ->where('workspace_id', $context->workspace->id)
            ->where('stale', false)
            ->with(['aiIntegration:id,name,provider', 'user:id,name', 'team:id,name'])
            ->find($id);
        if (! $model || Gate::forUser($context->user)->denies($ability->value, $model)) {
            throw ValidationException::withMessages([
                'ai_model_id' => 'AI Model not found or not accessible.',
            ]);
        }

        return $model;
    }

    /**
     * @param  Builder<AiModel>  $query
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
    private function serialize(AiModel $model, McpToolContext $context): array
    {
        $model->loadMissing(['aiIntegration:id,name,provider', 'user:id,name', 'team:id,name']);

        return [
            'id' => $model->id,
            'name' => $model->name,
            'provider_model_id' => $model->ai_model_id,
            'capabilities' => collect($model->capabilities ?? [])
                ->filter(fn (mixed $value, mixed $key): bool => is_string($key) && is_bool($value))
                ->all(),
            'group' => $model->group,
            'is_active' => $model->is_active,
            'integration_id' => $model->ai_integration_id,
            'integration_name' => $model->aiIntegration?->name,
            'provider' => $model->aiIntegration?->getRawOriginal('provider'),
            'scope' => $model->scope,
            'owner_id' => $model->user_id,
            'owner_name' => $model->user?->name,
            'team_id' => $model->team_id,
            'team_name' => $model->team?->name,
            'created_at' => $model->created_at?->toIso8601String(),
            'updated_at' => $model->updated_at?->toIso8601String(),
            'permissions' => [
                'view' => Gate::forUser($context->user)->allows(Ability::VIEW->value, $model),
                'use' => Gate::forUser($context->user)->allows(Ability::USE->value, $model),
                'update_metadata' => Gate::forUser($context->user)->allows(Ability::UPDATE->value, $model),
            ],
        ];
    }

    private function ensureEnabled(): void
    {
        if (! $this->features->enabled('ai_enabled')) {
            throw ValidationException::withMessages(['ai_models' => 'AI Models are disabled for this workspace.']);
        }
    }
}
