<?php

namespace App\Services\Snippet;

use App\Authorization\ResourceAssignmentValidator;
use App\Enums\Authorization\Ability;
use App\Models\Snippet;
use App\Models\User;
use App\Models\Workspace;
use App\Rules\ValidNodalGraph;
use App\Services\FeatureFlags\FeatureFlagService;
use App\Services\Flow\FlowCodeValidator;
use App\Services\Flow\NodalGraphCompiler;
use App\Services\Flow\NodalResourceReferenceValidator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class SnippetWriteService
{
    public function __construct(
        private readonly NodalGraphCompiler $compiler,
        private readonly FlowCodeValidator $codeValidator,
        private readonly NodalResourceReferenceValidator $resourceReferences,
        private readonly SnippetArgumentValidator $argumentValidator,
        private readonly SnippetVersionService $versions,
        private readonly ResourceAssignmentValidator $assignments,
        private readonly FeatureFlagService $features,
    ) {}

    /**
     * @param  array<string, mixed>  $attributes
     * @return array{operation: 'created'|'updated', snippet: Snippet}
     */
    public function write(
        array $attributes,
        string $snippetType,
        User $user,
        Workspace $workspace,
    ): array {
        $this->features->abortIfDisabled('snippets_enabled');
        $snippetId = trim(is_string($attributes['snippet_id'] ?? null) ? $attributes['snippet_id'] : '');

        if ($snippetId === '') {
            Gate::forUser($user)->authorize(Ability::CREATE->value, Snippet::class);
            $validated = $this->validateMetadata($attributes, creating: true);
            $content = $this->validatedContent($attributes, $snippetType, $user, $workspace);
            $scope = is_string($validated['scope'] ?? null) ? $validated['scope'] : 'owner';
            $teamId = $scope === 'team' ? ($validated['team_id'] ?? null) : null;
            $this->assignments->validate(
                $workspace->id,
                $user->id,
                $scope,
                is_string($teamId) ? $teamId : null,
                null,
                null,
            );

            $snippet = DB::transaction(function () use (
                $content,
                $scope,
                $snippetType,
                $teamId,
                $user,
                $validated,
                $workspace,
            ): Snippet {
                $snippet = Snippet::create([
                    'workspace_id' => $workspace->id,
                    'user_id' => $user->id,
                    'label' => $validated['label'],
                    'description' => $validated['description'] ?? null,
                    'group' => $this->nullableTrimmedString($validated['group'] ?? null),
                    ...$content,
                    'snippet_type' => $snippetType,
                    'scope' => $scope,
                    'team_id' => $teamId,
                    'is_active' => (bool) ($validated['is_active'] ?? true),
                ]);
                $this->versions->publish($snippet, $user->id);

                return $snippet;
            }, 3);

            return [
                'operation' => 'created',
                'snippet' => $snippet->fresh(['publishedVersion']) ?? $snippet,
            ];
        }

        $editableSnippet = Snippet::query()
            ->where('workspace_id', $workspace->id)
            ->whereKey($snippetId)
            ->first();
        $this->assertEditable($editableSnippet, $snippetType, $user);
        $validated = $this->validateMetadata($attributes, creating: false);
        $content = $this->validatedContent($attributes, $snippetType, $user, $workspace, $editableSnippet);

        return DB::transaction(function () use (

            $content,
            $snippetId,
            $snippetType,
            $user,
            $validated,
            $workspace,
        ): array {
            $snippet = Snippet::query()
                ->where('workspace_id', $workspace->id)
                ->whereKey($snippetId)
                ->lockForUpdate()
                ->first();
            $this->assertEditable($snippet, $snippetType, $user);
            $clientTimestamp = $validated['content_updated_at'] ?? null;
            if (! is_string($clientTimestamp)) {
                throw ValidationException::withMessages([
                    'content_updated_at' => 'The content timestamp is required.',
                ]);
            }
            $this->ensureCurrent($clientTimestamp, $snippet);

            $scope = is_string($validated['scope'] ?? null) ? $validated['scope'] : $snippet->scope;
            $teamId = $scope === 'team'
                ? (array_key_exists('team_id', $validated) ? $validated['team_id'] : $snippet->team_id)
                : null;
            if ($scope !== $snippet->scope || $teamId !== $snippet->team_id) {
                Gate::forUser($user)->authorize(Ability::MANAGE_SCOPE->value, $snippet);
            }
            $this->assignments->validate(
                $workspace->id,
                (string) $snippet->user_id,
                $scope,
                is_string($teamId) ? $teamId : null,
                null,
                null,
            );

            $metadata = array_intersect_key($validated, array_flip([
                'label',
                'description',
                'group',
                'is_active',
            ]));
            if (array_key_exists('group', $metadata)) {
                $metadata['group'] = $this->nullableTrimmedString($metadata['group']);
            }

            $snippet->update([
                ...$metadata,
                ...$content,
                'snippet_type' => $snippetType,
                'scope' => $scope,
                'team_id' => $teamId,
            ]);

            if (($validated['publish'] ?? false) === true) {
                $this->versions->publish($snippet, $user->id);
            }

            return [
                'operation' => 'updated',
                'snippet' => $snippet->fresh(['publishedVersion']) ?? $snippet,
            ];
        }, 3);
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    private function validateMetadata(array $attributes, bool $creating): array
    {
        return validator($attributes, [
            'label' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'group' => ['sometimes', 'nullable', 'string', 'max:255'],
            'scope' => ['sometimes', Rule::in($this->features->allowedScopes())],
            'team_id' => ['sometimes', 'nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
            'publish' => ['sometimes', 'boolean'],
            'content_updated_at' => [$creating ? 'sometimes' : 'required', 'string'],
        ])->validate();
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array{args: string, code: string, nodal_graph: array<string, mixed>|null}
     */
    private function validatedContent(
        array $attributes,
        string $snippetType,
        User $user,
        Workspace $workspace,
        ?Snippet $existing = null,
    ): array {
        $validatedArgs = validator($attributes, [
            'args' => ['sometimes', 'nullable', 'string', 'max:500'],
        ])->validate();
        $args = array_key_exists('args', $validatedArgs)
            ? (string) ($validatedArgs['args'] ?? '')
            : (string) ($existing->args ?? '');
        $functionArguments = $this->argumentValidator->validate($args);

        if ($snippetType === 'code') {
            $validated = validator($attributes, [
                'code' => ['required', 'string'],
            ])->validate();
            $this->codeValidator->validateFunctionBody($validated['code'], $functionArguments);

            return [
                'args' => $args,
                'code' => $validated['code'],
                'nodal_graph' => null,
            ];
        }

        if ($snippetType !== 'nodal') {
            throw ValidationException::withMessages([
                'snippet_type' => 'The snippet type must be code or nodal.',
            ]);
        }

        $validated = validator($attributes, [
            'nodal_graph' => [
                'required',
                'array',
                new ValidNodalGraph(context: 'function', strictStructure: true),
            ],
        ])->validate();
        /** @var array<string, mixed> $graph */
        $graph = $validated['nodal_graph'];
        $this->resourceReferences->validate($graph, $user, $workspace);
        $code = $this->compiler->compile(
            $graph,
            context: 'function',
            functionArguments: $functionArguments,
        );

        return [
            'args' => $args,
            'code' => $code,
            'nodal_graph' => $graph,
        ];
    }

    /** @phpstan-assert Snippet $snippet */
    private function assertEditable(?Snippet $snippet, string $snippetType, User $user): void
    {
        if (! $snippet || Gate::forUser($user)->denies(Ability::UPDATE->value, $snippet)) {
            throw ValidationException::withMessages([
                'snippet_id' => 'Snippet not found or not editable.',
            ]);
        }
        if ((bool) $snippet->getAttribute('stale')) {
            throw ValidationException::withMessages([
                'snippet_id' => 'Snippet not found or not editable.',
            ]);
        }
        if ($snippet->library_locked) {
            throw ValidationException::withMessages([
                'snippet_id' => 'Library snippets cannot be edited. Duplicate the snippet first.',
            ]);
        }
        if ($snippet->snippet_type !== $snippetType) {
            throw ValidationException::withMessages([
                'snippet_id' => 'Snippet type cannot be changed after creation.',
            ]);
        }
    }

    private function ensureCurrent(string $clientTimestamp, Snippet $snippet): void
    {
        try {
            $client = Carbon::parse($clientTimestamp);
        } catch (\Throwable) {
            throw ValidationException::withMessages([
                'content_updated_at' => 'The content timestamp is invalid.',
            ]);
        }

        $server = $snippet->content_updated_at ?? $snippet->updated_at;
        if (! $server || ! $server->equalTo($client)) {
            throw ValidationException::withMessages([
                'content_updated_at' => 'This snippet changed since it was read. Read the latest source and retry.',
            ]);
        }
    }

    private function nullableTrimmedString(mixed $value): ?string
    {
        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
}
