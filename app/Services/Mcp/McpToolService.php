<?php

namespace App\Services\Mcp;

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMcpSetting;
use App\Services\Mcp\Tools\AiModelMcpTools;
use App\Services\Mcp\Tools\ArtifactMcpTools;
use App\Services\Mcp\Tools\DataTableMcpTools;
use App\Services\Mcp\Tools\FlowAutomationMcpTools;
use App\Services\Mcp\Tools\FlowMcpTools;
use App\Services\Mcp\Tools\MailboxMcpTools;
use App\Services\Mcp\Tools\McpToolContext;
use App\Services\Mcp\Tools\McpToolHandler;
use App\Services\Mcp\Tools\MediaLibraryMcpTools;
use App\Services\Mcp\Tools\NotificationChannelMcpTools;
use App\Services\Mcp\Tools\RunMcpTools;
use App\Services\Mcp\Tools\SnippetMcpTools;
use App\Services\Mcp\Tools\TeamMcpTools;
use App\Services\Mcp\Tools\WorkspaceMcpTools;
use Illuminate\Validation\ValidationException;

/**
 * @phpstan-type McpArguments array<string, mixed>
 * @phpstan-type McpToolDefinition array{name: string, title: string, description: string, inputSchema: array<string, mixed>, outputSchema: array<string, mixed>, annotations: array{title: string, readOnlyHint: bool, destructiveHint: bool, openWorldHint: bool}}
 */
final class McpToolService
{
    /** @var array<string, array{title: string, readOnly: bool}> */
    private const TOOL_METADATA = [
        'search_flows' => ['title' => 'Search Flows', 'readOnly' => true],
        'get_flow_details' => ['title' => 'Get Flow Details', 'readOnly' => true],
        'get_flow_source' => ['title' => 'Get Flow Source', 'readOnly' => true],
        'list_folders' => ['title' => 'List Folders', 'readOnly' => true],
        'get_flow_creation_options' => ['title' => 'Get Flow Creation Options', 'readOnly' => true],
        'get_nodal_catalog' => ['title' => 'Get Nodal Catalog', 'readOnly' => true],
        'list_flow_resources' => ['title' => 'List Flow Resources', 'readOnly' => true],
        'update_flow_settings' => ['title' => 'Update Flow Settings', 'readOnly' => false],
        'write_code_flow' => ['title' => 'Write Code Flow', 'readOnly' => false],
        'write_nodal_flow' => ['title' => 'Write Nodal Flow', 'readOnly' => false],
        'publish_flow' => ['title' => 'Publish Flow', 'readOnly' => false],
        'unpublish_flow' => ['title' => 'Unpublish Flow', 'readOnly' => false],
        'search_data_tables' => ['title' => 'Search Data Tables', 'readOnly' => true],
        'get_data_table' => ['title' => 'Get Data Table', 'readOnly' => true],
        'get_data_table_rows' => ['title' => 'Get Data Table Rows', 'readOnly' => true],
        'update_data_table' => ['title' => 'Update Data Table', 'readOnly' => false],
        'search_mailboxes' => ['title' => 'Search Mailboxes', 'readOnly' => true],
        'get_mailbox' => ['title' => 'Get Mailbox', 'readOnly' => true],
        'update_mailbox' => ['title' => 'Update Mailbox', 'readOnly' => false],
        'search_notification_channels' => ['title' => 'Search Notification Channels', 'readOnly' => true],
        'get_notification_channel' => ['title' => 'Get Notification Channel', 'readOnly' => true],
        'update_notification_channel' => ['title' => 'Update Notification Channel', 'readOnly' => false],
        'search_media_assets' => ['title' => 'Search Media Assets', 'readOnly' => true],
        'get_media_asset' => ['title' => 'Get Media Asset', 'readOnly' => true],
        'search_media_folders' => ['title' => 'Search Media Folders', 'readOnly' => true],
        'get_media_folder' => ['title' => 'Get Media Folder', 'readOnly' => true],
        'upload_media_asset' => ['title' => 'Upload Media Asset', 'readOnly' => false],
        'update_media_asset' => ['title' => 'Update Media Asset', 'readOnly' => false],
        'update_media_folder' => ['title' => 'Update Media Folder', 'readOnly' => false],
        'search_ai_models' => ['title' => 'Search AI Models', 'readOnly' => true],
        'get_ai_model' => ['title' => 'Get AI Model', 'readOnly' => true],
        'update_ai_model' => ['title' => 'Update AI Model', 'readOnly' => false],
        'list_flow_triggers' => ['title' => 'List Flow Triggers', 'readOnly' => true],
        'create_flow_trigger' => ['title' => 'Create Flow Trigger', 'readOnly' => false],
        'update_flow_trigger' => ['title' => 'Update Flow Trigger', 'readOnly' => false],
        'delete_flow_trigger' => ['title' => 'Delete Flow Trigger', 'readOnly' => false],
        'list_flow_actions' => ['title' => 'List Flow Actions', 'readOnly' => true],
        'create_flow_action' => ['title' => 'Create Flow Action', 'readOnly' => false],
        'update_flow_action' => ['title' => 'Update Flow Action', 'readOnly' => false],
        'delete_flow_action' => ['title' => 'Delete Flow Action', 'readOnly' => false],
        'search_snippets' => ['title' => 'Search Snippets', 'readOnly' => true],
        'get_snippet_source' => ['title' => 'Get Snippet Source', 'readOnly' => true],
        'get_snippet_creation_options' => ['title' => 'Get Snippet Creation Options', 'readOnly' => true],
        'write_code_snippet' => ['title' => 'Write Code Snippet', 'readOnly' => false],
        'write_nodal_snippet' => ['title' => 'Write Nodal Snippet', 'readOnly' => false],
        'publish_snippet' => ['title' => 'Publish Snippet', 'readOnly' => false],
        'unpublish_snippet' => ['title' => 'Unpublish Snippet', 'readOnly' => false],
        'search_runs' => ['title' => 'Search Runs', 'readOnly' => true],
        'list_flow_runs' => ['title' => 'List Flow Runs', 'readOnly' => true],
        'run_flow' => ['title' => 'Run Flow', 'readOnly' => false],
        'get_run' => ['title' => 'Get Run', 'readOnly' => true],
        'get_run_result' => ['title' => 'Get Run Result', 'readOnly' => true],
        'continue_human_validation' => ['title' => 'Continue Human Validation', 'readOnly' => false],
        'list_artifacts' => ['title' => 'List Artifacts', 'readOnly' => true],
        'get_latest_screenshot' => ['title' => 'Get Latest Screenshot', 'readOnly' => true],
        'download_artifact' => ['title' => 'Download Artifact', 'readOnly' => true],
        'get_recording' => ['title' => 'Get Recording', 'readOnly' => true],
        'get_recording_lastshot' => ['title' => 'Get Last Recording Frame', 'readOnly' => true],
        'get_current_workspace' => ['title' => 'Get Current Workspace', 'readOnly' => true],
        'update_current_workspace' => ['title' => 'Update Current Workspace', 'readOnly' => false],
        'list_workspace_members' => ['title' => 'List Workspace Members', 'readOnly' => true],
        'list_teams' => ['title' => 'List Teams', 'readOnly' => true],
        'get_team' => ['title' => 'Get Team', 'readOnly' => true],
        'create_team' => ['title' => 'Create Team', 'readOnly' => false],
        'update_team' => ['title' => 'Update Team', 'readOnly' => false],
        'add_team_members' => ['title' => 'Add Team Members', 'readOnly' => false],
        'replace_team_members' => ['title' => 'Replace Team Members', 'readOnly' => false],
        'set_member_teams' => ['title' => 'Set Member Teams', 'readOnly' => false],
    ];

    private const DESTRUCTIVE_TOOLS = [
        'write_code_flow',
        'write_nodal_flow',
        'create_flow_trigger',
        'update_flow_trigger',
        'delete_flow_trigger',
        'create_flow_action',
        'update_flow_action',
        'delete_flow_action',
        'write_code_snippet',
        'write_nodal_snippet',
        'run_flow',
        'continue_human_validation',
        'replace_team_members',
        'set_member_teams',
    ];

    private const OPEN_WORLD_TOOLS = [
        'create_flow_trigger',
        'update_flow_trigger',
        'create_flow_action',
        'update_flow_action',
        'run_flow',
        'continue_human_validation',
    ];

    private const OUTPUT_FIELDS = [
        'search_flows' => ['flows' => 'array'],
        'get_flow_details' => ['flow' => 'object'],
        'get_flow_source' => ['flow' => 'object'],
        'list_folders' => ['folders' => 'array'],
        'get_flow_creation_options' => ['visibility_scopes' => 'array', 'teams' => 'array', 'folders' => 'array', 'defaults' => 'object'],
        'get_nodal_catalog' => ['mode' => 'string', 'nodes' => 'array', 'total' => 'integer', 'next_cursor' => 'nullable-string'],
        'list_flow_resources' => ['resources' => 'object'],
        'update_flow_settings' => ['flow' => 'object'],
        'write_code_flow' => ['flow' => 'object'],
        'write_nodal_flow' => ['flow' => 'object'],
        'publish_flow' => ['flow' => 'object'],
        'unpublish_flow' => ['flow' => 'object'],
        'search_data_tables' => ['data_tables' => 'array'],
        'get_data_table' => ['data_table' => 'object'],
        'get_data_table_rows' => [
            'data_table_id' => 'string',
            'rows' => 'array',
            'limit' => 'integer',
            'offset' => 'integer',
            'has_more' => 'boolean',
        ],
        'update_data_table' => ['data_table' => 'object'],
        'search_mailboxes' => ['mailboxes' => 'array'],
        'get_mailbox' => ['mailbox' => 'object'],
        'update_mailbox' => ['mailbox' => 'object'],
        'search_notification_channels' => ['notification_channels' => 'array'],
        'get_notification_channel' => ['notification_channel' => 'object'],
        'update_notification_channel' => ['notification_channel' => 'object'],
        'search_media_assets' => [
            'media_assets' => 'array',
            'limit' => 'integer',
            'offset' => 'integer',
            'has_more' => 'boolean',
        ],
        'get_media_asset' => ['media_asset' => 'object'],
        'search_media_folders' => ['media_folders' => 'array'],
        'get_media_folder' => ['media_folder' => 'object'],
        'upload_media_asset' => ['media_asset' => 'object'],
        'update_media_asset' => ['media_asset' => 'object'],
        'update_media_folder' => ['media_folder' => 'object'],
        'search_ai_models' => ['ai_models' => 'array'],
        'get_ai_model' => ['ai_model' => 'object'],
        'update_ai_model' => ['ai_model' => 'object'],
        'list_flow_triggers' => ['triggers' => 'array'],
        'create_flow_trigger' => ['trigger' => 'object'],
        'update_flow_trigger' => ['trigger' => 'object'],
        'delete_flow_trigger' => ['deleted' => 'boolean', 'trigger_id' => 'string'],
        'list_flow_actions' => ['actions' => 'array'],
        'create_flow_action' => ['action' => 'object'],
        'update_flow_action' => ['action' => 'object'],
        'delete_flow_action' => ['deleted' => 'boolean', 'action_id' => 'string'],
        'search_snippets' => ['snippets' => 'array'],
        'get_snippet_source' => ['snippet' => 'object'],
        'get_snippet_creation_options' => ['visibility_scopes' => 'array', 'teams' => 'array', 'defaults' => 'object'],
        'write_code_snippet' => ['snippet' => 'object'],
        'write_nodal_snippet' => ['snippet' => 'object'],
        'publish_snippet' => ['snippet' => 'object'],
        'unpublish_snippet' => ['snippet' => 'object'],
        'search_runs' => ['runs' => 'array'],
        'list_flow_runs' => ['runs' => 'array'],
        'run_flow' => ['run_id' => 'integer', 'flow_id' => 'string', 'status' => 'string'],
        'get_run' => ['run' => 'object'],
        'get_run_result' => ['run_id' => 'integer', 'status' => 'string', 'output' => 'mixed', 'error_message' => 'nullable-string', 'duration_ms' => 'nullable-integer'],
        'continue_human_validation' => ['run_id' => 'integer', 'status' => 'string', 'continue_requested' => 'boolean'],
        'list_artifacts' => ['artifacts' => 'array'],
        'get_latest_screenshot' => ['run_id' => 'integer', 'screenshot' => 'mixed'],
        'download_artifact' => ['artifact' => 'object', 'authorization' => 'string'],
        'get_recording' => ['run_id' => 'integer', 'url' => 'string', 'authorization' => 'string'],
        'get_recording_lastshot' => ['run_id' => 'integer', 'url' => 'string', 'authorization' => 'string'],
        'get_current_workspace' => ['workspace' => 'object'],
        'update_current_workspace' => ['workspace' => 'object'],
        'list_workspace_members' => ['members' => 'array'],
        'list_teams' => ['teams' => 'array'],
        'get_team' => ['team' => 'object'],
        'create_team' => ['team' => 'object'],
        'update_team' => ['team' => 'object'],
        'add_team_members' => ['team' => 'object'],
        'replace_team_members' => ['team' => 'object'],
        'set_member_teams' => ['user_id' => 'string', 'workspace_id' => 'string', 'team_ids' => 'array'],
    ];

    private const ALWAYS_AVAILABLE_TOOLS = [
        'get_nodal_catalog',
    ];

    private const HUMAN_DESCRIPTIONS = [
        'get_flow_details' => 'Read the details and Flow Inputs of a flow exposed to MCP.',
        'run_flow' => 'Run a flow exposed to MCP, optionally overriding its Flow Inputs.',
        'get_nodal_catalog' => 'Browse the nodes and capabilities available when building visual flows.',
        'list_flow_resources' => 'List the workspace resources that can be referenced by a flow or snippet.',
        'update_flow_settings' => 'Update FINALLY, queue, and proxy settings without replacing flow content.',
        'write_code_flow' => 'Create or update a flow written in JavaScript.',
        'write_nodal_flow' => 'Create or update a visual flow built from connected nodes.',
        'publish_flow' => 'Publish the current flow draft as a new version.',
        'unpublish_flow' => 'Unpublish a flow while keeping its draft and version history.',
        'search_data_tables' => 'Find Data Tables and inspect their groups, schemas, and capabilities.',
        'get_data_table' => 'Read Data Table metadata, schema, capabilities, and row count.',
        'get_data_table_rows' => 'Read filtered and paginated Data Table rows directly.',
        'update_data_table' => 'Rename or organize a Data Table without changing its rows.',
        'search_mailboxes' => 'Find visible mailboxes with counts, groups, and scope metadata.',
        'get_mailbox' => 'Read mailbox metadata, flow watchers, and matching rules.',
        'update_mailbox' => 'Update a mailbox description or group without changing its address.',
        'search_notification_channels' => 'Find notification channels without exposing provider secrets.',
        'get_notification_channel' => 'Read safe notification channel and integration metadata.',
        'update_notification_channel' => 'Rename, organize, enable, or disable a notification channel.',
        'search_media_assets' => 'Find Media Library assets without downloading their content.',
        'get_media_asset' => 'Read Media Library asset metadata and authenticated route paths.',
        'search_media_folders' => 'Find Media Library folders with relationships and item counts.',
        'get_media_folder' => 'Read Media Library folder metadata, scope, and permissions.',
        'upload_media_asset' => 'Upload a Media Library file from base64 content.',
        'update_media_asset' => 'Update Media Library asset metadata without replacing the file.',
        'update_media_folder' => 'Rename or reorder a Media Library folder without moving it.',
        'search_ai_models' => 'Find AI Models by name, capability, group, or scope.',
        'get_ai_model' => 'Read AI Model provider, capabilities, and safe integration metadata.',
        'update_ai_model' => 'Rename, organize, enable, or disable an AI Model.',
        'list_flow_triggers' => 'List the cron and webhook triggers configured for a flow.',
        'create_flow_trigger' => 'Create a cron schedule or webhook trigger for a flow.',
        'update_flow_trigger' => 'Update a cron schedule or webhook trigger.',
        'delete_flow_trigger' => 'Permanently delete a flow trigger.',
        'list_flow_actions' => 'List the post-run webhook actions configured for a flow.',
        'create_flow_action' => 'Create a post-run webhook action for a flow.',
        'update_flow_action' => 'Update a post-run webhook action.',
        'delete_flow_action' => 'Permanently delete a post-run webhook action.',
        'search_snippets' => 'Find published snippets available in this workspace.',
        'get_snippet_source' => 'Read the editable source of a snippet.',
        'get_snippet_creation_options' => 'List the scopes and teams available when creating a snippet.',
        'write_code_snippet' => 'Create or update a reusable JavaScript snippet.',
        'write_nodal_snippet' => 'Create or update a reusable visual snippet.',
        'publish_snippet' => 'Publish the current snippet draft as a new version.',
        'unpublish_snippet' => 'Unpublish a snippet while keeping its draft and version history.',
    ];

    /** @var list<McpToolHandler> */
    private array $handlers;

    /** @var list<McpToolDefinition>|null */
    private ?array $tools = null;

    /** @var list<string>|null */
    private ?array $toolNames = null;

    public function __construct(
        FlowMcpTools $flows,
        FlowAutomationMcpTools $flowAutomations,
        DataTableMcpTools $dataTables,
        MailboxMcpTools $mailboxes,
        NotificationChannelMcpTools $notificationChannels,
        MediaLibraryMcpTools $mediaLibrary,
        AiModelMcpTools $aiModels,
        RunMcpTools $runs,
        ArtifactMcpTools $artifacts,
        SnippetMcpTools $snippets,
        WorkspaceMcpTools $workspace,
        TeamMcpTools $teams,
    ) {
        $this->handlers = [
            $flows,
            $dataTables,
            $mailboxes,
            $notificationChannels,
            $mediaLibrary,
            $aiModels,
            $flowAutomations,
            $snippets,
            $runs,
            $artifacts,
            $workspace,
            $teams,
        ];
    }

    /** @return list<McpToolDefinition> */
    public function listTools(?WorkspaceMcpSetting $setting = null): array
    {
        // Keep discovery stable for connected clients that cache tools/list.
        // Workspace settings are still enforced for every tools/call request.
        return $this->allTools();
    }

    /** @return list<McpToolDefinition> */
    public function allTools(): array
    {
        if ($this->tools !== null) {
            return $this->tools;
        }

        $definitions = array_merge(...array_map(
            fn (McpToolHandler $handler) => $handler->definitions(),
            $this->handlers,
        ));

        $this->tools = array_map(function (array $definition): array {
            $name = $definition['name'];
            $metadata = self::TOOL_METADATA[$name] ?? null;
            if ($metadata === null) {
                throw new \LogicException("MCP tool {$name} is missing directory metadata.");
            }

            return [
                ...$definition,
                'title' => $metadata['title'],
                'outputSchema' => $this->outputSchema($name),
                'annotations' => [
                    'title' => $metadata['title'],
                    'readOnlyHint' => $metadata['readOnly'],
                    'destructiveHint' => in_array($name, self::DESTRUCTIVE_TOOLS, true),
                    'openWorldHint' => in_array($name, self::OPEN_WORLD_TOOLS, true),
                ],
            ];
        }, $definitions);

        $unusedMetadata = array_diff(array_keys(self::TOOL_METADATA), array_column($definitions, 'name'));
        if ($unusedMetadata !== []) {
            throw new \LogicException('MCP directory metadata references unknown tools: '.implode(', ', $unusedMetadata));
        }

        return $this->tools;
    }

    /** @return array<string, mixed> */
    private function outputSchema(string $name): array
    {
        $fields = self::OUTPUT_FIELDS[$name] ?? null;
        if ($fields === null) {
            throw new \LogicException("MCP tool {$name} is missing an output schema.");
        }

        $properties = [];
        foreach ($fields as $field => $type) {
            $properties[$field] = match ($type) {
                'array' => ['type' => 'array', 'items' => new \stdClass],
                'object' => ['type' => 'object'],
                'boolean' => ['type' => 'boolean'],
                'integer' => ['type' => 'integer'],
                'nullable-integer' => ['type' => ['integer', 'null']],
                'nullable-string' => ['type' => ['string', 'null']],
                'string' => ['type' => 'string'],
                default => new \stdClass,
            };
        }

        return [
            'type' => 'object',
            'additionalProperties' => false,
            'required' => array_keys($fields),
            'properties' => $properties,
        ];
    }

    /**
     * @param  McpArguments  $arguments
     * @return array<string, mixed>
     */
    public function call(
        string $name,
        array $arguments,
        User $user,
        Workspace $workspace,
        WorkspaceMcpSetting $setting,
        string $artifactRouteName = 'mcp.artifacts.download',
    ): array {
        $name = $this->normalizeCalledToolName($name, $arguments);
        $enabledTools = $this->enabledToolNames($setting);
        if (! in_array($name, $enabledTools, true)) {
            throw ValidationException::withMessages(['name' => 'MCP tool is disabled for this workspace.']);
        }
        $this->assertEmbeddedPublicationAllowed($name, $arguments, $enabledTools);

        $handler = collect($this->handlers)->first(fn (McpToolHandler $candidate) => $candidate->handles($name));
        if (! $handler instanceof McpToolHandler) {
            throw ValidationException::withMessages(['name' => 'Unknown MCP tool.']);
        }

        return $handler->call(
            $name,
            $arguments,
            new McpToolContext($user, $workspace, $setting, $artifactRouteName),
        );
    }

    /**
     * @param  McpArguments  $arguments
     * @param  list<string>  $enabledTools
     */
    private function assertEmbeddedPublicationAllowed(string $name, array $arguments, array $enabledTools): void
    {
        $requiredTool = null;
        $field = 'name';

        if (in_array($name, ['write_code_flow', 'write_nodal_flow'], true)) {
            if (($arguments['is_published'] ?? null) === true) {
                $requiredTool = 'publish_flow';
                $field = 'is_published';
            } elseif (
                ($arguments['is_published'] ?? null) === false
                && is_string($arguments['flow_id'] ?? null)
                && trim($arguments['flow_id']) !== ''
            ) {
                $requiredTool = 'unpublish_flow';
                $field = 'is_published';
            }
        } elseif (
            in_array($name, ['write_code_snippet', 'write_nodal_snippet'], true)
            && ($arguments['publish'] ?? null) === true
        ) {
            $requiredTool = 'publish_snippet';
            $field = 'publish';
        }

        if ($requiredTool !== null && ! in_array($requiredTool, $enabledTools, true)) {
            throw ValidationException::withMessages([
                $field => "The {$requiredTool} MCP tool is disabled for this workspace.",
            ]);
        }
    }

    /** @return list<string> */
    public function allToolNames(): array
    {
        return $this->toolNames ??= array_column($this->allTools(), 'name');
    }

    public function humanDescription(string $name, string $fallback): string
    {
        return self::HUMAN_DESCRIPTIONS[$name] ?? $fallback;
    }

    /** @return list<string> */
    public function defaultToolNames(): array
    {
        return $this->allToolNames();
    }

    /** @return list<string> */
    public function acceptedToolNames(): array
    {
        return [...$this->knownToolNames(), 'create_flow', 'execute_flow'];
    }

    /**
     * @param  array<array-key, mixed>  $names
     * @return list<string>
     */
    public function normalizeToolNames(array $names): array
    {
        $normalized = [];
        foreach ($names as $name) {
            if (! is_string($name)) {
                continue;
            }
            if ($name === 'create_flow') {
                $normalized[] = 'write_code_flow';
                $normalized[] = 'write_nodal_flow';

                continue;
            }
            $normalized[] = $name === 'execute_flow' ? 'run_flow' : $name;
        }

        return array_values(array_unique(array_intersect($normalized, $this->knownToolNames())));
    }

    /** @return list<string> */
    public function configuredToolNames(WorkspaceMcpSetting $setting): array
    {
        $enabled = $setting->enabled_tools;
        $configured = is_array($enabled)
            ? $this->normalizeToolNames($enabled)
            : $this->defaultToolNames();

        return array_values(array_unique(array_intersect(
            [...$configured, ...self::ALWAYS_AVAILABLE_TOOLS],
            $this->knownToolNames(),
        )));
    }

    /** @return list<string> */
    public function enabledToolNames(WorkspaceMcpSetting $setting): array
    {
        $effective = $this->configuredToolNames($setting);

        if (array_intersect($effective, ['update_flow_settings', 'write_code_flow', 'write_nodal_flow', 'publish_flow', 'unpublish_flow']) !== []) {
            $effective = [...$effective, 'search_flows', 'get_flow_details', 'get_flow_source', 'get_flow_creation_options', 'list_flow_resources'];
        }
        if (array_intersect($effective, ['write_code_snippet', 'write_nodal_snippet', 'publish_snippet', 'unpublish_snippet']) !== []) {
            $effective = [...$effective, 'search_snippets', 'get_snippet_source', 'get_snippet_creation_options', 'list_flow_resources'];
        }
        if (in_array('update_mailbox', $effective, true)) {
            $effective = [...$effective, 'search_mailboxes', 'get_mailbox'];
        }
        if (in_array('update_notification_channel', $effective, true)) {
            $effective = [...$effective, 'search_notification_channels', 'get_notification_channel'];
        }
        if (in_array('update_media_asset', $effective, true)) {
            $effective = [...$effective, 'search_media_assets', 'get_media_asset', 'search_media_folders'];
        }
        if (in_array('upload_media_asset', $effective, true)) {
            $effective = [...$effective, 'search_media_assets', 'get_media_asset', 'search_media_folders'];
        }
        if (in_array('update_media_folder', $effective, true)) {
            $effective = [...$effective, 'search_media_folders', 'get_media_folder'];
        }
        if (in_array('update_ai_model', $effective, true)) {
            $effective = [...$effective, 'search_ai_models', 'get_ai_model'];
        }

        return array_values(array_unique(array_intersect(
            $effective,
            $this->allToolNames(),
        )));
    }

    /** @param McpArguments $arguments */
    private function normalizeCalledToolName(string $name, array $arguments): string
    {
        if ($name === 'execute_flow') {
            return 'run_flow';
        }
        if ($name === 'create_flow') {
            return ($arguments['flow_type'] ?? null) === 'code'
                ? 'write_code_flow'
                : 'write_nodal_flow';
        }

        return $name;
    }

    /** @return list<string> */
    private function knownToolNames(): array
    {
        return array_values(array_unique([...$this->allToolNames(), ...SnippetMcpTools::TOOL_NAMES]));
    }
}
