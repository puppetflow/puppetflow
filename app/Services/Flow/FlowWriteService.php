<?php

namespace App\Services\Flow;

use App\Authorization\ResourceAssignmentValidator;
use App\Enums\Authorization\Ability;
use App\Models\Flow;
use App\Models\User;
use App\Models\Workspace;
use App\Rules\ValidNodalGraph;
use App\Services\FeatureFlags\FeatureFlagService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class FlowWriteService
{
    public function __construct(
        private readonly FlowCreationService $creation,
        private readonly NodalGraphCompiler $compiler,
        private readonly FlowCodeValidator $codeValidator,
        private readonly NodalResourceReferenceValidator $resourceReferences,
        private readonly ResourceAssignmentValidator $assignments,
        private readonly FeatureFlagService $features,
    ) {}

    /**
     * @param  array<string, mixed>  $attributes
     * @return array{operation: 'created'|'updated', flow: Flow}
     */
    public function write(
        array $attributes,
        string $flowType,
        User $user,
        Workspace $workspace,
    ): array {
        $flowId = trim(is_string($attributes['flow_id'] ?? null) ? $attributes['flow_id'] : '');

        if ($flowId === '') {
            Gate::forUser($user)->authorize(Ability::CREATE->value, Flow::class);
            $content = $this->validatedContent($attributes, $flowType, $user, $workspace);
            $creationAttributes = $attributes;
            unset($creationAttributes['flow_id'], $creationAttributes['content_updated_at']);
            $creationAttributes = [
                ...$creationAttributes,
                ...$content,
                'flow_type' => $flowType,
                'available_in_mcp' => true,
            ];

            $flow = $this->creation->create(
                $creationAttributes,
                $user,
                $workspace,
                strictContent: true,
            );

            return ['operation' => 'created', 'flow' => $flow->fresh(['publishedVersion']) ?? $flow];
        }

        $editableFlow = Flow::query()
            ->where('workspace_id', $workspace->id)
            ->whereKey($flowId)
            ->first();
        $this->assertEditable($editableFlow, $user);
        $content = $this->validatedContent($attributes, $flowType, $user, $workspace, $editableFlow);

        return DB::transaction(function () use ($attributes, $content, $flowId, $flowType, $user, $workspace): array {
            $flow = Flow::query()
                ->where('workspace_id', $workspace->id)
                ->whereKey($flowId)
                ->lockForUpdate()
                ->first();

            $this->assertEditable($flow, $user);

            $validated = validator($attributes, [
                'name' => ['sometimes', 'string', 'max:128'],
                'description' => ['sometimes', 'nullable', 'string'],
                'visibility' => ['sometimes', Rule::in($this->features->allowedScopes())],
                'team_id' => ['sometimes', 'nullable', 'string'],
                'folder_id' => ['sometimes', 'nullable', 'string'],
                'workspace_folder_id' => ['sometimes', 'nullable', 'string'],
                'available_in_mcp' => ['sometimes', 'boolean'],
                'finally_enabled' => ['sometimes', 'boolean'],
                'queue_index' => [
                    'sometimes',
                    'nullable',
                    'integer',
                    'min:1',
                    'max:'.config()->integer('puppetflow.queues_counter', 1),
                ],
                'is_published' => ['sometimes', 'boolean'],
                'content_updated_at' => ['required', 'string'],
            ])->validate();

            $this->ensureCurrent($validated['content_updated_at'], $flow);

            $visibility = (string) ($validated['visibility'] ?? $flow->visibility);
            $teamId = $visibility === 'team'
                ? (array_key_exists('team_id', $validated)
                    ? $validated['team_id']
                    : ($flow->visibility === 'team' ? $flow->team_id : null))
                : null;
            $folderId = $visibility === 'owner'
                ? (array_key_exists('folder_id', $validated)
                    ? $validated['folder_id']
                    : ($flow->visibility === 'owner' ? $flow->folder_id : null))
                : null;
            $workspaceFolderId = in_array($visibility, ['workspace', 'team'], true)
                ? (array_key_exists('workspace_folder_id', $validated)
                    ? $validated['workspace_folder_id']
                    : (in_array($flow->visibility, ['workspace', 'team'], true) ? $flow->workspace_folder_id : null))
                : null;

            $this->assignments->validate(
                $workspace->id,
                (string) $flow->owner_id,
                $visibility,
                is_string($teamId) ? $teamId : null,
                is_string($folderId) ? $folderId : null,
                is_string($workspaceFolderId) ? $workspaceFolderId : null,
            );

            $metadata = array_intersect_key($validated, array_flip([
                'name',
                'description',
                'available_in_mcp',
                'finally_enabled',
                'queue_index',
            ]));
            $flow->update([
                ...$metadata,
                ...$content,
                'source_type' => 'code',
                'flow_type' => $flowType,
                'visibility' => $visibility,
                'team_id' => $teamId,
                'folder_id' => $folderId,
                'workspace_folder_id' => $workspaceFolderId,
            ]);

            if (array_key_exists('is_published', $validated)) {
                $validated['is_published']
                    ? $this->publish($flow, $user)
                    : $flow->update(['is_published' => false]);
            }

            return [
                'operation' => 'updated',
                'flow' => $flow->fresh(['publishedVersion']) ?? $flow,
            ];
        }, 3);
    }

    /** @phpstan-assert Flow $flow */
    private function assertEditable(?Flow $flow, User $user): void
    {
        if (! $flow || Gate::forUser($user)->denies(Ability::UPDATE->value, $flow)) {
            throw ValidationException::withMessages(['flow_id' => 'Flow not found or not editable.']);
        }
        if ($flow->library_locked || $flow->source_type !== 'code') {
            throw ValidationException::withMessages([
                'flow_id' => 'Library and repository flows cannot be edited. Duplicate the flow first.',
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array{code: string, nodal_graph: array<string, mixed>|null}
     */
    private function validatedContent(
        array $attributes,
        string $flowType,
        User $user,
        Workspace $workspace,
        ?Flow $flow = null,
    ): array {
        if ($flowType === 'code') {
            $validated = validator($attributes, [
                'code' => ['required', 'string'],
            ])->validate();
            $this->codeValidator->validate($validated['code']);

            return ['code' => $validated['code'], 'nodal_graph' => null];
        }

        $validated = validator($attributes, [
            'nodal_graph' => ['required', 'array', new ValidNodalGraph(strictStructure: true)],
        ])->validate();
        /** @var array<string, mixed> $graph */
        $graph = $validated['nodal_graph'];
        $this->resourceReferences->validate($graph, $user, $workspace, $flow);
        $code = $this->compiler->compile($graph);

        return [
            'code' => $code,
            'nodal_graph' => $graph,
        ];
    }

    private function ensureCurrent(string $clientTimestamp, Flow $flow): void
    {
        try {
            $client = Carbon::parse($clientTimestamp);
        } catch (\Throwable) {
            throw ValidationException::withMessages([
                'content_updated_at' => 'The content timestamp is invalid.',
            ]);
        }

        $server = $flow->content_updated_at ?? $flow->updated_at;
        if (! $server || ! $server->equalTo($client)) {
            throw ValidationException::withMessages([
                'content_updated_at' => 'This flow changed since it was read. Read the latest source and retry.',
            ]);
        }
    }

    private function publish(Flow $flow, User $user): void
    {
        $published = $flow->publishedVersion()->first();
        $sameContent = $published
            && $published->flow_type === $flow->flow_type
            && $published->code === $flow->code
            && ($flow->flow_type !== 'nodal' || $published->nodal_graph === $flow->nodal_graph);

        if (! $sameContent) {
            $latestVersion = $flow->versions()->max('version');
            $published = $flow->versions()->create([
                'version' => is_numeric($latestVersion) ? ((int) $latestVersion) + 1 : 1,
                'code' => $flow->code,
                'nodal_graph' => $flow->flow_type === 'nodal' ? $flow->nodal_graph : null,
                'flow_type' => $flow->flow_type,
                'published_by' => $user->id,
                'published_at' => now(),
            ]);
        }

        $flow->update([
            'published_version_id' => $published->id,
            'is_published' => true,
        ]);
    }
}
