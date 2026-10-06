<?php

namespace App\Services\Flow;

use App\Authorization\AuthorizationContextFactory;
use App\Authorization\Visibility\SharedResourceVisibility;
use App\Enums\Authorization\Ability;
use App\Models\Flow;
use App\Models\User;
use App\Models\WorkspaceProxy;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class FlowSettingsUpdateService
{
    private const SETTINGS = [
        'finally_enabled',
        'queue_index',
        'proxy_mode',
        'workspace_proxy_id',
    ];

    public function __construct(
        private readonly AuthorizationContextFactory $contexts,
        private readonly SharedResourceVisibility $visibility,
    ) {}

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(Flow $flow, User $actor, array $attributes): Flow
    {
        Gate::forUser($actor)->authorize(Ability::UPDATE->value, $flow);

        $validated = validator($attributes, [
            'finally_enabled' => ['sometimes', 'boolean'],
            'queue_index' => [
                'sometimes',
                'nullable',
                'integer',
                'min:1',
                'max:'.config()->integer('puppetflow.queues_counter', 1),
            ],
            'proxy_mode' => ['sometimes', Rule::in(['none', 'auto', 'specific'])],
            'workspace_proxy_id' => ['sometimes', 'nullable', 'integer'],
        ])->validate();
        $settings = array_intersect_key($validated, array_flip(self::SETTINGS));
        if ($settings === []) {
            throw ValidationException::withMessages([
                'settings' => 'Provide at least one flow setting to update.',
            ]);
        }

        return DB::transaction(function () use ($flow, $actor, $settings): Flow {
            $locked = Flow::query()
                ->where('workspace_id', $flow->workspace_id)
                ->whereKey($flow->id)
                ->lockForUpdate()
                ->firstOrFail();
            Gate::forUser($actor)->authorize(Ability::UPDATE->value, $locked);

            $proxyChanged = array_key_exists('proxy_mode', $settings)
                || array_key_exists('workspace_proxy_id', $settings);
            if ($proxyChanged) {
                $proxyMode = (string) ($settings['proxy_mode'] ?? $locked->proxy_mode ?? 'none');
                $proxyId = array_key_exists('workspace_proxy_id', $settings)
                    ? $settings['workspace_proxy_id']
                    : $locked->workspace_proxy_id;
                if ($proxyMode !== 'specific') {
                    $settings['workspace_proxy_id'] = null;
                } else {
                    if (! is_int($proxyId)) {
                        throw ValidationException::withMessages([
                            'workspace_proxy_id' => 'Select a proxy when proxy_mode is specific.',
                        ]);
                    }
                    $query = WorkspaceProxy::query()->whereKey($proxyId);
                    $this->visibility->applyUse(
                        $query,
                        $this->contexts->for($actor, $locked->workspace_id),
                        scopeColumn: 'visibility',
                        alwaysVisibleColumn: 'managed_by_env',
                    );
                    if (! $query->lockForUpdate()->first() instanceof WorkspaceProxy) {
                        throw ValidationException::withMessages([
                            'workspace_proxy_id' => 'The selected proxy is not available to you.',
                        ]);
                    }
                    $settings['workspace_proxy_id'] = $proxyId;
                }
            }

            $locked->update($settings);

            return $locked->fresh() ?? $locked;
        }, 3);
    }
}
