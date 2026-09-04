<?php

namespace App\Http\Controllers\Api;

use App\Authorization\AuthorizationContextFactory;
use App\Enums\Authorization\Ability;
use App\Http\Controllers\Controller;
use App\Mail\WorkspaceInvitationMail;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Services\FeatureFlags\FeatureFlagService;
use App\Services\Workspace\WorkspaceInvitationManager;
use App\Services\Workspace\WorkspaceMembershipManager;
use App\Support\IdentityEmail;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

class WorkspaceMemberApiController extends Controller
{
    public function __construct(
        private readonly WorkspaceInvitationManager $invitations,
        private readonly WorkspaceMembershipManager $memberships,
        private readonly AuthorizationContextFactory $authorizationContexts,
        private readonly FeatureFlagService $features,
    ) {}

    public function index(Request $request, Workspace $workspace): JsonResponse
    {
        $this->authorizeWorkspace($request, $workspace, Ability::VIEW);
        $query = $this->visibleMembersQuery($request, $workspace);

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($nested) use ($search): void {
                $nested->where('users.name', 'like', "%{$search}%")
                    ->orWhere('users.email', 'like', "%{$search}%");
            });
        }

        $limit = min(max($request->integer('limit', 50), 1), 100);

        return response()->json(
            $query->orderBy('users.name')
                ->limit($limit)
                ->get()
                ->map(fn (User $member): array => $this->serializeMember($member, $workspace))
                ->values(),
        );
    }

    public function store(Request $request, Workspace $workspace): JsonResponse
    {
        $this->authorizeWorkspace($request, $workspace, Ability::MANAGE_MEMBERS);
        /** @var User $actor */
        $actor = $request->user();
        $request->merge(['email' => IdentityEmail::normalize($request->input('email'))]);
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'role' => ['required', Rule::in($this->allowedRoles())],
        ]);
        if ($validated['role'] === 'admin') {
            Gate::forUser($actor)->authorize(Ability::UPDATE->value, $workspace);
        }

        $result = $this->invitations->inviteOrAttach(
            $workspace,
            $validated['email'],
            $validated['role'],
            $actor,
            null,
            $actor,
        );

        if ($result instanceof User) {
            $member = $this->memberQuery($workspace)->whereKey($result->id)->firstOrFail();

            return response()->json($this->serializeMember($member, $workspace), 201);
        }

        Mail::to($result->email)->send(new WorkspaceInvitationMail($result));

        return response()->json($this->serializeInvitation($result), 202);
    }

    public function show(Request $request, Workspace $workspace, User $member): JsonResponse
    {
        $this->authorizeWorkspace($request, $workspace, Ability::VIEW);
        $resolvedMember = $this->visibleMembersQuery($request, $workspace)
            ->whereKey($member->id)
            ->first();
        if (! $resolvedMember) {
            return response()->json(['error' => 'Workspace member not found.'], 404);
        }

        return response()->json($this->serializeMember($resolvedMember, $workspace));
    }

    public function update(Request $request, Workspace $workspace, User $member): JsonResponse
    {
        $this->authorizeWorkspace($request, $workspace, Ability::MANAGE_MEMBERS);
        $resolvedMember = $this->memberQuery($workspace)->whereKey($member->id)->first();
        if (! $resolvedMember) {
            return response()->json(['error' => 'Workspace member not found.'], 404);
        }
        /** @var User $actor */
        $actor = $request->user();
        $validated = $request->validate([
            'role' => ['required', Rule::in($this->allowedRoles())],
        ]);
        if ($validated['role'] === 'admin') {
            Gate::forUser($actor)->authorize(Ability::UPDATE->value, $workspace);
        }

        $this->memberships->changeRole(
            $workspace,
            $resolvedMember,
            $validated['role'],
            $actor,
            null,
        );
        $resolvedMember = $this->memberQuery($workspace)->whereKey($member->id)->firstOrFail();

        return response()->json($this->serializeMember($resolvedMember, $workspace));
    }

    public function destroy(Request $request, Workspace $workspace, User $member): JsonResponse
    {
        $this->authorizeWorkspace($request, $workspace, Ability::MANAGE_MEMBERS);
        $resolvedMember = $this->memberQuery($workspace)->whereKey($member->id)->first();
        if (! $resolvedMember) {
            return response()->json(['error' => 'Workspace member not found.'], 404);
        }

        $this->memberships->remove($workspace, $resolvedMember, $request->user());

        return response()->json(['message' => 'Workspace member removed.']);
    }

    /** @return BelongsToMany<User, Workspace> */
    private function visibleMembersQuery(Request $request, Workspace $workspace): BelongsToMany
    {
        $query = $this->memberQuery($workspace);
        /** @var User $user */
        $user = $request->user();
        $context = $this->authorizationContexts->for($user, $workspace->id);

        if (
            ! $context->isInstanceAdmin()
            && $this->features->sharingRolesEnabled()
            && $context->workspaceRole === 'manager'
        ) {
            $query->whereIn('users.id', DB::table('team_user')
                ->where('workspace_id', $workspace->id)
                ->whereIn('team_id', $context->teamIds)
                ->select('user_id'));
        }

        return $query;
    }

    /** @return BelongsToMany<User, Workspace> */
    private function memberQuery(Workspace $workspace): BelongsToMany
    {
        return $workspace->users()->with([
            'teams' => fn ($query) => $query->where('workspace_teams.workspace_id', $workspace->id),
        ]);
    }

    private function authorizeWorkspace(Request $request, Workspace $workspace, Ability $ability): void
    {
        Gate::forUser($request->user())->authorize($ability->value, $workspace);
    }

    /** @return list<string> */
    private function allowedRoles(): array
    {
        return $this->features->sharingRolesEnabled()
            ? ['admin', 'manager', 'member']
            : ['member'];
    }

    /** @return array<string, mixed> */
    private function serializeMember(User $member, Workspace $workspace): array
    {
        $createdAt = $member->pivot->getAttribute('created_at');
        $updatedAt = $member->pivot->getAttribute('updated_at');

        return [
            'id' => $member->id,
            'workspace_id' => $workspace->id,
            'name' => $member->name,
            'email' => $member->email,
            'role' => $member->pivot->getAttribute('role') ?? 'member',
            'teams' => $member->teams->map(fn ($team): array => [
                'id' => $team->id,
                'name' => $team->name,
            ])->values(),
            'created_at' => $createdAt instanceof \DateTimeInterface ? $createdAt->format(DATE_ATOM) : null,
            'updated_at' => $updatedAt instanceof \DateTimeInterface ? $updatedAt->format(DATE_ATOM) : null,
        ];
    }

    /** @return array<string, mixed> */
    private function serializeInvitation(WorkspaceInvitation $invitation): array
    {
        return [
            'id' => $invitation->id,
            'workspace_id' => $invitation->workspace_id,
            'email' => $invitation->email,
            'role' => $invitation->role,
            'status' => 'pending',
            'expires_at' => $invitation->expires_at->toIso8601String(),
        ];
    }
}
