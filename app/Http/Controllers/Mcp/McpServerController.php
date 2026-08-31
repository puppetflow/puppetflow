<?php

/*
 * Explicit proprietary scope: the paid replay artifact download branches in this file implement paid
 * Puppetflow features and are licensed under the Puppetflow Proprietary License.
 * See LICENSE_PROPRIETARY.md.
 */

namespace App\Http\Controllers\Mcp;

use App\Contracts\BrandingProvider;
use App\Enums\Authorization\Ability;
use App\Http\Controllers\Controller;
use App\Models\Flow;
use App\Models\FlowRun;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMcpSetting;
use App\Services\FeatureFlags\FeatureFlagService;
use App\Services\Mcp\McpToolService;
use App\Services\Storage\ArtifactResponseFactory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

/** @phpstan-import-type McpArguments from McpToolService */
class McpServerController extends Controller
{
    private const SUPPORTED_PROTOCOL_VERSIONS = [
        '2025-03-26',
        '2025-06-18',
        '2025-11-25',
    ];

    public function __construct(
        private McpToolService $tools,
        private readonly ArtifactResponseFactory $artifactResponses,
        private readonly FeatureFlagService $features,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        if (! $this->acceptsRequest($request)) {
            return response()->json([
                'jsonrpc' => '2.0',
                'id' => null,
                'error' => ['code' => -32600, 'message' => 'Unsupported MCP request headers.'],
            ], 406);
        }

        $payload = $request->json()->all();

        if (($payload['jsonrpc'] ?? null) !== '2.0' || ! is_string($payload['method'] ?? null)) {
            return $this->error($payload['id'] ?? null, -32600, 'Invalid Request');
        }

        $id = $payload['id'] ?? null;
        $method = $payload['method'];
        $params = is_array($payload['params'] ?? null) ? $payload['params'] : [];

        if ($id === null) {
            return response()->json(null, 204);
        }

        if ($method !== 'initialize' && ! $this->supportsProtocolHeader($request)) {
            return $this->error($id, -32600, 'Unsupported MCP-Protocol-Version header.');
        }

        try {
            $result = match ($method) {
                'initialize' => $this->initialize($params),
                'tools/list' => ['tools' => $this->tools->listTools($this->setting($request))],
                'tools/call' => $this->callTool($request, $params),
                default => null,
            };

            if ($result === null) {
                return $this->error($id, -32601, 'Method not found');
            }

            return $this->result($id, $result);
        } catch (ValidationException $exception) {
            $message = collect($exception->errors())->flatten()->first();

            return $this->error($id, -32602, is_string($message) ? $message : 'Invalid params');
        } catch (\Throwable $exception) {
            report($exception);

            return $this->error($id, -32603, 'Internal error');
        }
    }

    public function downloadArtifact(Request $request, string $id, FlowRun $run, string $type, string $filename): Response
    {
        $this->features->abortIfDisabled('recording_enabled');
        $this->authorizeArtifactAccess($request, $id, $run);
        abort_unless(in_array($type, ['screenshots', 'downloads'], true), 404);

        $response = $this->artifactResponses->makeForRun($run, $type, $filename);
        if ($response === null) {
            abort(404);
        }

        return $response;
    }

    public function downloadRecording(Request $request, string $id, FlowRun $run): Response
    {
        $this->features->abortIfDisabled('recording_enabled');
        $this->authorizeArtifactAccess($request, $id, $run);
        $response = $this->artifactResponses->makeRecording($run);
        abort_unless($response !== null, 404);

        return $response;
    }

    public function downloadRecordingLastshot(Request $request, string $id, FlowRun $run): Response
    {
        $this->features->abortIfDisabled('recording_enabled');
        $this->authorizeArtifactAccess($request, $id, $run);
        $response = $this->artifactResponses->makeRecording($run, true);
        abort_unless($response !== null, 404);

        return $response;
    }

    private function authorizeArtifactAccess(Request $request, string $id, FlowRun $run): void
    {
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('mcpWorkspace');
        $flow = Flow::where('workspace_id', $workspace->id)
            ->where('id', $id)
            ->firstOrFail();

        abort_unless(
            $flow->available_in_mcp
            && Gate::forUser($request->user())->allows(Ability::VIEW->value, $flow),
            403,
        );
        abort_unless($run->flow_id === $flow->id, 404);
        Gate::forUser($request->user())->authorize(Ability::VIEW->value, $run);

    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function initialize(array $params): array
    {
        $requestedVersion = is_string($params['protocolVersion'] ?? null)
            ? $params['protocolVersion']
            : null;
        $protocolVersion = in_array($requestedVersion, self::SUPPORTED_PROTOCOL_VERSIONS, true)
            ? $requestedVersion
            : self::SUPPORTED_PROTOCOL_VERSIONS[array_key_last(self::SUPPORTED_PROTOCOL_VERSIONS)];

        return [
            'protocolVersion' => $protocolVersion,
            'capabilities' => [
                'tools' => [
                    'listChanged' => false,
                ],
            ],
            'serverInfo' => [
                'name' => app(BrandingProvider::class)->current()['name'],
                'version' => config('app.version', '1.0.0'),
            ],
            'instructions' => 'When creating a flow or snippet, prefer write_nodal_flow or write_nodal_snippet. Use a code writer only when the user explicitly requests code, JavaScript, or code mode. get_nodal_catalog is the always-available reference for Puppetflow helpers and visual nodes.',
        ];
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function callTool(Request $request, array $params): array
    {
        /** @var string|int|float|bool|null $nameValue */
        $nameValue = $params['name'] ?? '';
        $name = (string) $nameValue;
        /** @var McpArguments $arguments */
        $arguments = is_array($params['arguments'] ?? null) ? $params['arguments'] : [];

        if ($name === '') {
            throw ValidationException::withMessages(['name' => 'Tool name is required.']);
        }

        /** @var User $user */
        $user = $request->user();
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('mcpWorkspace');
        $setting = $this->setting($request);
        if ($setting === null) {
            throw new \LogicException('MCP settings are unavailable.');
        }
        /** @var string $artifactRouteName */
        $artifactRouteName = $request->attributes->get('mcpArtifactRouteName', 'mcp.artifacts.download');
        $payload = $this->tools->call(
            $name,
            $arguments,
            $user,
            $workspace,
            $setting,
            $artifactRouteName,
        );

        $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

        return [
            'content' => [
                [
                    'type' => 'text',
                    'text' => $json,
                ],
            ],
            'structuredContent' => $payload,
        ];
    }

    /** @param array<string, mixed> $result */
    private function result(mixed $id, array $result): JsonResponse
    {
        return response()->json([
            'jsonrpc' => '2.0',
            'id' => $id,
            'result' => $result,
        ]);
    }

    private function error(mixed $id, int $code, string $message): JsonResponse
    {
        return response()->json([
            'jsonrpc' => '2.0',
            'id' => $id,
            'error' => [
                'code' => $code,
                'message' => $message,
            ],
        ]);
    }

    private function setting(Request $request): ?WorkspaceMcpSetting
    {
        $setting = $request->attributes->get('mcpSetting');

        return $setting instanceof WorkspaceMcpSetting ? $setting : null;
    }

    private function acceptsRequest(Request $request): bool
    {
        $contentType = strtolower((string) $request->header('Content-Type', ''));
        if (! str_starts_with($contentType, 'application/json')) {
            return false;
        }

        $accept = strtolower((string) $request->header('Accept', '*/*'));
        if ($accept !== '*/*' && ! str_contains($accept, 'application/json')) {
            return false;
        }

        $origin = $request->header('Origin');
        if (! is_string($origin) || $origin === '') {
            return true;
        }

        return rtrim(strtolower($origin), '/') === strtolower($request->getSchemeAndHttpHost());
    }

    private function supportsProtocolHeader(Request $request): bool
    {
        $version = $request->header('MCP-Protocol-Version');

        return $version === null
            || in_array($version, self::SUPPORTED_PROTOCOL_VERSIONS, true);
    }
}
