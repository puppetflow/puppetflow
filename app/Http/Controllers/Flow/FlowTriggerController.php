<?php

/*
 * Explicit proprietary scope: the paid shared trigger scopes in this file implement paid
 * Puppetflow features and are licensed under the Puppetflow Proprietary License.
 * See LICENSE_PROPRIETARY.md.
 */

namespace App\Http\Controllers\Flow;

use App\Authorization\ResourceAssignmentValidator;
use App\Enums\Authorization\Ability;
use App\Http\Controllers\Controller;
use App\Models\Flow;
use App\Models\FlowTrigger;
use App\Models\User;
use App\Services\Flow\FlowRunProxyOverride;
use App\Services\Workspace\WorkspaceProxyAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class FlowTriggerController extends Controller
{
    public function __construct(
        private readonly ResourceAssignmentValidator $assignments,
        private readonly WorkspaceProxyAccess $proxyAccess,
    ) {}

    public function store(Request $request, Flow $flow): RedirectResponse
    {
        $this->assertFlowInCurrentWorkspace($flow);
        $this->authorize(Ability::UPDATE->value, $flow);

        /** @var array{
         *     type: string,
         *     label: string,
         *     group?: string|null,
         *     input_template?: array<string, mixed>|null,
         *     config?: array<string, mixed>|null,
         *     proxy_mode?: string|null,
         *     workspace_proxy_id?: int|null,
         *     scope?: string,
         *     team_id?: string|null
         * } $validated
         */
        $validated = $request->validate([
            'type' => 'required|in:webhook,cron',
            'label' => 'required|string|max:255',
            'group' => 'nullable|string|max:100',
            'input_template' => 'nullable|array',
            'config' => 'nullable|array',
            'proxy_mode' => ['nullable', 'string', 'in:'.implode(',', FlowRunProxyOverride::MODES)],
            'workspace_proxy_id' => ['nullable', 'integer', 'required_if:proxy_mode,specific'],
            'scope' => 'sometimes|in:'.implode(',', app(\App\Services\FeatureFlags\FeatureFlagService::class)->allowedScopes()),
            'team_id' => 'nullable|string',
        ]);
        if (array_key_exists('team_id', $validated)) {
            $validated['team_id'] = $this->resolveWorkspaceTeamId($validated['team_id'], $flow->workspace_id);
        }

        $scope = $validated['scope'] ?? 'owner';
        $teamId = $scope === 'team' ? ($validated['team_id'] ?? null) : null;
        /** @var User $user */
        $user = $request->user();
        $this->assignments->ensureOwnerSatisfiesScope($flow->workspace_id, $user->id, $scope, $teamId);
        $this->normalizeProxyOverride($validated, $flow, $user);

        FlowTrigger::create([
            ...$validated,
            'flow_id' => $flow->id,
            'user_id' => $user->id,
            'scope' => $scope,
            'team_id' => $teamId,
        ]);

        return back()->with('success', 'Trigger created.');
    }

    public function update(Request $request, FlowTrigger $trigger): RedirectResponse
    {
        $flow = $this->parentFlow($trigger);
        Gate::authorize(Ability::UPDATE->value, $trigger);

        /** @var array{
         *     label?: string,
         *     group?: string|null,
         *     input_template?: array<string, mixed>|null,
         *     config?: array<string, mixed>|null,
         *     proxy_mode?: string|null,
         *     workspace_proxy_id?: int|null,
         *     is_active?: bool,
         *     scope?: string,
         *     team_id?: string|null,
         *     user_id?: string|null
         * } $validated
         */
        $validated = $request->validate([
            'label' => 'sometimes|string|max:255',
            'group' => 'nullable|string|max:100',
            'input_template' => 'nullable|array',
            'config' => 'nullable|array',
            'proxy_mode' => ['nullable', 'string', 'in:'.implode(',', FlowRunProxyOverride::MODES)],
            'workspace_proxy_id' => ['nullable', 'integer', 'required_if:proxy_mode,specific'],
            'is_active' => 'sometimes|boolean',
            'scope' => 'sometimes|in:'.implode(',', app(\App\Services\FeatureFlags\FeatureFlagService::class)->allowedScopes()),
            'team_id' => 'nullable|string',
            'user_id' => 'nullable|string|exists:users,id',
        ]);
        $workspaceId = $flow->workspace_id;
        if (array_key_exists('team_id', $validated)) {
            $validated['team_id'] = $this->resolveWorkspaceTeamId($validated['team_id'], $workspaceId);
        }
        if (
            (isset($validated['scope']) && $validated['scope'] !== $trigger->scope)
            || (array_key_exists('team_id', $validated) && $validated['team_id'] !== $trigger->team_id)
        ) {
            Gate::authorize(Ability::MANAGE_SCOPE->value, $trigger);
        }
        $ownerId = $this->resolveOwnerId($validated, $workspaceId, $trigger->user_id);
        $scope = $validated['scope'] ?? $trigger->scope;
        abort_unless(is_string($scope), 500, 'The trigger scope is invalid.');
        $teamId = $scope === 'team' ? ($validated['team_id'] ?? $trigger->team_id) : null;
        abort_unless(is_string($teamId) || $teamId === null, 500, 'The trigger team is invalid.');
        $validated['team_id'] = $teamId;
        $this->assignments->ensureOwnerSatisfiesScope($workspaceId, $ownerId, $scope, $teamId);
        if (array_key_exists('proxy_mode', $validated)) {
            // The trigger owner is the user the run executes as, so the proxy must be visible to them.
            $owner = $ownerId === $trigger->user_id ? $trigger->user : User::query()->find($ownerId);
            abort_unless($owner instanceof User, 422, 'The trigger owner could not be resolved.');
            $this->normalizeProxyOverride($validated, $flow, $owner);
        }

        $trigger->update($validated);

        return back()->with('success', 'Trigger updated.');
    }

    /**
     * Clears the proxy id unless a specific proxy is requested, and checks that proxy is usable by the owner.
     *
     * @param  array<string, mixed>  $validated
     */
    private function normalizeProxyOverride(array &$validated, Flow $flow, User $owner): void
    {
        $mode = $validated['proxy_mode'] ?? null;
        if ($mode === null) {
            $validated['proxy_mode'] = null;
            $validated['workspace_proxy_id'] = null;

            return;
        }
        if ($mode !== 'specific') {
            $validated['workspace_proxy_id'] = null;

            return;
        }

        $proxyId = $validated['workspace_proxy_id'] ?? null;
        $this->proxyAccess->ensureUsable(
            is_numeric($proxyId) ? (int) $proxyId : null,
            $flow->workspace_id,
            $owner,
        );
    }

    public function destroy(Request $request, FlowTrigger $trigger): RedirectResponse
    {
        $this->parentFlow($trigger);
        Gate::authorize(Ability::DELETE->value, $trigger);

        $trigger->delete();

        return back()->with('success', 'Trigger deleted.');
    }

    public function destroyBatch(Request $request, Flow $flow): RedirectResponse
    {
        $this->assertFlowInCurrentWorkspace($flow);
        $this->authorize(Ability::UPDATE->value, $flow);

        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => [
                'string',
                'distinct',
                \Illuminate\Validation\Rule::exists('flow_triggers', 'id')
                    ->where('flow_id', $flow->id),
            ],
        ]);

        /** @var list<string> $ids */
        $ids = $validated['ids'];
        $triggers = FlowTrigger::query()->where('flow_id', $flow->id)->whereIn('id', $ids)->orderBy('id')->get();

        foreach ($triggers as $trigger) {
            Gate::authorize(Ability::DELETE->value, $trigger);
        }

        DB::transaction(fn () => $triggers->each->delete(), 3);
        $count = $triggers->count();

        return back()->with('success', $count === 1 ? 'Trigger deleted.' : "{$count} triggers deleted.");
    }

    private function parentFlow(FlowTrigger $trigger): Flow
    {
        $flow = $trigger->flow()->firstOrFail();
        $this->assertFlowInCurrentWorkspace($flow);

        return $flow;
    }

    private function assertFlowInCurrentWorkspace(Flow $flow): void
    {
        $workspaceId = $this->workspaceIdFromSession();
        abort_unless($flow->workspace_id === $workspaceId, 404);
    }
}
