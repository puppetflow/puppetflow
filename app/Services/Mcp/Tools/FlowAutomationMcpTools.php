<?php

/*
 * Explicit proprietary scope: shared trigger and action scopes in this file implement paid Puppetflow features
 * and are licensed under the Puppetflow Proprietary License. See LICENSE_PROPRIETARY.md.
 */

namespace App\Services\Mcp\Tools;

use App\Authorization\ResourceAssignmentValidator;
use App\Enums\Authorization\Ability;
use App\Models\Flow;
use App\Models\FlowAction;
use App\Models\FlowTrigger;
use App\Services\FeatureFlags\FeatureFlagService;
use Cron\CronExpression;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** @phpstan-type Arguments array<string, mixed> */
final class FlowAutomationMcpTools implements McpToolHandler
{
    private const TOOL_NAMES = [
        'list_flow_triggers',
        'create_flow_trigger',
        'update_flow_trigger',
        'delete_flow_trigger',
        'list_flow_actions',
        'create_flow_action',
        'update_flow_action',
        'delete_flow_action',
    ];

    private const FORBIDDEN_WEBHOOK_HEADERS = [
        'connection',
        'content-length',
        'host',
        'proxy-authorization',
        'transfer-encoding',
    ];

    public function __construct(
        private readonly McpResourceResolver $resources,
        private readonly FeatureFlagService $features,
        private readonly ResourceAssignmentValidator $assignments,
    ) {}

    public function definitions(): array
    {
        $flowId = ['type' => 'string', 'description' => 'MCP-enabled flow ID.'];
        $triggerId = ['type' => 'string', 'pattern' => '^trig_[A-Za-z0-9]{12}$'];
        $actionId = ['type' => 'string', 'pattern' => '^act_[A-Za-z0-9]{12}$'];
        $scope = ['type' => 'string', 'enum' => ['owner', 'workspace', 'team'], 'default' => 'owner'];
        $teamId = ['type' => ['string', 'null'], 'pattern' => '^team_[A-Za-z0-9]{12}$'];
        $triggerConfig = [
            'type' => 'object',
            'additionalProperties' => false,
            'description' => 'For cron, provide cron_expression such as "0 5 * * *". For webhook, merge_post_data defaults to true.',
            'properties' => [
                'cron_expression' => ['type' => 'string'],
                'merge_post_data' => ['type' => 'boolean'],
            ],
        ];
        $actionConfig = [
            'type' => 'object',
            'additionalProperties' => false,
            'properties' => [
                'url' => ['type' => 'string', 'format' => 'uri', 'description' => 'HTTP or HTTPS webhook destination.'],
                'secret' => ['type' => ['string', 'null'], 'description' => 'Optional HMAC-SHA256 signing secret.'],
                'headers' => [
                    'type' => ['array', 'null'],
                    'maxItems' => 20,
                    'items' => [
                        'type' => 'object',
                        'additionalProperties' => false,
                        'required' => ['key', 'value'],
                        'properties' => [
                            'key' => ['type' => 'string'],
                            'value' => ['type' => 'string'],
                        ],
                    ],
                ],
            ],
        ];

        return [
            [
                'name' => 'list_flow_triggers',
                'description' => 'List cron and webhook triggers visible to the connected user for an MCP-enabled flow. Webhook tokens and endpoint URLs are never returned.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['flow_id'],
                    'properties' => [
                        'flow_id' => $flowId,
                        'type' => ['type' => 'string', 'enum' => ['webhook', 'cron']],
                        'is_active' => ['type' => 'boolean'],
                    ],
                ],
            ],
            [
                'name' => 'create_flow_trigger',
                'description' => 'Create a cron or webhook trigger for an MCP-enabled flow. For requests such as "run every day at 5 AM", create a cron trigger with cron_expression "0 5 * * *". Cron schedules use the trigger owner\'s timezone. input_template contains Flow Input values supplied whenever this trigger starts the flow.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['flow_id', 'type', 'label'],
                    'properties' => [
                        'flow_id' => $flowId,
                        'type' => ['type' => 'string', 'enum' => ['webhook', 'cron']],
                        'label' => ['type' => 'string', 'maxLength' => 255],
                        'group' => ['type' => ['string', 'null'], 'maxLength' => 100],
                        'input_template' => ['type' => ['object', 'null'], 'additionalProperties' => true],
                        'config' => $triggerConfig,
                        'is_active' => ['type' => 'boolean', 'default' => true],
                        'scope' => $scope,
                        'team_id' => $teamId,
                    ],
                ],
            ],
            [
                'name' => 'update_flow_trigger',
                'description' => 'Update a cron or webhook trigger. The trigger type and owner cannot be changed. Omitted fields keep their current values.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['trigger_id'],
                    'properties' => [
                        'trigger_id' => $triggerId,
                        'label' => ['type' => 'string', 'maxLength' => 255],
                        'group' => ['type' => ['string', 'null'], 'maxLength' => 100],
                        'input_template' => ['type' => ['object', 'null'], 'additionalProperties' => true],
                        'config' => $triggerConfig,
                        'is_active' => ['type' => 'boolean'],
                        'scope' => $scope,
                        'team_id' => $teamId,
                    ],
                ],
            ],
            [
                'name' => 'delete_flow_trigger',
                'description' => 'Permanently delete a flow trigger.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['trigger_id'],
                    'properties' => ['trigger_id' => $triggerId],
                ],
            ],
            [
                'name' => 'list_flow_actions',
                'description' => 'List post-run webhook actions visible to the connected user for an MCP-enabled flow. Webhook URLs, signing secrets, and header values are never returned.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['flow_id'],
                    'properties' => [
                        'flow_id' => $flowId,
                        'is_active' => ['type' => 'boolean'],
                        'fire_on_error' => ['type' => 'boolean'],
                    ],
                ],
            ],
            [
                'name' => 'create_flow_action',
                'description' => 'Create a post-run webhook action for an MCP-enabled flow. The webhook receives flow and run identifiers, status, output, and error details. Optional signing secrets and header values are accepted but never returned.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['flow_id', 'label', 'config'],
                    'properties' => [
                        'flow_id' => $flowId,
                        'label' => ['type' => 'string', 'maxLength' => 255],
                        'group' => ['type' => ['string', 'null'], 'maxLength' => 100],
                        'config' => [...$actionConfig, 'required' => ['url']],
                        'is_active' => ['type' => 'boolean', 'default' => true],
                        'fire_on_error' => ['type' => 'boolean', 'default' => false],
                        'export_artifacts_screenshots' => ['type' => ['boolean', 'null']],
                        'export_artifacts_downloads' => ['type' => ['boolean', 'null']],
                        'export_artifacts_recording' => ['type' => ['boolean', 'null']],
                        'scope' => $scope,
                        'team_id' => $teamId,
                    ],
                ],
            ],
            [
                'name' => 'update_flow_action',
                'description' => 'Update a post-run webhook action. Omitted fields and omitted config keys keep their current values. Set secret to null or headers to an empty array to clear them. Sensitive configuration is never returned.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['action_id'],
                    'properties' => [
                        'action_id' => $actionId,
                        'label' => ['type' => 'string', 'maxLength' => 255],
                        'group' => ['type' => ['string', 'null'], 'maxLength' => 100],
                        'config' => $actionConfig,
                        'is_active' => ['type' => 'boolean'],
                        'fire_on_error' => ['type' => 'boolean'],
                        'export_artifacts_screenshots' => ['type' => ['boolean', 'null']],
                        'export_artifacts_downloads' => ['type' => ['boolean', 'null']],
                        'export_artifacts_recording' => ['type' => ['boolean', 'null']],
                        'scope' => $scope,
                        'team_id' => $teamId,
                    ],
                ],
            ],
            [
                'name' => 'delete_flow_action',
                'description' => 'Permanently delete a post-run webhook action.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['action_id'],
                    'properties' => ['action_id' => $actionId],
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
        return match ($name) {
            'list_flow_triggers' => $this->listTriggers($arguments, $context),
            'create_flow_trigger' => $this->createTrigger($arguments, $context),
            'update_flow_trigger' => $this->updateTrigger($arguments, $context),
            'delete_flow_trigger' => $this->deleteTrigger($arguments, $context),
            'list_flow_actions' => $this->listActions($arguments, $context),
            'create_flow_action' => $this->createAction($arguments, $context),
            'update_flow_action' => $this->updateAction($arguments, $context),
            'delete_flow_action' => $this->deleteAction($arguments, $context),
            default => throw ValidationException::withMessages(['name' => 'Unknown flow automation tool.']),
        };
    }

    /** @param Arguments $arguments
     * @return array<string, mixed>
     */
    private function listTriggers(array $arguments, McpToolContext $context): array
    {
        $data = validator($arguments, [
            'flow_id' => ['required', 'string'],
            'type' => ['sometimes', Rule::in(['webhook', 'cron'])],
            'is_active' => ['sometimes', 'boolean'],
        ])->validate();
        $flow = $this->resources->flow($data['flow_id'], $context);
        $query = FlowTrigger::query()->where('flow_id', $flow->id)->with('flow');
        if (isset($data['type'])) {
            $query->where('type', $data['type']);
        }
        if (array_key_exists('is_active', $data)) {
            $query->where('is_active', $data['is_active']);
        }

        return ['triggers' => $query->latest()->get()
            ->filter(fn (FlowTrigger $trigger): bool => Gate::forUser($context->user)->allows(Ability::VIEW->value, $trigger))
            ->map(fn (FlowTrigger $trigger): array => $this->serializeTrigger($trigger))
            ->values()];
    }

    /** @param Arguments $arguments
     * @return array<string, mixed>
     */
    private function createTrigger(array $arguments, McpToolContext $context): array
    {
        $flow = $this->resources->flow(trim(McpToolArguments::string($arguments, 'flow_id')), $context);
        $this->authorizeFlowUpdate($flow, $context);
        $data = $this->validateTrigger($arguments, null, true);
        $scope = is_string($data['scope'] ?? null) ? $data['scope'] : 'owner';
        $teamId = $scope === 'team' && is_string($data['team_id'] ?? null) ? $data['team_id'] : null;
        $this->assignments->ensureOwnerSatisfiesScope($context->workspace->id, $context->user->id, $scope, $teamId);

        $trigger = FlowTrigger::create([
            ...$data,
            'flow_id' => $flow->id,
            'user_id' => $context->user->id,
            'scope' => $scope,
            'team_id' => $teamId,
        ]);
        $trigger->setRelation('flow', $flow);

        return ['trigger' => $this->serializeTrigger($trigger)];
    }

    /** @param Arguments $arguments
     * @return array<string, mixed>
     */
    private function updateTrigger(array $arguments, McpToolContext $context): array
    {
        $trigger = $this->trigger($arguments, $context, Ability::UPDATE);
        $data = $this->validateTrigger($arguments, $trigger->type, false);
        $this->applyScope($trigger, $data, $context);
        $trigger->update($data);

        return ['trigger' => $this->serializeTrigger($trigger->refresh())];
    }

    /** @param Arguments $arguments
     * @return array<string, mixed>
     */
    private function deleteTrigger(array $arguments, McpToolContext $context): array
    {
        $trigger = $this->trigger($arguments, $context, Ability::DELETE);
        $id = $trigger->id;
        $trigger->delete();

        return ['deleted' => true, 'trigger_id' => $id];
    }

    /** @param Arguments $arguments
     * @return array<string, mixed>
     */
    private function listActions(array $arguments, McpToolContext $context): array
    {
        $data = validator($arguments, [
            'flow_id' => ['required', 'string'],
            'is_active' => ['sometimes', 'boolean'],
            'fire_on_error' => ['sometimes', 'boolean'],
        ])->validate();
        $flow = $this->resources->flow($data['flow_id'], $context);
        $query = FlowAction::query()->where('flow_id', $flow->id)->with('flow');
        foreach (['is_active', 'fire_on_error'] as $filter) {
            if (array_key_exists($filter, $data)) {
                $query->where($filter, $data[$filter]);
            }
        }

        return ['actions' => $query->latest()->get()
            ->filter(fn (FlowAction $action): bool => Gate::forUser($context->user)->allows(Ability::VIEW->value, $action))
            ->map(fn (FlowAction $action): array => $this->serializeAction($action))
            ->values()];
    }

    /** @param Arguments $arguments
     * @return array<string, mixed>
     */
    private function createAction(array $arguments, McpToolContext $context): array
    {
        $flow = $this->resources->flow(trim(McpToolArguments::string($arguments, 'flow_id')), $context);
        $this->authorizeFlowUpdate($flow, $context);
        $data = $this->validateAction($arguments, true);
        $scope = is_string($data['scope'] ?? null) ? $data['scope'] : 'owner';
        $teamId = $scope === 'team' && is_string($data['team_id'] ?? null) ? $data['team_id'] : null;
        $this->assignments->ensureOwnerSatisfiesScope($context->workspace->id, $context->user->id, $scope, $teamId);

        $action = FlowAction::create([
            ...$data,
            'flow_id' => $flow->id,
            'user_id' => $context->user->id,
            'type' => 'webhook',
            'scope' => $scope,
            'team_id' => $teamId,
        ]);
        $action->setRelation('flow', $flow);

        return ['action' => $this->serializeAction($action)];
    }

    /** @param Arguments $arguments
     * @return array<string, mixed>
     */
    private function updateAction(array $arguments, McpToolContext $context): array
    {
        $action = $this->action($arguments, $context, Ability::UPDATE);
        $data = $this->validateAction($arguments, false);
        if (array_key_exists('config', $data)) {
            $current = $action->config;
            $incoming = is_array($data['config']) ? $data['config'] : [];
            $data['config'] = array_replace(is_array($current) ? $current : [], $incoming);
        }
        $this->applyScope($action, $data, $context);
        $action->update($data);

        return ['action' => $this->serializeAction($action->refresh())];
    }

    /** @param Arguments $arguments
     * @return array<string, mixed>
     */
    private function deleteAction(array $arguments, McpToolContext $context): array
    {
        $action = $this->action($arguments, $context, Ability::DELETE);
        $id = $action->id;
        $action->delete();

        return ['deleted' => true, 'action_id' => $id];
    }

    /**
     * @param  Arguments  $arguments
     * @return array<string, mixed>
     */
    private function validateTrigger(array $arguments, ?string $existingType, bool $creating): array
    {
        $data = validator($arguments, [
            'type' => [$creating ? 'required' : 'prohibited', Rule::in(['webhook', 'cron'])],
            'label' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'group' => ['sometimes', 'nullable', 'string', 'max:100'],
            'input_template' => ['sometimes', 'nullable', 'array'],
            'config' => ['sometimes', 'array'],
            'is_active' => ['sometimes', 'boolean'],
            'scope' => ['sometimes', Rule::in($this->features->allowedScopes())],
            'team_id' => ['sometimes', 'nullable', 'string'],
        ])->validate();
        unset($data['flow_id'], $data['trigger_id']);
        $type = $creating ? $data['type'] : $existingType;
        if ($type === 'cron' && ($creating || array_key_exists('config', $data))) {
            $config = is_array($data['config'] ?? null) ? $data['config'] : [];
            $expression = $config['cron_expression'] ?? null;
            if (! is_string($expression) || ! CronExpression::isValidExpression($expression)) {
                throw ValidationException::withMessages(['config.cron_expression' => 'A valid cron expression is required.']);
            }
            $data['config'] = ['cron_expression' => $expression];
        } elseif (array_key_exists('config', $data)) {
            $mergePostData = $data['config']['merge_post_data'] ?? true;
            if (! is_bool($mergePostData)) {
                throw ValidationException::withMessages(['config.merge_post_data' => 'The merge_post_data value must be boolean.']);
            }
            $data['config'] = ['merge_post_data' => $mergePostData];
        } elseif ($creating) {
            $data['config'] = ['merge_post_data' => true];
        }

        return $data;
    }

    /**
     * @param  Arguments  $arguments
     * @return array<string, mixed>
     */
    private function validateAction(array $arguments, bool $creating): array
    {
        $data = validator($arguments, [
            'label' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'group' => ['sometimes', 'nullable', 'string', 'max:100'],
            'config' => [$creating ? 'required' : 'sometimes', 'array:url,secret,headers'],
            'config.url' => [$creating ? 'required' : 'sometimes', 'string', 'max:2048', 'url:http,https'],
            'config.secret' => ['sometimes', 'nullable', 'string', 'max:4096'],
            'config.headers' => ['sometimes', 'nullable', 'array', 'max:20'],
            'config.headers.*' => ['array:key,value'],
            'config.headers.*.key' => ['required', 'string', 'max:100', 'not_regex:/[\r\n:]/'],
            'config.headers.*.value' => ['required', 'string', 'max:4096', 'not_regex:/[\r\n]/'],
            'is_active' => ['sometimes', 'boolean'],
            'fire_on_error' => ['sometimes', 'boolean'],
            'export_artifacts_screenshots' => ['sometimes', 'nullable', 'boolean'],
            'export_artifacts_downloads' => ['sometimes', 'nullable', 'boolean'],
            'export_artifacts_recording' => ['sometimes', 'nullable', 'boolean'],
            'scope' => ['sometimes', Rule::in($this->features->allowedScopes())],
            'team_id' => ['sometimes', 'nullable', 'string'],
        ])->validate();
        unset($data['flow_id'], $data['action_id']);
        foreach (($data['config']['headers'] ?? []) as $index => $header) {
            if (in_array(strtolower($header['key']), self::FORBIDDEN_WEBHOOK_HEADERS, true)) {
                throw ValidationException::withMessages([
                    "config.headers.{$index}.key" => 'This HTTP header cannot be overridden.',
                ]);
            }
        }

        return $data;
    }

    private function authorizeFlowUpdate(Flow $flow, McpToolContext $context): void
    {
        if (Gate::forUser($context->user)->denies(Ability::UPDATE->value, $flow)) {
            throw ValidationException::withMessages(['flow_id' => 'Flow not found or forbidden.']);
        }
    }

    /** @param Arguments $arguments */
    private function trigger(array $arguments, McpToolContext $context, Ability $ability): FlowTrigger
    {
        $trigger = FlowTrigger::query()
            ->whereKey(McpToolArguments::string($arguments, 'trigger_id'))
            ->whereHas('flow', fn ($query) => $query
                ->where('workspace_id', $context->workspace->id)
                ->where('available_in_mcp', true))
            ->with('flow')
            ->first();
        if (! $trigger || Gate::forUser($context->user)->denies($ability->value, $trigger)) {
            throw ValidationException::withMessages(['trigger_id' => 'Trigger not found or forbidden.']);
        }

        return $trigger;
    }

    /** @param Arguments $arguments */
    private function action(array $arguments, McpToolContext $context, Ability $ability): FlowAction
    {
        $action = FlowAction::query()
            ->whereKey(McpToolArguments::string($arguments, 'action_id'))
            ->whereHas('flow', fn ($query) => $query
                ->where('workspace_id', $context->workspace->id)
                ->where('available_in_mcp', true))
            ->with('flow')
            ->first();
        if (! $action || Gate::forUser($context->user)->denies($ability->value, $action)) {
            throw ValidationException::withMessages(['action_id' => 'Action not found or forbidden.']);
        }

        return $action;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function applyScope(FlowTrigger|FlowAction $resource, array &$data, McpToolContext $context): void
    {
        $scope = is_string($data['scope'] ?? null) ? $data['scope'] : $resource->scope;
        $teamId = $scope === 'team'
            ? (is_string($data['team_id'] ?? null) ? $data['team_id'] : $resource->team_id)
            : null;
        if ($scope !== $resource->scope || $teamId !== $resource->team_id) {
            if (Gate::forUser($context->user)->denies(Ability::MANAGE_SCOPE->value, $resource)) {
                throw ValidationException::withMessages(['scope' => 'The resource scope cannot be changed.']);
            }
            $this->assignments->ensureOwnerSatisfiesScope(
                $context->workspace->id,
                $resource->user_id,
                $scope,
                $teamId,
            );
            $data['scope'] = $scope;
            $data['team_id'] = $teamId;
        } else {
            unset($data['team_id']);
        }
    }

    /** @return array<string, mixed> */
    private function serializeTrigger(FlowTrigger $trigger): array
    {
        $rawConfig = $trigger->config;
        $config = $trigger->type === 'cron'
            ? ['cron_expression' => is_array($rawConfig) ? ($rawConfig['cron_expression'] ?? null) : null]
            : ['merge_post_data' => is_array($rawConfig) ? (bool) ($rawConfig['merge_post_data'] ?? true) : true];

        return [
            'id' => $trigger->id,
            'flow_id' => $trigger->flow_id,
            'type' => $trigger->type,
            'label' => $trigger->label,
            'group' => $trigger->group,
            'input_template' => $trigger->input_template,
            'config' => $config,
            'is_active' => (bool) $trigger->is_active,
            'scope' => $trigger->scope,
            'team_id' => $trigger->team_id,
            'user_id' => $trigger->user_id,
            'last_triggered_at' => $trigger->last_triggered_at?->toIso8601String(),
            'created_at' => $trigger->created_at?->toIso8601String(),
            'updated_at' => $trigger->updated_at?->toIso8601String(),
        ];
    }

    /** @return array<string, mixed> */
    private function serializeAction(FlowAction $action): array
    {
        $config = $action->config;
        $headers = is_array($config['headers'] ?? null) ? $config['headers'] : [];

        return [
            'id' => $action->id,
            'flow_id' => $action->flow_id,
            'type' => $action->type,
            'label' => $action->label,
            'group' => $action->group,
            'is_active' => (bool) $action->is_active,
            'scope' => $action->scope,
            'team_id' => $action->team_id,
            'user_id' => $action->user_id,
            'fire_on_error' => (bool) $action->fire_on_error,
            'export_artifacts_screenshots' => $action->export_artifacts_screenshots,
            'export_artifacts_downloads' => $action->export_artifacts_downloads,
            'export_artifacts_recording' => $action->getAttribute('export_artifacts_recording'),
            'configuration' => [
                'url_configured' => is_string($config['url'] ?? null) && $config['url'] !== '',
                'signing_secret_configured' => is_string($config['secret'] ?? null) && $config['secret'] !== '',
                'header_names' => array_values(array_filter(array_map(
                    fn (mixed $header): ?string => is_array($header) && is_string($header['key'] ?? null)
                        ? $header['key']
                        : null,
                    $headers,
                ))),
            ],
            'last_triggered_at' => $action->last_triggered_at?->toIso8601String(),
            'created_at' => $action->created_at?->toIso8601String(),
            'updated_at' => $action->updated_at?->toIso8601String(),
        ];
    }
}
