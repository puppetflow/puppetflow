<?php

namespace App\Services\Explorer;

use App\Authorization\AuthorizationContext;
use App\Authorization\ScopeEvaluator;
use App\Models\WorkspaceTeam;
use App\Services\FeatureFlags\FeatureFlagService;

/**
 * Scope rules shared by every explorer: which teams are browsable and whether
 * the workspace section is available to the current actor.
 */
final class ExplorerAccess
{
    public function __construct(
        private readonly ScopeEvaluator $scopes,
        private readonly FeatureFlagService $features,
    ) {}

    /**
     * Returns all workspace team IDs for administrators or the user's team IDs otherwise.
     *
     * @return list<string>
     */
    public function visibleTeamIds(AuthorizationContext $context, string $workspaceId): array
    {
        $teamIds = $this->scopes->isAdministrator($context)
            ? WorkspaceTeam::where('workspace_id', $workspaceId)->pluck('id')->all()
            : $context->teamIds;

        return array_values(array_filter($teamIds, static fn (mixed $id): bool => is_string($id)));
    }

    public function workspaceAllowed(AuthorizationContext $context): bool
    {
        return $this->scopes->isAdministrator($context)
            || ($this->features->workspaceSharingEnabled() && $context->isWorkspaceMember);
    }

    /**
     * Visibilities that fall back to the personal space when their feature is disabled.
     *
     * @return list<string>
     */
    public function ownerFallbackVisibilities(): array
    {
        $visibilities = ['owner'];
        if (! $this->features->workspaceSharingEnabled()) {
            $visibilities[] = 'workspace';
        }
        if (! $this->features->teamsEnabled()) {
            $visibilities[] = 'team';
        }

        return $visibilities;
    }
}
