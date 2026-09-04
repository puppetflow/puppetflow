<?php

namespace App\Services\Mcp;

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMcpSetting;
use App\Services\Mcp\Tools\ArtifactMcpTools;
use App\Services\Mcp\Tools\FlowAutomationMcpTools;
use App\Services\Mcp\Tools\FlowMcpTools;
use App\Services\Mcp\Tools\McpToolContext;
use App\Services\Mcp\Tools\McpToolHandler;
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
        'write_code_flow' => ['title' => 'Write Code Flow', 'readOnly' => false],
        'write_nodal_flow' => ['title' => 'Write Nodal Flow', 'readOnly' => false],
        'publish_flow' => ['title' => 'Publish Flow', 'readOnly' => false],
        'unpublish_flow' => ['title' => 'Unpublish Flow', 'readOnly' => false],
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
        'write_code_flow' => ['flow' => 'object'],
        'write_nodal_flow' => ['flow' => 'object'],
        'publish_flow' => ['flow' => 'object'],
        'unpublish_flow' => ['flow' => 'object'],
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

    private const DEFAULT_TOOLS = [
        'search_flows',
        'write_code_flow',
        'write_code_snippet',
        'write_nodal_flow',
        'write_nodal_snippet',
        'publish_flow',
        'unpublish_flow',
        'list_flow_triggers',
        'create_flow_trigger',
        'update_flow_trigger',
        'delete_flow_trigger',
        'list_flow_actions',
        'create_flow_action',
        'update_flow_action',
        'delete_flow_action',
        'publish_snippet',
        'unpublish_snippet',
        'search_snippets',
        'get_snippet_source',
        'list_folders',
        'get_flow_source',
        'list_flow_runs',
        'get_recording_lastshot',
        'list_flow_resources',
        'search_runs',
        'get_flow_details',
        'run_flow',
        'get_run',
        'get_run_result',
        'list_artifacts',
        'get_latest_screenshot',
        'download_artifact',
        'continue_human_validation',
    ];

    private const HUMAN_DESCRIPTIONS = [
        'get_flow_details' => 'Read the details and Flow Inputs of a flow exposed to MCP.',
        'run_flow' => 'Run a flow exposed to MCP, optionally overriding its Flow Inputs.',
        'get_nodal_catalog' => 'Browse the nodes and capabilities available when building visual flows.',
        'list_flow_resources' => 'List the workspace resources that can be referenced by a flow or snippet.',
        'write_code_flow' => 'Create or update a flow written in JavaScript.',
        'write_nodal_flow' => 'Create or update a visual flow built from connected nodes.',
        'publish_flow' => 'Publish the current flow draft as a new version.',
        'unpublish_flow' => 'Unpublish a flow while keeping its draft and version history.',
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
        RunMcpTools $runs,
        ArtifactMcpTools $artifacts,
        SnippetMcpTools $snippets,
        WorkspaceMcpTools $workspace,
        TeamMcpTools $teams,
    ) {
        $this->handlers = [$flows, $flowAutomations, $snippets, $runs, $artifacts, $workspace, $teams];
    }

    /** @return list<McpToolDefinition> */
    public function listTools(?WorkspaceMcpSetting $setting = null): array
    {
        $tools = $this->allTools();
        if (! $setting) {
            return $tools;
        }
        $enabled = $this->enabledToolNames($setting);

        return array_values(array_filter($tools, fn (array $tool) => in_array($tool['name'], $enabled, true)));
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
        return array_values(array_intersect(
            [...self::DEFAULT_TOOLS, ...self::ALWAYS_AVAILABLE_TOOLS],
            $this->allToolNames(),
        ));
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

        if (array_intersect($effective, ['write_code_flow', 'write_nodal_flow', 'publish_flow', 'unpublish_flow']) !== []) {
            $effective = [...$effective, 'search_flows', 'get_flow_source', 'get_flow_creation_options', 'list_flow_resources'];
        }
        if (array_intersect($effective, ['write_code_snippet', 'write_nodal_snippet', 'publish_snippet', 'unpublish_snippet']) !== []) {
            $effective = [...$effective, 'search_snippets', 'get_snippet_source', 'get_snippet_creation_options', 'list_flow_resources'];
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
