<?php

namespace App\Http\Controllers\Api;

use App\Enums\Authorization\Ability;
use App\Http\Controllers\Controller;
use App\Models\Folder;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTeam;
use App\Services\FeatureFlags\FeatureFlagService;
use App\Services\Workspace\WorkspaceTeamMembershipManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class TeamApiController extends Controller
{
    public function __construct(
        private FeatureFlagService $features,
        private WorkspaceTeamMembershipManager $workspaceTeams,
    ) {}

    public function index(Request $request, Workspace $workspace): JsonResponse
    {
        if (Gate::forUser($request->user())->denies(Ability::VIEW_ANY->value, [WorkspaceTeam::class, $workspace])) {
            return response()->json(['error' => 'Workspace not found.'], 404);
        }

        $this->features->abortIfDisabled('teams_enabled');

        $teams = $workspace->teams()
            ->withCount('users')
            ->orderBy('name')
            ->get()
            ->filter(fn (WorkspaceTeam $team): bool => Gate::forUser($request->user())
                ->allows(Ability::VIEW->value, $team));

        return response()->json($teams->map(fn (WorkspaceTeam $team) => $this->serializeTeam($team, $workspace))->values());
    }

    public function store(Request $request, Workspace $workspace): JsonResponse
    {
        if (Gate::forUser($request->user())->denies(Ability::CREATE->value, [WorkspaceTeam::class, $workspace])) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }

        $this->features->abortIfDisabled('teams_enabled');

        $data = $request->validate($this->rules($workspace));

        $team = DB::transaction(function () use ($data, $workspace) {
            $team = WorkspaceTeam::create([
                'workspace_id' => $workspace->id,
                'name' => $data['name'],
            ]);

            Folder::create([
                'name' => $team->name,
                'workspace_id' => $workspace->id,
                'is_shared' => true,
                'team_id' => $team->id,
                'parent_id' => null,
                'sort_order' => 0,
            ]);

            return $team;
        });

        $team->loadCount('users');

        return response()->json($this->serializeTeam($team, $workspace), 201);
    }

    public function show(Request $request, WorkspaceTeam $team): JsonResponse
    {
        if (Gate::forUser($request->user())->denies(Ability::VIEW->value, $team)) {
            return response()->json(['error' => 'Team not found.'], 404);
        }

        $this->features->abortIfDisabled('teams_enabled');
        $workspace = $this->workspaceForTeam($team);

        $team->load(['users:id,name,email'])->loadCount('users');

        return response()->json($this->serializeTeam($team, $workspace, includeMembers: true));
    }

    public function update(Request $request, WorkspaceTeam $team): JsonResponse
    {
        if (Gate::forUser($request->user())->denies(Ability::UPDATE->value, $team)) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }

        $this->features->abortIfDisabled('teams_enabled');
        $workspace = $this->workspaceForTeam($team);

        $data = $request->validate($this->rules($workspace, $team));

        $team->update($data);

        if (isset($data['name'])) {
            Folder::where('team_id', $team->id)->whereNull('parent_id')->update(['name' => $data['name']]);
        }

        $team->refresh()->loadCount('users');

        return response()->json($this->serializeTeam($team, $workspace));
    }

    public function addMembers(Request $request, WorkspaceTeam $team): JsonResponse
    {
        $this->features->abortIfDisabled('teams_enabled');

        if (Gate::forUser($request->user())->denies(Ability::MANAGE_MEMBERS->value, $team)) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }
        $workspace = $this->workspaceForTeam($team);

        $data = $request->validate([
            'member_id' => [
                'sometimes',
                'string',
                Rule::exists('user_workspace', 'user_id')
                    ->where('workspace_id', $workspace->id),
            ],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => [
                'string',
                'distinct',
                Rule::exists('user_workspace', 'user_id')
                    ->where('workspace_id', $workspace->id),
            ],
        ]);

        /** @var list<string> $validatedMemberIds */
        $validatedMemberIds = $data['member_ids'] ?? [];
        $memberIds = collect($validatedMemberIds)
            ->push($data['member_id'] ?? null)
            ->filter()
            ->unique()
            ->values();
        $memberIds = array_values($memberIds->all());

        if ($memberIds === []) {
            return response()->json(['error' => 'At least one member_id is required.'], 422);
        }

        $this->workspaceTeams->addMembers(
            $team,
            $memberIds,
            null,
            $request->user(),
        );

        $team->load(['users:id,name,email'])->loadCount('users');

        return response()->json($this->serializeTeam($team, $workspace, includeMembers: true));
    }

    public function replaceMembers(Request $request, WorkspaceTeam $team): JsonResponse
    {
        $this->features->abortIfDisabled('teams_enabled');

        if (Gate::forUser($request->user())->denies(Ability::MANAGE_MEMBERS->value, $team)) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }
        $workspace = $this->workspaceForTeam($team);

        $data = $request->validate([
            'member_ids' => ['required', 'array'],
            'member_ids.*' => [
                'string',
                'distinct',
                Rule::exists('user_workspace', 'user_id')
                    ->where('workspace_id', $workspace->id),
            ],
        ]);

        /** @var list<string> $memberIds */
        $memberIds = $data['member_ids'];

        $this->workspaceTeams->replaceMembers(
            $team,
            $memberIds,
            null,
            $request->user(),
        );

        $team->load(['users:id,name,email'])->loadCount('users');

        return response()->json($this->serializeTeam($team, $workspace, includeMembers: true));
    }

    public function setMemberTeams(Request $request, Workspace $workspace, User $member): JsonResponse
    {
        if (Gate::forUser($request->user())->denies(Ability::MANAGE_MEMBERS->value, $workspace)) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }

        $this->features->abortIfDisabled('teams_enabled');
        abort_unless(
            $workspace->users()->where('users.id', $member->id)->exists(),
            404,
        );

        $data = $request->validate([
            'team_ids' => ['required', 'array'],
            'team_ids.*' => [
                'string',
                'distinct',
                Rule::exists('workspace_teams', 'id')->where('workspace_id', $workspace->id),
            ],
        ]);

        $teamIds = array_values($data['team_ids']);

        $this->workspaceTeams->replaceUserTeamsForWorkspace(
            $workspace,
            $member,
            $teamIds,
            null,
            $request->user(),
        );

        $member->load(['workspaces:id,name', 'teams:id,workspace_id,name']);

        return response()->json([
            'member_id' => $member->id,
            'workspace_id' => $workspace->id,
            'team_ids' => $member->teams->where('workspace_id', $workspace->id)->pluck('id')->values(),
        ]);
    }

    /**
     * @return array<string, list<mixed>>
     */
    private function rules(Workspace $workspace, ?WorkspaceTeam $team = null): array
    {
        return [
            'name' => [
                $team ? 'sometimes' : 'required',
                'string',
                'max:50',
                Rule::unique('workspace_teams', 'name')
                    ->where('workspace_id', $workspace->id)
                    ->ignore($team?->id),
            ],
        ];
    }

    private function workspaceForTeam(WorkspaceTeam $team): Workspace
    {
        return Workspace::findOrFail($team->workspace_id);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeTeam(WorkspaceTeam $team, Workspace $workspace, bool $includeMembers = false): array
    {
        $data = [
            'id' => $team->id,
            'workspace_id' => $workspace->id,
            'name' => $team->name,
            'members_count' => $team->users_count ?? null,
            'created_at' => $team->created_at?->toIso8601String(),
            'updated_at' => $team->updated_at?->toIso8601String(),
        ];

        if ($includeMembers) {
            $workspaceRoles = DB::table('user_workspace')
                ->where('workspace_id', $team->workspace_id)
                ->whereIn('user_id', $team->users->pluck('id'))
                ->pluck('role', 'user_id');
            $data['members'] = [];
            foreach ($team->users as $user) {
                $workspaceRole = $workspaceRoles->get($user->id);
                $data['members'][] = [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => is_string($workspaceRole) ? $workspaceRole : 'member',
                ];
            }
        }

        return $data;
    }
}
