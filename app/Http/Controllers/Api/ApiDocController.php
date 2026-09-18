<?php

namespace App\Http\Controllers\Api;

use App\Contracts\BrandingProvider;
use App\Http\Controllers\Controller;
use App\Services\FeatureFlags\FeatureFlagService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class ApiDocController extends Controller
{
    public function ui(Request $request): View
    {
        $versions = $request->user()->onboarding_versions ?? [];

        return view('api-docs', [
            'onboardingVersion' => (int) ($versions['api.docs'] ?? 0),
            'onboardingDisabled' => (int) ($versions['onboarding.disabled'] ?? 0) >= 1,
        ]);
    }

    public function spec(): JsonResponse
    {
        /** @var string $appUrl */
        $appUrl = config('app.url');
        $baseUrl = rtrim($appUrl, '/');

        return response()->json([
            'openapi' => '3.0.3',
            'info' => [
                'title' => app(BrandingProvider::class)->current()['name'].' API',
                'description' => 'Manage Data Tables, the Media Library and users, trigger flows, list runs, fetch results, and download artifacts. Authenticate with a Bearer API key generated from your profile.',
                'version' => '1.0.0',
            ],
            'servers' => [
                ['url' => $baseUrl.'/api/v1', 'description' => 'API v1'],
            ],
            'components' => [
                'securitySchemes' => [
                    'bearerAuth' => [
                        'type' => 'http',
                        'scheme' => 'bearer',
                        'description' => 'API key generated from your profile page.',
                    ],
                ],
                'schemas' => [
                    'Error' => [
                        'type' => 'object',
                        'properties' => [
                            'error' => ['type' => 'string'],
                            'message' => ['type' => 'string'],
                            'errors' => [
                                'type' => 'object',
                                'additionalProperties' => [
                                    'type' => 'array',
                                    'items' => ['type' => 'string'],
                                ],
                            ],
                        ],
                    ],
                    'MessageResponse' => [
                        'type' => 'object',
                        'required' => ['message'],
                        'properties' => [
                            'message' => ['type' => 'string'],
                        ],
                    ],
                    'TriggerResponse' => [
                        'type' => 'object',
                        'properties' => [
                            'run_id' => ['type' => 'integer'],
                            'flow_id' => ['type' => 'string'],
                            'status' => ['type' => 'string'],
                        ],
                    ],
                    'Run' => [
                        'type' => 'object',
                        'properties' => [
                            'id' => ['type' => 'integer'],
                            'flow_id' => ['type' => 'string'],
                            'trigger_id' => ['type' => 'string', 'nullable' => true],
                            'status' => ['type' => 'string', 'enum' => ['pending', 'running', 'success', 'error', 'cancelled']],
                            'output' => ['type' => 'object', 'nullable' => true],
                            'error_message' => ['type' => 'string', 'nullable' => true],
                            'duration_ms' => ['type' => 'integer', 'nullable' => true],
                            'legend' => ['type' => 'string', 'nullable' => true],
                            'has_recording' => ['type' => 'boolean'],
                            'secrets_redacted' => ['type' => 'boolean', 'description' => 'Secret values are always masked in API responses.'],
                            'triggered_by_user' => [
                                'type' => 'object',
                                'nullable' => true,
                                'properties' => [
                                    'id' => ['type' => 'string'],
                                    'name' => ['type' => 'string'],
                                ],
                            ],
                            'waiting_for_human_validation' => ['type' => 'boolean'],
                            'human_validation_wait_id' => ['type' => 'string', 'format' => 'uuid', 'nullable' => true],
                            'artifacts' => [
                                'type' => 'object',
                                'description' => 'Included in getRun responses. Recording contains file, player, and lastshot URLs when available.',
                                'properties' => [
                                    'downloads' => ['type' => 'array', 'items' => ['type' => 'object']],
                                    'screenshots' => ['type' => 'array', 'items' => ['type' => 'object']],
                                    'recording' => [
                                        'type' => 'object',
                                        'nullable' => true,
                                        'properties' => [
                                            'file' => ['type' => 'string', 'nullable' => true],
                                            'player' => ['type' => 'string'],
                                            'lastshot' => ['type' => 'string', 'nullable' => true],
                                        ],
                                    ],
                                ],
                            ],
                            'console_logs' => ['type' => 'array', 'nullable' => true, 'description' => 'Only included when logs=1 is passed.', 'items' => ['type' => 'object']],
                            'code_snapshot' => ['type' => 'string', 'nullable' => true, 'description' => 'Only included when code=1 is passed.'],
                            'created_at' => ['type' => 'string', 'format' => 'date-time'],
                            'updated_at' => ['type' => 'string', 'format' => 'date-time'],
                        ],
                    ],
                    'RunResult' => [
                        'type' => 'object',
                        'properties' => [
                            'run_id' => ['type' => 'integer'],
                            'status' => ['type' => 'string'],
                            'output' => ['type' => 'object', 'nullable' => true],
                            'error_message' => ['type' => 'string', 'nullable' => true],
                            'duration_ms' => ['type' => 'integer', 'nullable' => true],
                        ],
                    ],
                    'ContinueRunResponse' => [
                        'type' => 'object',
                        'properties' => [
                            'run_id' => ['type' => 'integer'],
                            'status' => ['type' => 'string'],
                            'continue_requested' => ['type' => 'boolean'],
                        ],
                    ],
                    'PaginatedRuns' => [
                        'type' => 'object',
                        'properties' => [
                            'data' => [
                                'type' => 'array',
                                'items' => ['$ref' => '#/components/schemas/Run'],
                            ],
                            'current_page' => ['type' => 'integer'],
                            'last_page' => ['type' => 'integer'],
                            'per_page' => ['type' => 'integer'],
                            'total' => ['type' => 'integer'],
                        ],
                    ],
                    'FlowSummary' => [
                        'type' => 'object',
                        'properties' => [
                            'id' => ['type' => 'string'],
                            'name' => ['type' => 'string'],
                            'description' => ['type' => 'string', 'nullable' => true],
                            'flow_type' => ['type' => 'string', 'enum' => ['code', 'nodal']],
                            'folder_id' => ['type' => 'string', 'nullable' => true],
                            'workspace_folder_id' => ['type' => 'string', 'nullable' => true],
                            'is_published' => ['type' => 'boolean'],
                            'queue_index' => ['type' => 'integer', 'nullable' => true, 'minimum' => 1, 'maximum' => config()->integer('puppetflow.queues_counter', 1)],
                            'default_inputs' => ['type' => 'object', 'nullable' => true, 'additionalProperties' => true],
                            'updated_at' => ['type' => 'string', 'format' => 'date-time'],
                        ],
                    ],
                    'FlowDetail' => [
                        'type' => 'object',
                        'properties' => [
                            'id' => ['type' => 'string'],
                            'name' => ['type' => 'string'],
                            'description' => ['type' => 'string', 'nullable' => true],
                            'readme' => ['type' => 'string', 'nullable' => true],
                            'code' => ['type' => 'string', 'nullable' => true],
                            'source_type' => ['type' => 'string', 'enum' => ['code', 'repository', 'library']],
                            'flow_type' => ['type' => 'string', 'enum' => ['code', 'nodal']],
                            'nodal_graph' => ['type' => 'object', 'nullable' => true, 'additionalProperties' => true],
                            'folder_id' => ['type' => 'string', 'nullable' => true],
                            'workspace_folder_id' => ['type' => 'string', 'nullable' => true],
                            'workspace_id' => ['type' => 'string'],
                            'team_id' => ['type' => 'string', 'nullable' => true],
                            'owner_id' => ['type' => 'string'],
                            'is_published' => ['type' => 'boolean'],
                            'queue_index' => ['type' => 'integer', 'nullable' => true, 'minimum' => 1, 'maximum' => config()->integer('puppetflow.queues_counter', 1)],
                            'visibility' => ['type' => 'string', 'enum' => ['owner', 'workspace', 'team']],
                            'manual_input' => ['type' => 'object', 'nullable' => true, 'additionalProperties' => true],
                            'default_inputs' => ['type' => 'object', 'nullable' => true, 'additionalProperties' => true],
                            'timeout_seconds' => ['type' => 'integer', 'nullable' => true],
                            'operator_seconds' => ['type' => 'integer', 'nullable' => true],
                            'max_retries' => ['type' => 'integer', 'nullable' => true],
                            'include_raw_output' => ['type' => 'boolean'],
                            'include_input_in_output' => ['type' => 'boolean'],
                            'include_context_in_output' => ['type' => 'boolean'],
                            'always_success_response' => ['type' => 'boolean'],
                            'export_artifacts_screenshots' => ['type' => 'boolean'],
                            'export_artifacts_downloads' => ['type' => 'boolean'],
                            'export_artifacts_recording' => ['type' => 'boolean'],
                            'runs_retention_limit' => ['type' => 'integer', 'nullable' => true],
                            'viewport_width' => ['type' => 'integer', 'nullable' => true],
                            'viewport_height' => ['type' => 'integer', 'nullable' => true],
                            'keyboard_speed' => ['type' => 'integer', 'nullable' => true],
                            'user_agent' => ['type' => 'string', 'nullable' => true],
                            'language' => ['type' => 'string', 'nullable' => true, 'description' => 'Browser language as comma-separated BCP 47 tags. Null inherits the workspace default.'],
                            'disable_web_security' => ['type' => 'boolean'],
                            'finally_enabled' => ['type' => 'boolean'],
                            'library_locked' => ['type' => 'boolean'],
                            'library_namespace' => ['type' => 'string', 'nullable' => true],
                            'library_reference' => ['type' => 'string', 'nullable' => true],
                            'library_source_path' => ['type' => 'string', 'nullable' => true],
                            'library_source_sha' => ['type' => 'string', 'nullable' => true],
                            'library_source_url' => ['type' => 'string', 'nullable' => true],
                            'library_imported_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                            'last_run_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                            'icon_type' => ['type' => 'string', 'nullable' => true],
                            'icon_value' => ['type' => 'string', 'nullable' => true],
                            'icon_color' => ['type' => 'string', 'nullable' => true],
                            'cover_color' => ['type' => 'string', 'nullable' => true],
                            'icon_url' => ['type' => 'string', 'nullable' => true],
                            'created_at' => ['type' => 'string', 'format' => 'date-time'],
                            'updated_at' => ['type' => 'string', 'format' => 'date-time'],
                        ],
                    ],
                    'FolderSummary' => [
                        'type' => 'object',
                        'properties' => [
                            'id' => ['type' => 'string'],
                            'name' => ['type' => 'string'],
                            'parent_id' => ['type' => 'string', 'nullable' => true],
                            'is_shared' => ['type' => 'boolean'],
                        ],
                    ],
                    'Workspace' => [
                        'type' => 'object',
                        'properties' => [
                            'id' => ['type' => 'string'],
                            'name' => ['type' => 'string'],
                            'slug' => ['type' => 'string'],
                            'lookup_key' => ['type' => 'string', 'nullable' => true],
                            'owner_id' => ['type' => 'string', 'nullable' => true],
                            'expires_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                            'preferences' => [
                                'type' => 'object',
                                'properties' => [
                                    'runs_retention_default' => ['type' => 'integer'],
                                    'runs_retention_max' => ['type' => 'integer'],
                                    'default_flow_timeout_seconds' => ['type' => 'integer'],
                                    'max_flow_timeout_seconds' => ['type' => 'integer'],
                                    'max_retries_default' => ['type' => 'integer'],
                                    'max_retries_max' => ['type' => 'integer'],
                                    'viewport_width' => ['type' => 'integer'],
                                    'viewport_height' => ['type' => 'integer'],
                                    'keyboard_speed' => ['type' => 'integer'],
                                    'default_user_agent' => ['type' => 'string', 'nullable' => true],
                                    'default_language' => ['type' => 'string', 'nullable' => true],
                                    'allow_trigger_advertising' => ['type' => 'boolean'],
                                    'require_two_factor' => [
                                        'type' => 'boolean',
                                        'description' => 'Effective workspace-wide 2FA requirement. Requires the two-factor enforcement entitlement.',
                                    ],
                                    'default_flow_code' => ['type' => 'string', 'nullable' => true],
                                ],
                            ],
                            'appearance' => [
                                'type' => 'object',
                                'properties' => [
                                    'icon_type' => ['type' => 'string', 'enum' => ['emoji', 'color', 'upload'], 'nullable' => true],
                                    'icon_value' => ['type' => 'string', 'nullable' => true],
                                    'icon_color' => ['type' => 'string', 'nullable' => true],
                                    'icon_url' => ['type' => 'string', 'nullable' => true],
                                ],
                            ],
                            'flows_count' => ['type' => 'integer', 'nullable' => true],
                            'users_count' => ['type' => 'integer', 'nullable' => true],
                            'created_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                            'updated_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                        ],
                    ],
                    'WorkspacePayload' => [
                        'type' => 'object',
                        'properties' => [
                            'name' => ['type' => 'string', 'maxLength' => 255],
                            'lookup_key' => [
                                'type' => 'string',
                                'nullable' => true,
                                'maxLength' => 255,
                                'pattern' => '^[a-z][a-z0-9_-]*$',
                                'description' => 'Unique stable identifier used for idempotent creation and workspace lookup.',
                            ],
                            'expires_at' => [
                                'type' => 'string',
                                'format' => 'date-time',
                                'nullable' => true,
                                'description' => 'Optional workspace expiration date. Send null to remove an existing expiration.',
                            ],
                            'runs_retention_default' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 100000],
                            'runs_retention_max' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 100000],
                            'default_flow_timeout_seconds' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 9999999],
                            'max_flow_timeout_seconds' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 9999999],
                            'max_retries_default' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 255],
                            'max_retries_max' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 255],
                            'viewport_width' => ['type' => 'integer', 'minimum' => 320, 'maximum' => 3840],
                            'viewport_height' => ['type' => 'integer', 'minimum' => 200, 'maximum' => 2160],
                            'keyboard_speed' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 10000],
                            'default_user_agent' => ['type' => 'string', 'nullable' => true, 'maxLength' => 512],
                            'default_language' => ['type' => 'string', 'nullable' => true, 'maxLength' => 64, 'description' => 'Default browser language as comma-separated BCP 47 tags, for example "fr-FR,fr". Sets Accept-Language and navigator.language; websites may still choose a language from the IP address.'],
                            'icon_type' => ['type' => 'string', 'enum' => ['emoji', 'color']],
                            'icon_value' => ['type' => 'string', 'nullable' => true, 'maxLength' => 100],
                            'icon_color' => ['type' => 'string', 'nullable' => true, 'maxLength' => 7],
                            'allow_trigger_advertising' => ['type' => 'boolean'],
                            'require_two_factor' => [
                                'type' => 'boolean',
                                'description' => 'Require 2FA for all workspace members. Requires the two-factor enforcement entitlement.',
                            ],
                            'default_flow_code' => ['type' => 'string', 'nullable' => true, 'maxLength' => 65000],
                            'preferences' => [
                                'type' => 'object',
                                'description' => 'Optional nested form for workspace preferences. The same preference fields may also be sent at the top level.',
                                'properties' => [
                                    'runs_retention_default' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 100000],
                                    'runs_retention_max' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 100000],
                                    'default_flow_timeout_seconds' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 9999999],
                                    'max_flow_timeout_seconds' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 9999999],
                                    'max_retries_default' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 255],
                                    'max_retries_max' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 255],
                                    'viewport_width' => ['type' => 'integer', 'minimum' => 320, 'maximum' => 3840],
                                    'viewport_height' => ['type' => 'integer', 'minimum' => 200, 'maximum' => 2160],
                                    'keyboard_speed' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 10000],
                                    'default_user_agent' => ['type' => 'string', 'nullable' => true, 'maxLength' => 512],
                                    'default_language' => ['type' => 'string', 'nullable' => true, 'maxLength' => 64],
                                    'allow_trigger_advertising' => ['type' => 'boolean'],
                                    'require_two_factor' => [
                                        'type' => 'boolean',
                                        'description' => 'Require 2FA for all workspace members. Requires the two-factor enforcement entitlement.',
                                    ],
                                    'default_flow_code' => ['type' => 'string', 'nullable' => true, 'maxLength' => 65000],
                                ],
                            ],
                            'appearance' => [
                                'type' => 'object',
                                'description' => 'Optional nested form for API-managed workspace appearance. The same appearance fields may also be sent at the top level.',
                                'properties' => [
                                    'icon_type' => ['type' => 'string', 'enum' => ['emoji', 'color']],
                                    'icon_value' => ['type' => 'string', 'nullable' => true, 'maxLength' => 100],
                                    'icon_color' => ['type' => 'string', 'nullable' => true, 'maxLength' => 7],
                                ],
                            ],
                        ],
                    ],
                    'User' => [
                        'type' => 'object',
                        'properties' => [
                            'id' => [
                                'type' => 'string',
                                'pattern' => '^user_[A-Za-z0-9]{12}$',
                                'example' => 'user_k8Zt3xQ9mA2f',
                            ],
                            'name' => ['type' => 'string'],
                            'first_name' => ['type' => 'string', 'nullable' => true],
                            'last_name' => ['type' => 'string', 'nullable' => true],
                            'email' => ['type' => 'string', 'format' => 'email'],
                            'role' => ['type' => 'string', 'enum' => ['admin', 'member']],
                            'can_create_workspace' => ['type' => 'boolean'],
                            'timezone' => ['type' => 'string', 'nullable' => true],
                            'explorer_view_mode' => ['type' => 'string', 'enum' => ['grid', 'list'], 'nullable' => true],
                            'workspaces' => [
                                'type' => 'array',
                                'items' => [
                                    'type' => 'object',
                                    'properties' => [
                                        'id' => ['type' => 'string'],
                                        'name' => ['type' => 'string'],
                                        'role' => ['type' => 'string', 'enum' => ['admin', 'manager', 'member']],
                                    ],
                                ],
                            ],
                            'teams' => [
                                'type' => 'array',
                                'items' => [
                                    'type' => 'object',
                                    'properties' => [
                                        'id' => ['type' => 'string'],
                                        'workspace_id' => ['type' => 'string'],
                                        'name' => ['type' => 'string'],
                                    ],
                                ],
                            ],
                            'created_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                            'updated_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                        ],
                    ],
                    'UserPayload' => [
                        'type' => 'object',
                        'properties' => [
                            'name' => ['type' => 'string', 'maxLength' => 255],
                            'first_name' => ['type' => 'string', 'maxLength' => 120],
                            'last_name' => ['type' => 'string', 'maxLength' => 120],
                            'email' => ['type' => 'string', 'format' => 'email'],
                            'password' => ['type' => 'string', 'format' => 'password'],
                            'role' => ['type' => 'string', 'enum' => ['admin', 'member']],
                            'can_create_workspace' => ['type' => 'boolean'],
                            'timezone' => ['type' => 'string'],
                            'explorer_view_mode' => ['type' => 'string', 'enum' => ['grid', 'list']],
                            'workspaces' => [
                                'type' => 'array',
                                'items' => [
                                    'type' => 'object',
                                    'properties' => [
                                        'id' => ['type' => 'string'],
                                        'role' => ['type' => 'string', 'enum' => ['admin', 'manager', 'member']],
                                    ],
                                ],
                            ],
                            'team_ids' => ['type' => 'array', 'items' => ['type' => 'string']],
                        ],
                    ],
                    'Team' => [
                        'type' => 'object',
                        'properties' => [
                            'id' => ['type' => 'string', 'example' => 'team_k8Zt3xQ9mA2f'],
                            'workspace_id' => ['type' => 'string'],
                            'name' => ['type' => 'string'],
                            'members_count' => ['type' => 'integer', 'nullable' => true],
                            'members' => [
                                'type' => 'array',
                                'items' => [
                                    'type' => 'object',
                                    'properties' => [
                                        'id' => ['type' => 'string'],
                                        'name' => ['type' => 'string'],
                                        'email' => ['type' => 'string', 'format' => 'email'],
                                        'role' => ['type' => 'string', 'enum' => ['admin', 'manager', 'member']],
                                    ],
                                ],
                            ],
                            'created_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                            'updated_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                        ],
                    ],
                    'RunSummary' => [
                        'type' => 'object',
                        'properties' => [
                            'id' => ['type' => 'integer'],
                            'flow_id' => ['type' => 'string'],
                            'trigger_id' => ['type' => 'string', 'nullable' => true],
                            'status' => ['type' => 'string', 'enum' => ['pending', 'running', 'success', 'error', 'cancelled']],
                            'duration_ms' => ['type' => 'integer', 'nullable' => true],
                            'created_at' => ['type' => 'string', 'format' => 'date-time'],
                        ],
                    ],
                    'ArtifactList' => [
                        'type' => 'array',
                        'items' => [
                            'type' => 'object',
                            'properties' => [
                                'name' => ['type' => 'string'],
                                'size' => ['type' => 'integer'],
                                'url' => ['type' => 'string'],
                            ],
                        ],
                    ],
                    ...$this->workspaceMemberSchemas(),
                    ...$this->dataTableSchemas(),
                    ...$this->mediaSchemas(),
                ],
                'parameters' => [
                    'id' => [
                        'name' => 'id',
                        'in' => 'path',
                        'required' => true,
                        'description' => 'Flow ID.',
                        'schema' => ['type' => 'string'],
                    ],
                    'run' => [
                        'name' => 'run',
                        'in' => 'path',
                        'required' => true,
                        'description' => 'Run ID.',
                        'schema' => ['type' => 'integer'],
                    ],
                    'workspace' => [
                        'name' => 'workspace',
                        'in' => 'path',
                        'required' => true,
                        'description' => 'Workspace ID or lookup key where supported, including workspace detail, Data Table and Media endpoints.',
                        'schema' => ['type' => 'string'],
                    ],
                    'user' => [
                        'name' => 'user',
                        'in' => 'path',
                        'required' => true,
                        'description' => 'User ID.',
                        'schema' => ['type' => 'string'],
                    ],
                    'member' => [
                        'name' => 'member',
                        'in' => 'path',
                        'required' => true,
                        'description' => 'Workspace member user ID.',
                        'schema' => ['type' => 'string'],
                    ],
                    'team' => [
                        'name' => 'team',
                        'in' => 'path',
                        'required' => true,
                        'description' => 'Team ID.',
                        'schema' => ['type' => 'string'],
                    ],
                    ...$this->dataTableParameters(),
                    ...$this->mediaParameters(),
                ],
            ],
            'security' => [
                ['bearerAuth' => []],
            ],
            'paths' => [
                '/users' => [
                    'get' => [
                        'tags' => ['Users'],
                        'summary' => 'List users',
                        'description' => 'Lists users. Requires an instance admin API key.',
                        'operationId' => 'listUsers',
                        'parameters' => [
                            ['name' => 'search', 'in' => 'query', 'required' => false, 'description' => 'Search by name or email.', 'schema' => ['type' => 'string']],
                            ['name' => 'limit', 'in' => 'query', 'required' => false, 'description' => 'Maximum items to return.', 'schema' => ['type' => 'integer', 'default' => 50, 'maximum' => 100]],
                        ],
                        'responses' => [
                            '200' => ['description' => 'List of users.', 'content' => ['application/json' => ['schema' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/User']]]]],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '403' => ['description' => 'Forbidden.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                    'post' => [
                        'tags' => ['Users'],
                        'summary' => 'Create a user',
                        'description' => 'Creates a user and optionally assigns workspace roles and teams. Requires an instance admin API key.',
                        'operationId' => 'createUser',
                        'requestBody' => [
                            'required' => true,
                            'content' => [
                                'application/json' => [
                                    'schema' => [
                                        'allOf' => [
                                            ['$ref' => '#/components/schemas/UserPayload'],
                                            ['required' => ['email', 'password']],
                                        ],
                                    ],
                                    'example' => [
                                        'first_name' => 'Jane',
                                        'last_name' => 'Doe',
                                        'email' => 'jane@example.com',
                                        'password' => 'secret-password',
                                        'role' => 'member',
                                        'can_create_workspace' => true,
                                        'workspaces' => [
                                            ['id' => 'work_k8Zt3xQ9mA2f', 'role' => 'manager'],
                                        ],
                                        'team_ids' => ['team_k8Zt3xQ9mA2f'],
                                    ],
                                ],
                            ],
                        ],
                        'responses' => [
                            '201' => ['description' => 'User created.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/User']]]],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '403' => ['description' => 'Forbidden.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '422' => ['description' => 'Validation error.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                '/users/{user}' => [
                    'get' => [
                        'tags' => ['Users'],
                        'summary' => 'Get a user',
                        'description' => 'Returns a user with workspace and team assignments. Requires an instance admin API key.',
                        'operationId' => 'getUser',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/user'],
                        ],
                        'responses' => [
                            '200' => ['description' => 'User details.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/User']]]],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '403' => ['description' => 'Forbidden.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                    'patch' => [
                        'tags' => ['Users'],
                        'summary' => 'Update a user',
                        'description' => 'Updates profile, password, global role, workspace roles, and team assignments. Requires an instance admin API key.',
                        'operationId' => 'updateUser',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/user'],
                        ],
                        'requestBody' => [
                            'required' => true,
                            'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/UserPayload']]],
                        ],
                        'responses' => [
                            '200' => ['description' => 'User updated.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/User']]]],
                            '400' => ['description' => 'Invalid self-role update.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '403' => ['description' => 'Forbidden.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '422' => ['description' => 'Validation error.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                    'put' => [
                        'tags' => ['Users'],
                        'summary' => 'Update a user',
                        'description' => 'Same behavior as PATCH. Omitted fields are left unchanged.',
                        'operationId' => 'replaceUser',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/user'],
                        ],
                        'requestBody' => [
                            'required' => true,
                            'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/UserPayload']]],
                        ],
                        'responses' => [
                            '200' => ['description' => 'User updated.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/User']]]],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '403' => ['description' => 'Forbidden.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '422' => ['description' => 'Validation error.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                '/workspaces' => [
                    'get' => [
                        'tags' => ['Workspaces'],
                        'summary' => 'List workspaces',
                        'description' => 'Returns workspaces visible to the authenticated API key user.',
                        'operationId' => 'listWorkspaces',
                        'parameters' => [
                            ['name' => 'search', 'in' => 'query', 'required' => false, 'description' => 'Search by workspace name, slug, or lookup key.', 'schema' => ['type' => 'string']],
                            ['name' => 'limit', 'in' => 'query', 'required' => false, 'description' => 'Maximum items to return.', 'schema' => ['type' => 'integer', 'default' => 50, 'maximum' => 100]],
                        ],
                        'responses' => [
                            '200' => [
                                'description' => 'List of workspaces.',
                                'content' => [
                                    'application/json' => [
                                        'schema' => [
                                            'type' => 'array',
                                            'items' => ['$ref' => '#/components/schemas/Workspace'],
                                        ],
                                    ],
                                ],
                            ],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                    'post' => [
                        'tags' => ['Workspaces'],
                        'summary' => 'Create or upsert a workspace',
                        'description' => 'Creates a workspace owned by the authenticated user. When lookup_key already exists, updates that workspace instead and returns 200. Creating a new workspace requires an admin or a user with workspace creation enabled. Updating an existing workspace requires workspace management permission.',
                        'operationId' => 'createWorkspace',
                        'requestBody' => [
                            'required' => true,
                            'content' => [
                                'application/json' => [
                                    'schema' => ['$ref' => '#/components/schemas/WorkspacePayload'],
                                    'example' => [
                                        'name' => 'Production',
                                        'lookup_key' => 'production_eu',
                                        'preferences' => [
                                            'viewport_width' => 1440,
                                            'viewport_height' => 900,
                                            'keyboard_speed' => 100,
                                        ],
                                        'appearance' => [
                                            'icon_type' => 'emoji',
                                            'icon_value' => ':rocket:',
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        'responses' => [
                            '200' => [
                                'description' => 'Existing workspace updated by lookup key.',
                                'content' => [
                                    'application/json' => [
                                        'schema' => ['$ref' => '#/components/schemas/Workspace'],
                                    ],
                                ],
                            ],
                            '201' => [
                                'description' => 'Workspace created.',
                                'content' => [
                                    'application/json' => [
                                        'schema' => ['$ref' => '#/components/schemas/Workspace'],
                                    ],
                                ],
                            ],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '403' => ['description' => 'Forbidden or workspace limit reached.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '422' => ['description' => 'Validation error.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                '/workspaces/{workspace}' => [
                    'get' => [
                        'tags' => ['Workspaces'],
                        'summary' => 'Get a workspace',
                        'description' => 'Returns the name, lookup key, preferences, appearance and counts for a visible workspace. The path accepts a workspace ID or lookup key.',
                        'operationId' => 'getWorkspace',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/workspace'],
                        ],
                        'responses' => [
                            '200' => [
                                'description' => 'Workspace details.',
                                'content' => [
                                    'application/json' => [
                                        'schema' => ['$ref' => '#/components/schemas/Workspace'],
                                    ],
                                ],
                            ],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '404' => ['description' => 'Workspace not found.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                    'patch' => [
                        'tags' => ['Workspaces'],
                        'summary' => 'Update a workspace',
                        'description' => 'Updates workspace name, lookup key, preferences, and appearance. The path accepts a workspace ID or lookup key. The API key user must be an instance admin or workspace admin/manager. Uploaded icons are not managed through this endpoint; use `icon_type`, `icon_value`, and `icon_color` for API-managed appearance.',
                        'operationId' => 'updateWorkspace',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/workspace'],
                        ],
                        'requestBody' => [
                            'required' => true,
                            'content' => [
                                'application/json' => [
                                    'schema' => ['$ref' => '#/components/schemas/WorkspacePayload'],
                                    'example' => [
                                        'name' => 'Production Ops',
                                        'preferences' => [
                                            'runs_retention_default' => 30,
                                            'viewport_width' => 1600,
                                            'viewport_height' => 1000,
                                            'keyboard_speed' => 75,
                                        ],
                                        'appearance' => [
                                            'icon_type' => 'color',
                                            'icon_color' => '#16a34a',
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        'responses' => [
                            '200' => [
                                'description' => 'Workspace updated.',
                                'content' => [
                                    'application/json' => [
                                        'schema' => ['$ref' => '#/components/schemas/Workspace'],
                                    ],
                                ],
                            ],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '403' => ['description' => 'Forbidden.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '422' => ['description' => 'Validation error.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                    'put' => [
                        'tags' => ['Workspaces'],
                        'summary' => 'Update a workspace',
                        'description' => 'Same behavior as PATCH. Omitted fields are left unchanged.',
                        'operationId' => 'replaceWorkspace',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/workspace'],
                        ],
                        'requestBody' => [
                            'required' => true,
                            'content' => [
                                'application/json' => [
                                    'schema' => ['$ref' => '#/components/schemas/WorkspacePayload'],
                                ],
                            ],
                        ],
                        'responses' => [
                            '200' => [
                                'description' => 'Workspace updated.',
                                'content' => [
                                    'application/json' => [
                                        'schema' => ['$ref' => '#/components/schemas/Workspace'],
                                    ],
                                ],
                            ],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '403' => ['description' => 'Forbidden.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '422' => ['description' => 'Validation error.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                '/workspaces/{workspace}/teams' => [
                    'get' => [
                        'tags' => ['Teams'],
                        'summary' => 'List workspace teams',
                        'description' => 'Lists teams in a visible workspace.',
                        'operationId' => 'listTeams',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/workspace'],
                        ],
                        'responses' => [
                            '200' => ['description' => 'List of teams.', 'content' => ['application/json' => ['schema' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/Team']]]]],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '404' => ['description' => 'Workspace not found.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                    'post' => [
                        'tags' => ['Teams'],
                        'summary' => 'Create a team',
                        'description' => 'Creates a team in a workspace. Requires an instance admin or workspace admin/manager API key.',
                        'operationId' => 'createTeam',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/workspace'],
                        ],
                        'requestBody' => [
                            'required' => true,
                            'content' => [
                                'application/json' => [
                                    'schema' => [
                                        'type' => 'object',
                                        'required' => ['name'],
                                        'properties' => ['name' => ['type' => 'string', 'maxLength' => 50]],
                                    ],
                                    'example' => ['name' => 'Operations'],
                                ],
                            ],
                        ],
                        'responses' => [
                            '201' => ['description' => 'Team created.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Team']]]],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '403' => ['description' => 'Forbidden.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '422' => ['description' => 'Validation error.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                '/teams/{team}' => [
                    'get' => [
                        'tags' => ['Teams'],
                        'summary' => 'Get a team',
                        'description' => 'Returns a team and its members.',
                        'operationId' => 'getTeam',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/team'],
                        ],
                        'responses' => [
                            '200' => ['description' => 'Team details.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Team']]]],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '404' => ['description' => 'Team not found.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                    'patch' => [
                        'tags' => ['Teams'],
                        'summary' => 'Update a team',
                        'description' => 'Updates a team name. Requires an instance admin or workspace admin/manager API key.',
                        'operationId' => 'updateTeam',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/team'],
                        ],
                        'requestBody' => [
                            'required' => true,
                            'content' => ['application/json' => ['schema' => ['type' => 'object', 'properties' => ['name' => ['type' => 'string', 'maxLength' => 50]]]]],
                        ],
                        'responses' => [
                            '200' => ['description' => 'Team updated.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Team']]]],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '403' => ['description' => 'Forbidden.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '422' => ['description' => 'Validation error.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                    'put' => [
                        'tags' => ['Teams'],
                        'summary' => 'Update a team',
                        'description' => 'Same behavior as PATCH. Omitted fields are left unchanged.',
                        'operationId' => 'replaceTeam',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/team'],
                        ],
                        'requestBody' => [
                            'required' => true,
                            'content' => ['application/json' => ['schema' => ['type' => 'object', 'properties' => ['name' => ['type' => 'string', 'maxLength' => 50]]]]],
                        ],
                        'responses' => [
                            '200' => ['description' => 'Team updated.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Team']]]],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '403' => ['description' => 'Forbidden.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '422' => ['description' => 'Validation error.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                '/teams/{team}/members' => [
                    'post' => [
                        'tags' => ['Teams'],
                        'summary' => 'Add members to a team',
                        'description' => 'Adds one or more workspace members to a team.',
                        'operationId' => 'addTeamMembers',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/team'],
                        ],
                        'requestBody' => [
                            'required' => true,
                            'content' => ['application/json' => ['schema' => ['type' => 'object', 'properties' => ['member_id' => ['type' => 'string'], 'member_ids' => ['type' => 'array', 'items' => ['type' => 'string']]]]]],
                        ],
                        'responses' => [
                            '200' => ['description' => 'Team members updated.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Team']]]],
                            '403' => ['description' => 'Forbidden.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '422' => ['description' => 'Validation error.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                    'put' => [
                        'tags' => ['Teams'],
                        'summary' => 'Replace team members',
                        'description' => 'Replaces the full member list of a team.',
                        'operationId' => 'replaceTeamMembers',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/team'],
                        ],
                        'requestBody' => [
                            'required' => true,
                            'content' => ['application/json' => ['schema' => ['type' => 'object', 'required' => ['member_ids'], 'properties' => ['member_ids' => ['type' => 'array', 'items' => ['type' => 'string']]]]]],
                        ],
                        'responses' => [
                            '200' => ['description' => 'Team members replaced.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Team']]]],
                            '403' => ['description' => 'Forbidden.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '422' => ['description' => 'Validation error.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                ...$this->workspaceMemberPaths(),
                '/workspaces/{workspace}/members/{member}/teams' => [
                    'put' => [
                        'tags' => ['Teams'],
                        'summary' => 'Set a member teams',
                        'description' => 'Replaces the teams assigned to one workspace member.',
                        'operationId' => 'setMemberTeams',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/workspace'],
                            ['$ref' => '#/components/parameters/member'],
                        ],
                        'requestBody' => [
                            'required' => true,
                            'content' => ['application/json' => ['schema' => ['type' => 'object', 'required' => ['team_ids'], 'properties' => ['team_ids' => ['type' => 'array', 'items' => ['type' => 'string']]]]]],
                        ],
                        'responses' => [
                            '200' => [
                                'description' => 'User teams updated.',
                                'content' => ['application/json' => ['schema' => [
                                    'type' => 'object',
                                    'properties' => [
                                        'member_id' => ['type' => 'string'],
                                        'workspace_id' => ['type' => 'string'],
                                        'team_ids' => ['type' => 'array', 'items' => ['type' => 'string']],
                                    ],
                                ]]],
                            ],
                            '403' => ['description' => 'Forbidden.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '422' => ['description' => 'Validation error.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                ...$this->dataTablePaths(),
                ...$this->mediaPaths(),
                '/flows' => [
                    'get' => [
                        'tags' => ['Flows'],
                        'summary' => 'List flows',
                        'description' => 'Returns a list of flows accessible by the authenticated user. Supports search by name, description, ID, or flow type.',
                        'operationId' => 'listFlows',
                        'parameters' => [
                            ['name' => 'search', 'in' => 'query', 'required' => false, 'description' => 'Search by name, description, or ID.', 'schema' => ['type' => 'string']],
                            ['name' => 'name', 'in' => 'query', 'required' => false, 'description' => 'Filter by flow name.', 'schema' => ['type' => 'string']],
                            ['name' => 'flow_type', 'in' => 'query', 'required' => false, 'description' => 'Filter by flow type.', 'schema' => ['type' => 'string', 'enum' => ['code', 'nodal']]],
                            ['name' => 'type', 'in' => 'query', 'required' => false, 'description' => 'Alias for flow_type.', 'schema' => ['type' => 'string', 'enum' => ['code', 'nodal']]],
                            ['name' => 'folder_id', 'in' => 'query', 'required' => false, 'description' => 'Filter by folder ID.', 'schema' => ['type' => 'string']],
                            ['name' => 'limit', 'in' => 'query', 'required' => false, 'description' => 'Maximum items to return.', 'schema' => ['type' => 'integer', 'default' => 50, 'maximum' => 100]],
                        ],
                        'responses' => [
                            '200' => [
                                'description' => 'List of flows.',
                                'content' => [
                                    'application/json' => [
                                        'schema' => [
                                            'type' => 'array',
                                            'items' => ['$ref' => '#/components/schemas/FlowSummary'],
                                        ],
                                    ],
                                ],
                            ],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                '/flows/search' => [
                    'get' => [
                        'tags' => ['Flows'],
                        'summary' => 'Search flows',
                        'description' => 'Alias of `GET /flows` for integrations that need an explicit search route.',
                        'operationId' => 'searchFlows',
                        'parameters' => [
                            ['name' => 'search', 'in' => 'query', 'required' => false, 'description' => 'Search by name, description, or ID.', 'schema' => ['type' => 'string']],
                            ['name' => 'name', 'in' => 'query', 'required' => false, 'description' => 'Filter by flow name.', 'schema' => ['type' => 'string']],
                            ['name' => 'flow_type', 'in' => 'query', 'required' => false, 'description' => 'Filter by flow type.', 'schema' => ['type' => 'string', 'enum' => ['code', 'nodal']]],
                            ['name' => 'type', 'in' => 'query', 'required' => false, 'description' => 'Alias for flow_type.', 'schema' => ['type' => 'string', 'enum' => ['code', 'nodal']]],
                            ['name' => 'folder_id', 'in' => 'query', 'required' => false, 'description' => 'Filter by folder ID.', 'schema' => ['type' => 'string']],
                            ['name' => 'limit', 'in' => 'query', 'required' => false, 'description' => 'Maximum items to return.', 'schema' => ['type' => 'integer', 'default' => 50, 'maximum' => 100]],
                        ],
                        'responses' => [
                            '200' => [
                                'description' => 'List of flows.',
                                'content' => [
                                    'application/json' => [
                                        'schema' => [
                                            'type' => 'array',
                                            'items' => ['$ref' => '#/components/schemas/FlowSummary'],
                                        ],
                                    ],
                                ],
                            ],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                '/runs/search' => [
                    'get' => [
                        'tags' => ['Runs'],
                        'summary' => 'Search runs',
                        'description' => 'Search visible runs with the same filters as the Runs page.',
                        'operationId' => 'searchAllRuns',
                        'parameters' => [
                            ['name' => 'workspace_id', 'in' => 'query', 'required' => false, 'description' => 'Optional workspace ID.', 'schema' => ['type' => 'string']],
                            ['name' => 'flow_id', 'in' => 'query', 'required' => false, 'description' => 'Optional flow ID.', 'schema' => ['type' => 'string']],
                            ['name' => 'flow_search', 'in' => 'query', 'required' => false, 'description' => 'Search by run ID, flow name, or ID.', 'schema' => ['type' => 'string']],
                            ['name' => 'status', 'in' => 'query', 'required' => false, 'description' => 'Filter by status.', 'schema' => ['type' => 'string', 'enum' => ['pending', 'running', 'success', 'error', 'cancelled']]],
                            ['name' => 'statuses', 'in' => 'query', 'required' => false, 'description' => 'Filter by multiple statuses.', 'schema' => ['type' => 'array', 'items' => ['type' => 'string', 'enum' => ['pending', 'running', 'success', 'error', 'cancelled']]]],
                            ['name' => 'date_from', 'in' => 'query', 'required' => false, 'description' => 'Minimum created_at value.', 'schema' => ['type' => 'string']],
                            ['name' => 'date_to', 'in' => 'query', 'required' => false, 'description' => 'Maximum created_at value.', 'schema' => ['type' => 'string']],
                            ['name' => 'legend', 'in' => 'query', 'required' => false, 'description' => 'Filter by run legend.', 'schema' => ['type' => 'string']],
                            ['name' => 'duration_min_ms', 'in' => 'query', 'required' => false, 'description' => 'Minimum duration in milliseconds.', 'schema' => ['type' => 'integer']],
                            ['name' => 'duration_max_ms', 'in' => 'query', 'required' => false, 'description' => 'Maximum duration in milliseconds.', 'schema' => ['type' => 'integer']],
                            ['name' => 'triggered_by', 'in' => 'query', 'required' => false, 'description' => 'Filter by triggering user ID.', 'schema' => ['type' => 'string']],
                            ['name' => 'meta_presence', 'in' => 'query', 'required' => false, 'description' => 'Filter runs with any or no metadata.', 'schema' => ['type' => 'string', 'enum' => ['any', 'none']]],
                            ['name' => 'meta_predicate', 'in' => 'query', 'required' => false, 'description' => 'Combine meta filters with and/or.', 'schema' => ['type' => 'string', 'enum' => ['and', 'or']]],
                            ['name' => 'per_page', 'in' => 'query', 'required' => false, 'description' => 'Items per page.', 'schema' => ['type' => 'integer', 'default' => 50, 'maximum' => 100]],
                            ['name' => 'page', 'in' => 'query', 'required' => false, 'description' => 'Page number.', 'schema' => ['type' => 'integer']],
                            ['name' => 'logs', 'in' => 'query', 'required' => false, 'description' => 'Set to 1 to include console_logs in the response.', 'schema' => ['type' => 'integer', 'enum' => [0, 1], 'default' => 0]],
                            ['name' => 'code', 'in' => 'query', 'required' => false, 'description' => 'Set to 1 to include code_snapshot in the response.', 'schema' => ['type' => 'integer', 'enum' => [0, 1], 'default' => 0]],
                        ],
                        'responses' => [
                            '200' => [
                                'description' => 'Paginated list of runs.',
                                'content' => [
                                    'application/json' => [
                                        'schema' => ['$ref' => '#/components/schemas/PaginatedRuns'],
                                    ],
                                ],
                            ],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                '/flows/{id}' => [
                    'get' => [
                        'tags' => ['Flows'],
                        'summary' => 'Get a flow',
                        'description' => 'Returns the current flow definition and configuration, including code and nodal graph data.',
                        'operationId' => 'getFlow',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/id'],
                        ],
                        'responses' => [
                            '200' => [
                                'description' => 'Flow details.',
                                'content' => [
                                    'application/json' => [
                                        'schema' => ['$ref' => '#/components/schemas/FlowDetail'],
                                    ],
                                ],
                            ],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '403' => ['description' => 'Forbidden.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '404' => ['description' => 'Flow not found.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                '/folders' => [
                    'get' => [
                        'tags' => ['Folders'],
                        'summary' => 'List folders',
                        'description' => 'Returns a list of folders for the authenticated user. Supports search by name.',
                        'operationId' => 'listFolders',
                        'parameters' => [
                            ['name' => 'search', 'in' => 'query', 'required' => false, 'description' => 'Search by folder name.', 'schema' => ['type' => 'string']],
                        ],
                        'responses' => [
                            '200' => [
                                'description' => 'List of folders.',
                                'content' => [
                                    'application/json' => [
                                        'schema' => [
                                            'type' => 'array',
                                            'items' => ['$ref' => '#/components/schemas/FolderSummary'],
                                        ],
                                    ],
                                ],
                            ],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                '/flows/{id}/trigger' => [
                    'post' => [
                        'tags' => ['Flows'],
                        'summary' => 'Trigger a flow',
                        'description' => 'Dispatches a new run for the given flow and returns immediately. Pass optional JSON input in the request body. Resource references such as `${mediaAssets.media_A1b2C3d4E5f6}` resolve with the flow actor’s permissions at run time. Poll `GET /runs/{run_id}` to check completion.',
                        'operationId' => 'triggerFlow',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/id'],
                        ],
                        'requestBody' => [
                            'required' => false,
                            'content' => [
                                'application/json' => [
                                    'schema' => [
                                        'type' => 'object',
                                        'additionalProperties' => true,
                                        'example' => [
                                            'key' => 'value',
                                            'uploadMedia' => '${mediaAssets.media_A1b2C3d4E5f6}',
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        'responses' => [
                            '202' => [
                                'description' => 'Flow triggered.',
                                'content' => [
                                    'application/json' => [
                                        'schema' => ['$ref' => '#/components/schemas/TriggerResponse'],
                                    ],
                                ],
                            ],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '403' => ['description' => 'Forbidden.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '404' => ['description' => 'Flow not found.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '422' => ['description' => 'Flow is unpublished.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                '/flows/{id}/runs' => [
                    'get' => [
                        'tags' => ['Runs'],
                        'summary' => 'List runs',
                        'description' => 'Returns a paginated list of runs for the given flow.',
                        'operationId' => 'listRuns',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/id'],
                            ['name' => 'status', 'in' => 'query', 'required' => false, 'description' => 'Filter by status.', 'schema' => ['type' => 'string', 'enum' => ['pending', 'running', 'success', 'error', 'cancelled']]],
                            ['name' => 'per_page', 'in' => 'query', 'required' => false, 'description' => 'Items per page (default 20).', 'schema' => ['type' => 'integer', 'default' => 20]],
                            ['name' => 'page', 'in' => 'query', 'required' => false, 'description' => 'Page number.', 'schema' => ['type' => 'integer']],
                            ['name' => 'logs', 'in' => 'query', 'required' => false, 'description' => 'Set to 1 to include console_logs in the response.', 'schema' => ['type' => 'integer', 'enum' => [0, 1], 'default' => 0]],
                            ['name' => 'code', 'in' => 'query', 'required' => false, 'description' => 'Set to 1 to include code_snapshot in the response.', 'schema' => ['type' => 'integer', 'enum' => [0, 1], 'default' => 0]],
                        ],
                        'responses' => [
                            '200' => [
                                'description' => 'Paginated list of runs.',
                                'content' => [
                                    'application/json' => [
                                        'schema' => ['$ref' => '#/components/schemas/PaginatedRuns'],
                                    ],
                                ],
                            ],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '404' => ['description' => 'Flow not found.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                '/flows/{id}/runs/search' => [
                    'get' => [
                        'tags' => ['Runs'],
                        'summary' => 'Search runs',
                        'description' => 'Returns a lightweight list of runs for the given flow, suitable for autocomplete/search.',
                        'operationId' => 'searchRuns',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/id'],
                            ['name' => 'search', 'in' => 'query', 'required' => false, 'description' => 'Search by run ID or status.', 'schema' => ['type' => 'string']],
                            ['name' => 'status', 'in' => 'query', 'required' => false, 'description' => 'Filter by status.', 'schema' => ['type' => 'string', 'enum' => ['pending', 'running', 'success', 'error', 'cancelled']]],
                        ],
                        'responses' => [
                            '200' => [
                                'description' => 'List of runs.',
                                'content' => [
                                    'application/json' => [
                                        'schema' => [
                                            'type' => 'array',
                                            'items' => ['$ref' => '#/components/schemas/RunSummary'],
                                        ],
                                    ],
                                ],
                            ],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '404' => ['description' => 'Flow not found.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                '/flows/{id}/runs/{run}' => [
                    'get' => [
                        'tags' => ['Runs'],
                        'summary' => 'Get a run',
                        'description' => 'Returns the full details of a specific run.',
                        'operationId' => 'getRun',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/id'],
                            ['$ref' => '#/components/parameters/run'],
                            ['name' => 'logs', 'in' => 'query', 'required' => false, 'description' => 'Set to 1 to include console_logs in the response.', 'schema' => ['type' => 'integer', 'enum' => [0, 1], 'default' => 0]],
                            ['name' => 'code', 'in' => 'query', 'required' => false, 'description' => 'Set to 1 to include code_snapshot in the response.', 'schema' => ['type' => 'integer', 'enum' => [0, 1], 'default' => 0]],
                        ],
                        'responses' => [
                            '200' => [
                                'description' => 'Run details.',
                                'content' => [
                                    'application/json' => [
                                        'schema' => ['$ref' => '#/components/schemas/Run'],
                                    ],
                                ],
                            ],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '404' => ['description' => 'Flow or run not found.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                '/flows/{id}/runs/{run}/result' => [
                    'get' => [
                        'tags' => ['Runs'],
                        'summary' => 'Get run result',
                        'description' => 'Returns the output, status and timing of a completed run.',
                        'operationId' => 'getRunResult',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/id'],
                            ['$ref' => '#/components/parameters/run'],
                        ],
                        'responses' => [
                            '200' => [
                                'description' => 'Run result.',
                                'content' => [
                                    'application/json' => [
                                        'schema' => ['$ref' => '#/components/schemas/RunResult'],
                                    ],
                                ],
                            ],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '404' => ['description' => 'Flow or run not found.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                '/flows/{id}/runs/{run}/continue' => [
                    'post' => [
                        'tags' => ['Runs'],
                        'summary' => 'Continue a waiting run',
                        'description' => 'Continues a running flow paused by `$waitHumanValidation`. The run must currently be waiting for human validation.',
                        'operationId' => 'continueRun',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/id'],
                            ['$ref' => '#/components/parameters/run'],
                        ],
                        'requestBody' => [
                            'required' => true,
                            'content' => [
                                'application/json' => [
                                    'schema' => [
                                        'type' => 'object',
                                        'required' => ['wait_id'],
                                        'properties' => [
                                            'wait_id' => ['type' => 'string', 'format' => 'uuid'],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        'responses' => [
                            '200' => [
                                'description' => 'Run continuation requested.',
                                'content' => [
                                    'application/json' => [
                                        'schema' => ['$ref' => '#/components/schemas/ContinueRunResponse'],
                                    ],
                                ],
                            ],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '403' => ['description' => 'Forbidden.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '404' => ['description' => 'Flow or run not found.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '409' => ['description' => 'Run is not active or not waiting for human validation.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                '/flows/{id}/runs/{run}/recording' => [
                    'get' => [
                        'tags' => ['Artifacts'],
                        'summary' => 'Download recording',
                        'description' => 'Downloads the session recording (video/mp4). Returns 404 if no recording exists.',
                        'operationId' => 'downloadRecording',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/id'],
                            ['$ref' => '#/components/parameters/run'],
                        ],
                        'responses' => [
                            '200' => [
                                'description' => 'The recording file (video/mp4).',
                                'content' => [
                                    'video/mp4' => [
                                        'schema' => ['type' => 'string', 'format' => 'binary'],
                                    ],
                                ],
                            ],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '404' => ['description' => 'Flow, run or recording not found.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                '/flows/{id}/runs/{run}/recording/lastshot' => [
                    'get' => [
                        'tags' => ['Artifacts'],
                        'summary' => 'Download recording lastshot',
                        'description' => 'Downloads the last frame of the session recording (image/jpeg). Returns 404 if no lastshot exists.',
                        'operationId' => 'downloadRecordingLastshot',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/id'],
                            ['$ref' => '#/components/parameters/run'],
                        ],
                        'responses' => [
                            '200' => [
                                'description' => 'The recording lastshot file (image/jpeg).',
                                'content' => [
                                    'image/jpeg' => [
                                        'schema' => ['type' => 'string', 'format' => 'binary'],
                                    ],
                                ],
                            ],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '404' => ['description' => 'Flow, run or recording lastshot not found.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                '/flows/{id}/runs/{run}/artifacts/{type}' => [
                    'get' => [
                        'tags' => ['Artifacts'],
                        'summary' => 'List artifacts',
                        'description' => 'Returns the list of artifact files for a given type (screenshots, downloads).',
                        'operationId' => 'listArtifacts',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/id'],
                            ['$ref' => '#/components/parameters/run'],
                            ['name' => 'type', 'in' => 'path', 'required' => true, 'description' => 'Artifact type.', 'schema' => ['type' => 'string', 'enum' => ['screenshots', 'downloads']]],
                        ],
                        'responses' => [
                            '200' => [
                                'description' => 'List of artifact files.',
                                'content' => [
                                    'application/json' => [
                                        'schema' => ['$ref' => '#/components/schemas/ArtifactList'],
                                    ],
                                ],
                            ],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '404' => ['description' => 'Flow or run not found.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '422' => ['description' => 'Invalid artifact type.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                        ],
                    ],
                ],
                '/flows/{id}/runs/{run}/artifacts/{type}/{filename}' => [
                    'get' => [
                        'tags' => ['Artifacts'],
                        'summary' => 'Download an artifact',
                        'description' => 'Downloads a specific artifact file.',
                        'operationId' => 'downloadArtifact',
                        'parameters' => [
                            ['$ref' => '#/components/parameters/id'],
                            ['$ref' => '#/components/parameters/run'],
                            ['name' => 'type', 'in' => 'path', 'required' => true, 'description' => 'Artifact type.', 'schema' => ['type' => 'string', 'enum' => ['screenshots', 'downloads']]],
                            ['name' => 'filename', 'in' => 'path', 'required' => true, 'description' => 'File name to download.', 'schema' => ['type' => 'string']],
                        ],
                        'responses' => [
                            '200' => [
                                'description' => 'The artifact file.',
                                'content' => [
                                    'application/octet-stream' => [
                                        'schema' => ['type' => 'string', 'format' => 'binary'],
                                    ],
                                ],
                            ],
                            '401' => ['description' => 'Unauthorized.', 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]],
                            '404' => ['description' => 'Not found.'],
                        ],
                    ],
                ],
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function workspaceMemberSchemas(): array
    {
        return [
            'WorkspaceMember' => [
                'type' => 'object',
                'required' => ['id', 'workspace_id', 'name', 'email', 'role'],
                'properties' => [
                    'id' => ['type' => 'string'],
                    'workspace_id' => ['type' => 'string'],
                    'name' => ['type' => 'string'],
                    'email' => ['type' => 'string', 'format' => 'email'],
                    'role' => ['type' => 'string', 'enum' => ['admin', 'manager', 'member']],
                    'teams' => [
                        'type' => 'array',
                        'items' => [
                            'type' => 'object',
                            'properties' => [
                                'id' => ['type' => 'string'],
                                'name' => ['type' => 'string'],
                            ],
                        ],
                    ],
                    'created_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                    'updated_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                ],
            ],
            'WorkspaceInvitation' => [
                'type' => 'object',
                'required' => ['id', 'workspace_id', 'email', 'role', 'status', 'expires_at'],
                'properties' => [
                    'id' => ['type' => 'integer'],
                    'workspace_id' => ['type' => 'string'],
                    'email' => ['type' => 'string', 'format' => 'email'],
                    'role' => ['type' => 'string', 'enum' => ['admin', 'manager', 'member']],
                    'status' => ['type' => 'string', 'enum' => ['pending']],
                    'expires_at' => ['type' => 'string', 'format' => 'date-time'],
                ],
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function workspaceMemberPaths(): array
    {
        $workspace = ['$ref' => '#/components/parameters/workspace'];
        $member = ['$ref' => '#/components/parameters/member'];
        $errors = [
            '401' => $this->jsonResponse('API key missing or invalid.', '#/components/schemas/Error'),
            '403' => $this->jsonResponse('Forbidden.', '#/components/schemas/Error'),
            '404' => $this->jsonResponse('Workspace or member not found.', '#/components/schemas/Error'),
            '422' => $this->jsonResponse('Validation failed.', '#/components/schemas/Error'),
        ];
        $membershipPayload = [
            'type' => 'object',
            'required' => ['role'],
            'properties' => [
                'role' => ['type' => 'string', 'enum' => ['admin', 'manager', 'member']],
            ],
        ];
        $update = [
            'tags' => ['Members'],
            'summary' => 'Update a workspace member',
            'description' => 'Updates the member role within this workspace.',
            'requestBody' => $this->jsonRequestBodySchema($membershipPayload),
            'responses' => [
                '200' => $this->jsonResponse('Updated workspace member.', '#/components/schemas/WorkspaceMember'),
                ...$errors,
            ],
        ];

        return [
            '/workspaces/{workspace}/members' => [
                'get' => [
                    'tags' => ['Members'],
                    'summary' => 'List workspace members',
                    'operationId' => 'listWorkspaceMembers',
                    'parameters' => [
                        $workspace,
                        ['name' => 'search', 'in' => 'query', 'schema' => ['type' => 'string']],
                        ['name' => 'limit', 'in' => 'query', 'schema' => ['type' => 'integer', 'default' => 50, 'maximum' => 100]],
                    ],
                    'responses' => [
                        '200' => $this->jsonResponse('Workspace members.', null, [
                            'type' => 'array',
                            'items' => ['$ref' => '#/components/schemas/WorkspaceMember'],
                        ]),
                        ...$errors,
                    ],
                ],
                'post' => [
                    'tags' => ['Members'],
                    'summary' => 'Add or invite a workspace member',
                    'description' => 'Attaches an existing account or emails an invitation when the account does not exist.',
                    'operationId' => 'addWorkspaceMember',
                    'parameters' => [$workspace],
                    'requestBody' => $this->jsonRequestBodySchema([
                        'type' => 'object',
                        'required' => ['email', 'role'],
                        'properties' => [
                            'email' => ['type' => 'string', 'format' => 'email'],
                            ...$membershipPayload['properties'],
                        ],
                    ]),
                    'responses' => [
                        '201' => $this->jsonResponse('Existing account attached.', '#/components/schemas/WorkspaceMember'),
                        '202' => $this->jsonResponse('Invitation sent.', '#/components/schemas/WorkspaceInvitation'),
                        ...$errors,
                    ],
                ],
            ],
            '/workspaces/{workspace}/members/{member}' => [
                'get' => [
                    'tags' => ['Members'],
                    'summary' => 'Get a workspace member',
                    'operationId' => 'getWorkspaceMember',
                    'parameters' => [$workspace, $member],
                    'responses' => [
                        '200' => $this->jsonResponse('Workspace member.', '#/components/schemas/WorkspaceMember'),
                        ...$errors,
                    ],
                ],
                'patch' => ['operationId' => 'updateWorkspaceMember', 'parameters' => [$workspace, $member], ...$update],
                'put' => ['operationId' => 'replaceWorkspaceMember', 'parameters' => [$workspace, $member], ...$update],
                'delete' => [
                    'tags' => ['Members'],
                    'summary' => 'Remove a workspace member',
                    'operationId' => 'removeWorkspaceMember',
                    'parameters' => [$workspace, $member],
                    'responses' => [
                        '200' => $this->jsonResponse('Workspace member removed.'),
                        ...$errors,
                    ],
                ],
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function dataTableSchemas(): array
    {
        $nullableValue = [
            'nullable' => true,
            'oneOf' => [
                ['type' => 'string'],
                ['type' => 'number'],
                ['type' => 'boolean'],
            ],
        ];

        return [
            'DataTableColumn' => [
                'type' => 'object',
                'required' => ['id', 'data_table_id', 'name', 'type', 'position'],
                'properties' => [
                    'id' => ['type' => 'string', 'example' => 'dcol_k8Zt3xQ9mA2f'],
                    'data_table_id' => ['type' => 'string'],
                    'name' => ['type' => 'string'],
                    'type' => ['type' => 'string', 'enum' => ['string', 'number', 'boolean', 'datetime']],
                    'position' => ['type' => 'integer'],
                    'created_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                    'updated_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                ],
            ],
            'DataTable' => [
                'type' => 'object',
                'required' => ['id', 'workspace_id', 'user_id', 'name', 'visibility'],
                'properties' => [
                    'id' => ['type' => 'string', 'example' => 'dtbl_k8Zt3xQ9mA2f'],
                    'workspace_id' => ['type' => 'string'],
                    'user_id' => ['type' => 'string'],
                    'user_name' => ['type' => 'string', 'nullable' => true],
                    'team_id' => ['type' => 'string', 'nullable' => true],
                    'team_name' => ['type' => 'string', 'nullable' => true],
                    'name' => ['type' => 'string'],
                    'description' => ['type' => 'string', 'nullable' => true],
                    'group' => ['type' => 'string', 'nullable' => true],
                    'visibility' => ['type' => 'string', 'enum' => ['owner', 'team', 'workspace']],
                    'columns_count' => ['type' => 'integer'],
                    'rows_count' => ['type' => 'integer', 'nullable' => true],
                    'can_manage' => ['type' => 'boolean'],
                    'columns' => [
                        'type' => 'array',
                        'items' => ['$ref' => '#/components/schemas/DataTableColumn'],
                    ],
                    'created_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                    'updated_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                ],
            ],
            'DataTablePayload' => [
                'type' => 'object',
                'properties' => [
                    'name' => ['type' => 'string', 'maxLength' => 128],
                    'description' => ['type' => 'string', 'nullable' => true],
                    'group' => ['type' => 'string', 'maxLength' => 100, 'nullable' => true],
                    'visibility' => ['type' => 'string', 'enum' => ['owner', 'team', 'workspace']],
                    'team_id' => ['type' => 'string', 'nullable' => true],
                    'user_id' => ['type' => 'string'],
                ],
            ],
            'DataTableCreatePayload' => [
                'allOf' => [
                    ['$ref' => '#/components/schemas/DataTablePayload'],
                    ['type' => 'object', 'required' => ['name']],
                ],
            ],
            'DataTableColumnPayload' => [
                'type' => 'object',
                'required' => ['name', 'type'],
                'properties' => [
                    'name' => ['type' => 'string', 'maxLength' => 63],
                    'type' => ['type' => 'string', 'enum' => ['string', 'number', 'boolean', 'datetime']],
                    'position' => ['type' => 'integer', 'minimum' => 0],
                ],
            ],
            'DataTableColumnUpdatePayload' => [
                'type' => 'object',
                'properties' => [
                    'name' => ['type' => 'string', 'maxLength' => 63],
                    'position' => ['type' => 'integer', 'minimum' => 0],
                ],
            ],
            'DataTableRowValues' => [
                'type' => 'object',
                'description' => 'Values keyed by column name. Column names are matched case-insensitively.',
                'additionalProperties' => $nullableValue,
                'example' => ['email' => 'person@example.com', 'active' => true],
            ],
            'DataTableRow' => [
                'type' => 'object',
                'description' => 'System fields plus one property per Data Table column.',
                'required' => ['id', 'created_at', 'updated_at'],
                'properties' => [
                    'id' => ['type' => 'integer', 'nullable' => true],
                    'created_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                    'updated_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                    'dry_run_state' => ['type' => 'string', 'enum' => ['before', 'after']],
                ],
                'additionalProperties' => $nullableValue,
            ],
            'DataTableFilter' => [
                'type' => 'object',
                'required' => ['column', 'operator'],
                'properties' => [
                    'column' => ['type' => 'string', 'description' => 'Column name or a system column: id, created_at, updated_at.'],
                    'operator' => [
                        'type' => 'string',
                        'enum' => ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is_empty', 'is_not_empty', 'is_true', 'is_false'],
                    ],
                    'value' => $nullableValue,
                ],
            ],
            'DataTableRowsPage' => [
                'type' => 'object',
                'properties' => [
                    'current_page' => ['type' => 'integer'],
                    'data' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/DataTableRow']],
                    'per_page' => ['type' => 'integer'],
                    'total' => ['type' => 'integer'],
                    'last_page' => ['type' => 'integer'],
                ],
            ],
            'DataTablesPage' => [
                'type' => 'object',
                'properties' => [
                    'current_page' => ['type' => 'integer'],
                    'data' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/DataTable']],
                    'per_page' => ['type' => 'integer'],
                    'total' => ['type' => 'integer'],
                    'last_page' => ['type' => 'integer'],
                ],
            ],
            'DataTableAffectedRows' => [
                'type' => 'object',
                'properties' => [
                    'affected' => ['type' => 'integer'],
                    'updated' => ['type' => 'integer'],
                    'deleted' => ['type' => 'integer'],
                    'rows' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/DataTableRow']],
                ],
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function dataTableParameters(): array
    {
        return [
            'dataTable' => [
                'name' => 'dataTable',
                'in' => 'path',
                'required' => true,
                'description' => 'Data Table ID.',
                'schema' => ['type' => 'string'],
            ],
            'dataTableColumn' => [
                'name' => 'column',
                'in' => 'path',
                'required' => true,
                'description' => 'Data Table column ID.',
                'schema' => ['type' => 'string'],
            ],
            'dataTableRow' => [
                'name' => 'row',
                'in' => 'path',
                'required' => true,
                'description' => 'Data Table row ID.',
                'schema' => ['type' => 'integer', 'minimum' => 1],
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function dataTablePaths(): array
    {
        $workspace = ['$ref' => '#/components/parameters/workspace'];
        $table = ['$ref' => '#/components/parameters/dataTable'];
        $column = ['$ref' => '#/components/parameters/dataTableColumn'];
        $row = ['$ref' => '#/components/parameters/dataTableRow'];
        $standardErrors = [
            '401' => $this->jsonResponse('API key missing or invalid.', '#/components/schemas/Error'),
            '403' => $this->jsonResponse('The API key user cannot mutate this resource.', '#/components/schemas/Error'),
            '404' => $this->jsonResponse('Workspace or Data Table resource not found.', '#/components/schemas/Error'),
            '422' => $this->jsonResponse('Validation failed.', '#/components/schemas/Error'),
        ];
        $tableUpdate = [
            'tags' => ['Data Tables'],
            'summary' => 'Update a Data Table',
            'description' => 'Updates metadata, owner, team, or visibility. Omitted fields are unchanged.',
            'requestBody' => $this->jsonRequestBody('#/components/schemas/DataTablePayload'),
            'responses' => [
                '200' => $this->jsonResponse('Updated Data Table.', '#/components/schemas/DataTable'),
                ...$standardErrors,
            ],
        ];
        $columnUpdate = [
            'tags' => ['Data Tables'],
            'summary' => 'Update a Data Table column',
            'description' => 'Renames or repositions a column. Column types are immutable.',
            'requestBody' => $this->jsonRequestBody('#/components/schemas/DataTableColumnUpdatePayload'),
            'responses' => [
                '200' => $this->jsonResponse('Updated column.', '#/components/schemas/DataTableColumn'),
                ...$standardErrors,
            ],
        ];
        $rowUpdate = [
            'tags' => ['Data Tables'],
            'summary' => 'Update a Data Table row',
            'requestBody' => $this->jsonRequestBodySchema([
                'type' => 'object',
                'required' => ['values'],
                'properties' => [
                    'values' => ['$ref' => '#/components/schemas/DataTableRowValues'],
                ],
            ]),
            'responses' => [
                '200' => $this->jsonResponse('Updated row.', '#/components/schemas/DataTableRow'),
                ...$standardErrors,
            ],
        ];

        return [
            '/workspaces/{workspace}/data-tables' => [
                'get' => [
                    'tags' => ['Data Tables'],
                    'summary' => 'List Data Tables',
                    'description' => 'Returns visible Data Tables in a workspace. The workspace path accepts an ID or lookup key.',
                    'operationId' => 'listDataTables',
                    'parameters' => [
                        $workspace,
                        ['name' => 'search', 'in' => 'query', 'schema' => ['type' => 'string']],
                        ['name' => 'group', 'in' => 'query', 'schema' => ['type' => 'string', 'nullable' => true]],
                        ['name' => 'visibility', 'in' => 'query', 'schema' => ['type' => 'string', 'enum' => ['owner', 'team', 'workspace']]],
                        ['name' => 'per_page', 'in' => 'query', 'schema' => ['type' => 'integer', 'default' => 50, 'maximum' => 100]],
                        ['name' => 'page', 'in' => 'query', 'schema' => ['type' => 'integer', 'minimum' => 1]],
                    ],
                    'responses' => [
                        '200' => $this->jsonResponse('Paginated Data Tables.', '#/components/schemas/DataTablesPage'),
                        ...$standardErrors,
                    ],
                ],
                'post' => [
                    'tags' => ['Data Tables'],
                    'summary' => 'Create a Data Table',
                    'operationId' => 'createDataTable',
                    'parameters' => [$workspace],
                    'requestBody' => $this->jsonRequestBody('#/components/schemas/DataTableCreatePayload'),
                    'responses' => [
                        '201' => $this->jsonResponse('Created Data Table.', '#/components/schemas/DataTable'),
                        ...$standardErrors,
                    ],
                ],
            ],
            '/data-tables/{dataTable}' => [
                'get' => [
                    'tags' => ['Data Tables'],
                    'summary' => 'Get a Data Table',
                    'operationId' => 'getDataTable',
                    'parameters' => [$table],
                    'responses' => [
                        '200' => $this->jsonResponse('Data Table with its columns.', '#/components/schemas/DataTable'),
                        ...$standardErrors,
                    ],
                ],
                'patch' => ['operationId' => 'updateDataTable', 'parameters' => [$table], ...$tableUpdate],
                'put' => ['operationId' => 'replaceDataTable', 'parameters' => [$table], ...$tableUpdate],
                'delete' => [
                    'tags' => ['Data Tables'],
                    'summary' => 'Delete a Data Table',
                    'operationId' => 'deleteDataTable',
                    'parameters' => [$table],
                    'responses' => [
                        '200' => $this->jsonResponse('Data Table deleted.'),
                        ...$standardErrors,
                    ],
                ],
            ],
            '/data-tables/{dataTable}/columns' => [
                'get' => [
                    'tags' => ['Data Tables'],
                    'summary' => 'List Data Table columns',
                    'operationId' => 'listDataTableColumns',
                    'parameters' => [$table],
                    'responses' => [
                        '200' => $this->jsonResponse('Ordered columns.', null, [
                            'type' => 'array',
                            'items' => ['$ref' => '#/components/schemas/DataTableColumn'],
                        ]),
                        ...$standardErrors,
                    ],
                ],
                'post' => [
                    'tags' => ['Data Tables'],
                    'summary' => 'Create a Data Table column',
                    'operationId' => 'createDataTableColumn',
                    'parameters' => [$table],
                    'requestBody' => $this->jsonRequestBody('#/components/schemas/DataTableColumnPayload'),
                    'responses' => [
                        '201' => $this->jsonResponse('Created column.', '#/components/schemas/DataTableColumn'),
                        ...$standardErrors,
                    ],
                ],
            ],
            '/data-tables/{dataTable}/columns/reorder' => [
                'put' => [
                    'tags' => ['Data Tables'],
                    'summary' => 'Reorder all Data Table columns',
                    'operationId' => 'reorderDataTableColumns',
                    'parameters' => [$table],
                    'requestBody' => $this->jsonRequestBodySchema([
                        'type' => 'object',
                        'required' => ['ids'],
                        'properties' => [
                            'ids' => ['type' => 'array', 'items' => ['type' => 'string']],
                        ],
                    ]),
                    'responses' => [
                        '200' => $this->jsonResponse('Reordered columns.', null, [
                            'type' => 'array',
                            'items' => ['$ref' => '#/components/schemas/DataTableColumn'],
                        ]),
                        ...$standardErrors,
                    ],
                ],
            ],
            '/data-tables/{dataTable}/columns/{column}' => [
                'get' => [
                    'tags' => ['Data Tables'],
                    'summary' => 'Get a Data Table column',
                    'operationId' => 'getDataTableColumn',
                    'parameters' => [$table, $column],
                    'responses' => [
                        '200' => $this->jsonResponse('Data Table column.', '#/components/schemas/DataTableColumn'),
                        ...$standardErrors,
                    ],
                ],
                'patch' => ['operationId' => 'updateDataTableColumn', 'parameters' => [$table, $column], ...$columnUpdate],
                'put' => ['operationId' => 'replaceDataTableColumn', 'parameters' => [$table, $column], ...$columnUpdate],
                'delete' => [
                    'tags' => ['Data Tables'],
                    'summary' => 'Delete a Data Table column',
                    'operationId' => 'deleteDataTableColumn',
                    'parameters' => [$table, $column],
                    'responses' => [
                        '200' => $this->jsonResponse('Column deleted.'),
                        ...$standardErrors,
                    ],
                ],
            ],
            '/data-tables/{dataTable}/rows' => [
                'get' => [
                    'tags' => ['Data Tables'],
                    'summary' => 'List Data Table rows',
                    'description' => 'Returns named row values. Filters use bracket-style query parameters.',
                    'operationId' => 'listDataTableRows',
                    'parameters' => [
                        $table,
                        ['name' => 'filters', 'in' => 'query', 'style' => 'deepObject', 'explode' => true, 'schema' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/DataTableFilter']]],
                        ['name' => 'match_type', 'in' => 'query', 'schema' => ['type' => 'string', 'enum' => ['all', 'any'], 'default' => 'all']],
                        ['name' => 'sort_by', 'in' => 'query', 'schema' => ['type' => 'string', 'default' => 'id']],
                        ['name' => 'sort_direction', 'in' => 'query', 'schema' => ['type' => 'string', 'enum' => ['asc', 'desc'], 'default' => 'asc']],
                        ['name' => 'per_page', 'in' => 'query', 'schema' => ['type' => 'integer', 'default' => 50, 'maximum' => 100]],
                        ['name' => 'page', 'in' => 'query', 'schema' => ['type' => 'integer', 'minimum' => 1]],
                    ],
                    'responses' => [
                        '200' => $this->jsonResponse('Paginated rows.', '#/components/schemas/DataTableRowsPage'),
                        ...$standardErrors,
                    ],
                ],
                'post' => [
                    'tags' => ['Data Tables'],
                    'summary' => 'Insert a Data Table row',
                    'operationId' => 'insertDataTableRow',
                    'parameters' => [$table],
                    'requestBody' => $this->dataTableRowValuesRequestBody(),
                    'responses' => [
                        '201' => $this->jsonResponse('Inserted row.', '#/components/schemas/DataTableRow'),
                        ...$standardErrors,
                    ],
                ],
                'patch' => [
                    'tags' => ['Data Tables'],
                    'summary' => 'Update Data Table rows by filters',
                    'description' => 'At least one filter is required unless update_all is true.',
                    'operationId' => 'updateDataTableRows',
                    'parameters' => [$table],
                    'requestBody' => $this->dataTableFilteredMutationRequestBody(includeUpdateAll: true),
                    'responses' => [
                        '200' => $this->jsonResponse('Affected rows.', '#/components/schemas/DataTableAffectedRows'),
                        ...$standardErrors,
                    ],
                ],
                'delete' => [
                    'tags' => ['Data Tables'],
                    'summary' => 'Delete Data Table rows',
                    'description' => 'Deletes up to 100 explicit row IDs, or rows matching at least one filter.',
                    'operationId' => 'deleteDataTableRows',
                    'parameters' => [$table],
                    'requestBody' => $this->dataTableFilteredMutationRequestBody(includeIds: true),
                    'responses' => [
                        '200' => $this->jsonResponse('Deleted rows.', '#/components/schemas/DataTableAffectedRows'),
                        ...$standardErrors,
                    ],
                ],
            ],
            '/data-tables/{dataTable}/rows/bulk' => [
                'post' => [
                    'tags' => ['Data Tables'],
                    'summary' => 'Insert Data Table rows in bulk',
                    'operationId' => 'insertDataTableRowsBulk',
                    'parameters' => [$table],
                    'requestBody' => $this->jsonRequestBodySchema([
                        'type' => 'object',
                        'required' => ['rows'],
                        'properties' => [
                            'rows' => [
                                'type' => 'array',
                                'minItems' => 1,
                                'maxItems' => 1000,
                                'items' => ['$ref' => '#/components/schemas/DataTableRowValues'],
                            ],
                        ],
                    ]),
                    'responses' => [
                        '201' => $this->jsonResponse('Rows inserted.'),
                        ...$standardErrors,
                    ],
                ],
            ],
            '/data-tables/{dataTable}/rows/upsert' => [
                'post' => [
                    'tags' => ['Data Tables'],
                    'summary' => 'Upsert Data Table rows',
                    'description' => 'Updates every matching row, or inserts one row when no match exists. At least one filter is required.',
                    'operationId' => 'upsertDataTableRows',
                    'parameters' => [$table],
                    'requestBody' => $this->dataTableFilteredMutationRequestBody(requireFilters: true),
                    'responses' => [
                        '200' => $this->jsonResponse('Affected rows.', '#/components/schemas/DataTableAffectedRows'),
                        ...$standardErrors,
                    ],
                ],
            ],
            '/data-tables/{dataTable}/rows/{row}' => [
                'get' => [
                    'tags' => ['Data Tables'],
                    'summary' => 'Get a Data Table row',
                    'operationId' => 'getDataTableRow',
                    'parameters' => [$table, $row],
                    'responses' => [
                        '200' => $this->jsonResponse('Data Table row.', '#/components/schemas/DataTableRow'),
                        ...$standardErrors,
                    ],
                ],
                'patch' => ['operationId' => 'updateDataTableRow', 'parameters' => [$table, $row], ...$rowUpdate],
                'put' => ['operationId' => 'replaceDataTableRow', 'parameters' => [$table, $row], ...$rowUpdate],
                'delete' => [
                    'tags' => ['Data Tables'],
                    'summary' => 'Delete a Data Table row',
                    'operationId' => 'deleteDataTableRow',
                    'parameters' => [$table, $row],
                    'responses' => [
                        '200' => $this->jsonResponse('Row deleted.'),
                        ...$standardErrors,
                    ],
                ],
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function mediaSchemas(): array
    {
        $maxUploadBytes = config()->integer('puppetflow.media.max_upload_bytes', 50 * 1024 * 1024);
        $maxUploadMb = (int) ceil($maxUploadBytes / 1024 / 1024);
        $maxUploadFiles = config()->integer('puppetflow.media.max_upload_files');
        $visibility = [
            'type' => 'string',
            'enum' => app(FeatureFlagService::class)->allowedScopes(),
            'description' => 'Access scope. The enum only contains scopes enabled for this instance.',
        ];
        $page = fn (string $ref): array => [
            'type' => 'object',
            'properties' => [
                'current_page' => ['type' => 'integer'],
                'data' => ['type' => 'array', 'items' => ['$ref' => $ref]],
                'per_page' => ['type' => 'integer'],
                'total' => ['type' => 'integer'],
                'last_page' => ['type' => 'integer'],
            ],
        ];

        return [
            'Media' => [
                'type' => 'object',
                'required' => ['id', 'workspace_id', 'user_id', 'name', 'original_filename', 'mime_type', 'size_bytes', 'visibility', 'download_url'],
                'properties' => [
                    'id' => ['type' => 'string', 'example' => 'media_k8Zt3xQ9mA2f'],
                    'workspace_id' => ['type' => 'string'],
                    'user_id' => ['type' => 'string'],
                    'user_name' => ['type' => 'string', 'nullable' => true],
                    'team_id' => ['type' => 'string', 'nullable' => true],
                    'team_name' => ['type' => 'string', 'nullable' => true],
                    'folder_id' => ['type' => 'string', 'nullable' => true],
                    'name' => ['type' => 'string'],
                    'original_filename' => ['type' => 'string'],
                    'extension' => ['type' => 'string', 'nullable' => true],
                    'mime_type' => ['type' => 'string', 'example' => 'image/png'],
                    'size_bytes' => ['type' => 'integer', 'description' => 'Stored file size counted against the instance storage quota.'],
                    'visibility' => $visibility,
                    'description' => ['type' => 'string', 'nullable' => true],
                    'alt_text' => ['type' => 'string', 'nullable' => true],
                    'tags' => [
                        'type' => 'array',
                        'description' => 'Unique labels attached to the media item. The Media Library reuses these values as tag suggestions.',
                        'items' => ['type' => 'string'],
                        'example' => ['invoice', 'approved'],
                    ],
                    'thumbnail_url' => ['type' => 'string', 'format' => 'uri', 'nullable' => true, 'description' => 'Authenticated image preview or generated video frame endpoint.'],
                    'download_url' => ['type' => 'string', 'format' => 'uri', 'description' => 'Authenticated API download endpoint.'],
                    'can_manage' => ['type' => 'boolean'],
                    'created_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                    'updated_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                ],
            ],
            'MediaUploadPayload' => [
                'type' => 'object',
                'required' => ['files'],
                'description' => 'Multipart body. Use folder_id alone for a folder target, or team_id / visibility / user_id for a scope root. Defaults to your personal root.',
                'properties' => [
                    'files' => [
                        'type' => 'array',
                        'minItems' => 1,
                        'maxItems' => $maxUploadFiles,
                        'description' => "One to {$maxUploadFiles} files, up to {$maxUploadMb} MB per file.",
                        'items' => ['type' => 'string', 'format' => 'binary'],
                    ],
                    'folder_id' => ['type' => 'string', 'nullable' => true],
                    'visibility' => $visibility,
                    'team_id' => ['type' => 'string', 'nullable' => true],
                    'user_id' => ['type' => 'string'],
                ],
            ],
            'MediaUpdatePayload' => [
                'type' => 'object',
                'description' => 'Omitted fields are unchanged. Use folder_id alone for a folder move, or visibility / team_id / user_id for a scope-root move. Scope and ownership changes require the corresponding rights.',
                'properties' => [
                    'name' => ['type' => 'string', 'maxLength' => 255],
                    'description' => ['type' => 'string', 'maxLength' => 5000, 'nullable' => true],
                    'alt_text' => ['type' => 'string', 'maxLength' => 500, 'nullable' => true],
                    'tags' => [
                        'type' => 'array',
                        'description' => 'Replaces the complete tag list. Values must be unique, with at most 50 tags.',
                        'maxItems' => 50,
                        'uniqueItems' => true,
                        'items' => ['type' => 'string', 'maxLength' => 100],
                    ],
                    'visibility' => $visibility,
                    'team_id' => ['type' => 'string', 'nullable' => true],
                    'user_id' => ['type' => 'string'],
                    'folder_id' => ['type' => 'string', 'nullable' => true],
                ],
            ],
            'MediaTextContent' => [
                'type' => 'object',
                'required' => ['content'],
                'properties' => [
                    'content' => ['type' => 'string', 'description' => 'Complete UTF-8 content of a recognized text, source code, or structured data media file.'],
                ],
            ],
            'MediaBatchDeletePayload' => [
                'type' => 'object',
                'anyOf' => [
                    ['required' => ['ids']],
                    ['required' => ['folder_ids']],
                ],
                'properties' => [
                    'ids' => ['type' => 'array', 'minItems' => 1, 'maxItems' => 200, 'items' => ['type' => 'string']],
                    'folder_ids' => ['type' => 'array', 'minItems' => 1, 'maxItems' => 200, 'items' => ['type' => 'string']],
                ],
            ],
            'MediaPage' => $page('#/components/schemas/Media'),
            'MediaFolder' => [
                'type' => 'object',
                'required' => ['id', 'workspace_id', 'user_id', 'name', 'visibility'],
                'properties' => [
                    'id' => ['type' => 'string', 'example' => 'mfld_k8Zt3xQ9mA2f'],
                    'workspace_id' => ['type' => 'string'],
                    'user_id' => ['type' => 'string'],
                    'user_name' => ['type' => 'string', 'nullable' => true],
                    'team_id' => ['type' => 'string', 'nullable' => true],
                    'team_name' => ['type' => 'string', 'nullable' => true],
                    'parent_id' => ['type' => 'string', 'nullable' => true],
                    'name' => ['type' => 'string'],
                    'visibility' => $visibility,
                    'sort_order' => ['type' => 'integer'],
                    'children_count' => ['type' => 'integer'],
                    'assets_count' => ['type' => 'integer'],
                    'can_manage' => ['type' => 'boolean'],
                    'created_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                    'updated_at' => ['type' => 'string', 'format' => 'date-time', 'nullable' => true],
                ],
            ],
            'MediaFolderCreatePayload' => [
                'type' => 'object',
                'required' => ['name'],
                'description' => 'Use parent_id alone for a parent folder, or team_id / visibility / user_id for a scope root. Defaults to your personal root.',
                'properties' => [
                    'name' => ['type' => 'string', 'maxLength' => 255],
                    'parent_id' => ['type' => 'string', 'nullable' => true],
                    'visibility' => $visibility,
                    'team_id' => ['type' => 'string', 'nullable' => true],
                    'user_id' => ['type' => 'string'],
                ],
            ],
            'MediaFolderUpdatePayload' => [
                'type' => 'object',
                'description' => 'Omitted fields are unchanged. Use parent_id to move under a folder, or visibility / team_id / user_id to move to a scope root and re-assign its content. These location forms cannot be combined.',
                'properties' => [
                    'name' => ['type' => 'string', 'maxLength' => 255],
                    'sort_order' => ['type' => 'integer', 'minimum' => 0],
                    'parent_id' => ['type' => 'string', 'nullable' => true],
                    'visibility' => $visibility,
                    'team_id' => ['type' => 'string', 'nullable' => true],
                    'user_id' => ['type' => 'string'],
                ],
            ],
            'MediaFoldersPage' => $page('#/components/schemas/MediaFolder'),
        ];
    }

    /** @return array<string, mixed> */
    private function mediaParameters(): array
    {
        return [
            'media' => [
                'name' => 'media',
                'in' => 'path',
                'required' => true,
                'description' => 'Media ID.',
                'schema' => ['type' => 'string'],
            ],
            'mediaFolder' => [
                'name' => 'folder',
                'in' => 'path',
                'required' => true,
                'description' => 'Media folder ID.',
                'schema' => ['type' => 'string'],
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function mediaPaths(): array
    {
        $workspace = ['$ref' => '#/components/parameters/workspace'];
        $media = ['$ref' => '#/components/parameters/media'];
        $folder = ['$ref' => '#/components/parameters/mediaFolder'];
        $visibilityQuery = [
            'name' => 'visibility',
            'in' => 'query',
            'schema' => [
                'type' => 'string',
                'enum' => app(FeatureFlagService::class)->allowedScopes(),
            ],
        ];
        $pagination = [
            ['name' => 'per_page', 'in' => 'query', 'schema' => ['type' => 'integer', 'default' => 50, 'maximum' => 100]],
            ['name' => 'page', 'in' => 'query', 'schema' => ['type' => 'integer', 'minimum' => 1]],
        ];
        $standardErrors = [
            '401' => $this->jsonResponse('API key missing or invalid.', '#/components/schemas/Error'),
            '403' => $this->jsonResponse('The API key user cannot mutate this resource.', '#/components/schemas/Error'),
            '404' => $this->jsonResponse('Workspace, media or folder not found.', '#/components/schemas/Error'),
            '422' => $this->jsonResponse('Validation failed.', '#/components/schemas/Error'),
        ];
        $mediaUpdate = [
            'tags' => ['Media Library'],
            'summary' => 'Update a media',
            'description' => 'Updates metadata, including the complete tag list, and optionally changes the owner, visibility, team or folder.',
            'requestBody' => $this->jsonRequestBody('#/components/schemas/MediaUpdatePayload'),
            'responses' => [
                '200' => $this->jsonResponse('Updated media.', '#/components/schemas/Media'),
                ...$standardErrors,
            ],
        ];
        $folderUpdate = [
            'tags' => ['Media Library'],
            'summary' => 'Update a media folder',
            'description' => 'Renames, reorders or moves a folder.',
            'requestBody' => $this->jsonRequestBody('#/components/schemas/MediaFolderUpdatePayload'),
            'responses' => [
                '200' => $this->jsonResponse('Updated folder.', '#/components/schemas/MediaFolder'),
                ...$standardErrors,
            ],
        ];

        return [
            '/workspaces/{workspace}/media' => [
                'get' => [
                    'tags' => ['Media Library'],
                    'summary' => 'List media',
                    'description' => 'Returns visible media in a workspace. Pass an empty folder_id to list the roots only.',
                    'operationId' => 'listMedia',
                    'parameters' => [
                        $workspace,
                        ['name' => 'search', 'in' => 'query', 'description' => 'Matches the name or original file name.', 'schema' => ['type' => 'string']],
                        ['name' => 'folder_id', 'in' => 'query', 'schema' => ['type' => 'string', 'nullable' => true]],
                        $visibilityQuery,
                        ['name' => 'team_id', 'in' => 'query', 'schema' => ['type' => 'string']],
                        ['name' => 'mime_type', 'in' => 'query', 'description' => 'Prefix match, e.g. image/ or application/pdf.', 'schema' => ['type' => 'string']],
                        ['name' => 'tag', 'in' => 'query', 'description' => 'Exact tag match.', 'schema' => ['type' => 'string', 'maxLength' => 100]],
                        ...$pagination,
                    ],
                    'responses' => [
                        '200' => $this->jsonResponse('Paginated media.', '#/components/schemas/MediaPage'),
                        ...$standardErrors,
                    ],
                ],
                'post' => [
                    'tags' => ['Media Library'],
                    'summary' => 'Upload media',
                    'description' => 'Uploads files in one multipart request through the API server, up to the configured batch limit. Every file is rolled back when one upload fails. The web application may instead use direct presigned uploads when S3 or R2 is configured. Returned `media_*` IDs can be used as `${mediaAssets.media_*}` flow-input references or passed directly to `$upload(selector, mediaId)`.',
                    'operationId' => 'uploadMedia',
                    'parameters' => [$workspace],
                    'requestBody' => [
                        'required' => true,
                        'content' => ['multipart/form-data' => ['schema' => ['$ref' => '#/components/schemas/MediaUploadPayload']]],
                    ],
                    'responses' => [
                        '201' => $this->jsonResponse('Created media.', null, [
                            'type' => 'object',
                            'properties' => ['media' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/Media']]],
                        ]),
                        '413' => ['description' => 'The multipart request exceeds the configured ingress limit. The proxy may return a plain or HTML error body.'],
                        ...$standardErrors,
                    ],
                ],
            ],
            '/workspaces/{workspace}/media/batch-delete' => [
                'post' => [
                    'tags' => ['Media Library'],
                    'summary' => 'Delete several media and folders',
                    'operationId' => 'batchDeleteMedia',
                    'parameters' => [$workspace],
                    'requestBody' => $this->jsonRequestBody('#/components/schemas/MediaBatchDeletePayload'),
                    'responses' => [
                        '200' => $this->jsonResponse('Number of deleted items.', null, [
                            'type' => 'object',
                            'properties' => ['deleted' => ['type' => 'integer']],
                        ]),
                        ...$standardErrors,
                    ],
                ],
            ],
            '/media/{media}' => [
                'get' => [
                    'tags' => ['Media Library'],
                    'summary' => 'Get a media',
                    'operationId' => 'getMedia',
                    'parameters' => [$media],
                    'responses' => [
                        '200' => $this->jsonResponse('Media.', '#/components/schemas/Media'),
                        ...$standardErrors,
                    ],
                ],
                'patch' => ['operationId' => 'updateMedia', 'parameters' => [$media], ...$mediaUpdate],
                'delete' => [
                    'tags' => ['Media Library'],
                    'summary' => 'Delete a media',
                    'operationId' => 'deleteMedia',
                    'parameters' => [$media],
                    'responses' => [
                        '200' => $this->jsonResponse('Media deleted.', '#/components/schemas/MessageResponse'),
                        ...$standardErrors,
                    ],
                ],
            ],
            '/media/{media}/content' => [
                'get' => [
                    'tags' => ['Media Library'],
                    'summary' => 'Get text media content',
                    'description' => 'Returns the complete UTF-8 content of a recognized text, source code, or structured data media file, including JSON, YAML, TOML, and XML.',
                    'operationId' => 'getMediaTextContent',
                    'parameters' => [$media],
                    'responses' => [
                        '200' => $this->jsonResponse('Text media content.', '#/components/schemas/MediaTextContent'),
                        ...$standardErrors,
                    ],
                ],
                'patch' => [
                    'tags' => ['Media Library'],
                    'summary' => 'Update text media content',
                    'description' => 'Atomically replaces a recognized UTF-8 text, source code, or structured data media file while preserving its Media Library ID, storage quota accounting, and configured local or remote storage.',
                    'operationId' => 'updateMediaTextContent',
                    'parameters' => [$media],
                    'requestBody' => $this->jsonRequestBody('#/components/schemas/MediaTextContent'),
                    'responses' => [
                        '200' => $this->jsonResponse('Updated media.', '#/components/schemas/Media'),
                        ...$standardErrors,
                    ],
                ],
            ],
            '/media/{media}/download' => [
                'get' => [
                    'tags' => ['Media Library'],
                    'summary' => 'Download a media file',
                    'description' => 'Streams the binary as an attachment. Pass inline=1 to get a Content-Disposition: inline response for browser-safe types (415 otherwise).',
                    'operationId' => 'downloadMedia',
                    'parameters' => [
                        $media,
                        ['name' => 'inline', 'in' => 'query', 'schema' => ['type' => 'boolean', 'default' => false]],
                    ],
                    'responses' => [
                        '200' => [
                            'description' => 'File content.',
                            'content' => ['*/*' => ['schema' => ['type' => 'string', 'format' => 'binary']]],
                        ],
                        '415' => $this->jsonResponse('The file type cannot be previewed inline.', '#/components/schemas/Error'),
                        ...$standardErrors,
                    ],
                ],
            ],
            '/media/{media}/thumbnail' => [
                'get' => [
                    'tags' => ['Media Library'],
                    'summary' => 'Download a video thumbnail',
                    'description' => 'Streams the generated JPEG frame for a video. Returns 404 when no frame could be generated.',
                    'operationId' => 'downloadMediaThumbnail',
                    'parameters' => [$media],
                    'responses' => [
                        '200' => [
                            'description' => 'JPEG thumbnail.',
                            'content' => ['image/jpeg' => ['schema' => ['type' => 'string', 'format' => 'binary']]],
                        ],
                        ...$standardErrors,
                    ],
                ],
            ],
            '/workspaces/{workspace}/media-folders' => [
                'get' => [
                    'tags' => ['Media Library'],
                    'summary' => 'List media folders',
                    'description' => 'Returns visible folders in a workspace. Pass an empty parent_id to list the roots only.',
                    'operationId' => 'listMediaFolders',
                    'parameters' => [
                        $workspace,
                        ['name' => 'search', 'in' => 'query', 'schema' => ['type' => 'string']],
                        ['name' => 'parent_id', 'in' => 'query', 'schema' => ['type' => 'string', 'nullable' => true]],
                        $visibilityQuery,
                        ['name' => 'team_id', 'in' => 'query', 'schema' => ['type' => 'string']],
                        ...$pagination,
                    ],
                    'responses' => [
                        '200' => $this->jsonResponse('Paginated folders.', '#/components/schemas/MediaFoldersPage'),
                        ...$standardErrors,
                    ],
                ],
                'post' => [
                    'tags' => ['Media Library'],
                    'summary' => 'Create a media folder',
                    'operationId' => 'createMediaFolder',
                    'parameters' => [$workspace],
                    'requestBody' => $this->jsonRequestBody('#/components/schemas/MediaFolderCreatePayload'),
                    'responses' => [
                        '201' => $this->jsonResponse('Created folder.', '#/components/schemas/MediaFolder'),
                        ...$standardErrors,
                    ],
                ],
            ],
            '/media-folders/{folder}' => [
                'get' => [
                    'tags' => ['Media Library'],
                    'summary' => 'Get a media folder',
                    'operationId' => 'getMediaFolder',
                    'parameters' => [$folder],
                    'responses' => [
                        '200' => $this->jsonResponse('Media folder.', '#/components/schemas/MediaFolder'),
                        ...$standardErrors,
                    ],
                ],
                'patch' => ['operationId' => 'updateMediaFolder', 'parameters' => [$folder], ...$folderUpdate],
                'delete' => [
                    'tags' => ['Media Library'],
                    'summary' => 'Delete a media folder',
                    'description' => 'Deletes the folder with its sub-folders and files.',
                    'operationId' => 'deleteMediaFolder',
                    'parameters' => [$folder],
                    'responses' => [
                        '200' => $this->jsonResponse('Folder deleted.', '#/components/schemas/MessageResponse'),
                        ...$standardErrors,
                    ],
                ],
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function jsonRequestBody(string $schemaRef): array
    {
        return $this->jsonRequestBodySchema(['$ref' => $schemaRef]);
    }

    /**
     * @param  array<string, mixed>  $schema
     * @return array{required: true, content: array{'application/json': array{schema: array<string, mixed>}}}
     */
    private function jsonRequestBodySchema(array $schema): array
    {
        return [
            'required' => true,
            'content' => [
                'application/json' => ['schema' => $schema],
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function dataTableRowValuesRequestBody(): array
    {
        return $this->jsonRequestBodySchema([
            'type' => 'object',
            'required' => ['values'],
            'properties' => [
                'values' => ['$ref' => '#/components/schemas/DataTableRowValues'],
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function dataTableFilteredMutationRequestBody(
        bool $requireFilters = false,
        bool $includeUpdateAll = false,
        bool $includeIds = false,
    ): array {
        $properties = [
            'filters' => [
                'type' => 'array',
                'minItems' => $requireFilters ? 1 : 0,
                'maxItems' => 20,
                'items' => ['$ref' => '#/components/schemas/DataTableFilter'],
            ],
            'match_type' => ['type' => 'string', 'enum' => ['all', 'any'], 'default' => 'all'],
            'values' => ['$ref' => '#/components/schemas/DataTableRowValues'],
            'dry_run' => ['type' => 'boolean', 'default' => false],
        ];
        if ($includeUpdateAll) {
            $properties['update_all'] = ['type' => 'boolean', 'default' => false];
        }
        if ($includeIds) {
            $properties['ids'] = [
                'type' => 'array',
                'minItems' => 1,
                'maxItems' => 100,
                'items' => ['type' => 'integer', 'minimum' => 1],
            ];
            unset($properties['values']);
        }

        return $this->jsonRequestBodySchema([
            'type' => 'object',
            'required' => $requireFilters ? ['filters', 'values'] : ($includeIds ? [] : ['values']),
            'properties' => $properties,
        ]);
    }

    /**
     * @param  array<string, mixed>|null  $schema
     * @return array<string, mixed>
     */
    private function jsonResponse(
        string $description,
        ?string $schemaRef = null,
        ?array $schema = null,
    ): array {
        $response = ['description' => $description];
        if ($schemaRef !== null || $schema !== null) {
            $response['content'] = [
                'application/json' => [
                    'schema' => $schema ?? ['$ref' => $schemaRef],
                ],
            ];
        }

        return $response;
    }
}
