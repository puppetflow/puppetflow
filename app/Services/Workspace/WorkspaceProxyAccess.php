<?php

namespace App\Services\Workspace;

use App\Authorization\AuthorizationContextFactory;
use App\Authorization\Visibility\SharedResourceVisibility;
use App\Models\User;
use App\Models\WorkspaceProxy;
use Illuminate\Validation\ValidationException;

final class WorkspaceProxyAccess
{
    public function __construct(
        private readonly AuthorizationContextFactory $contexts,
        private readonly SharedResourceVisibility $visibility,
    ) {}

    /**
     * Fails validation unless the proxy exists and is usable by the given user in the workspace.
     */
    public function ensureUsable(?int $proxyId, string $workspaceId, User $user, string $errorKey = 'workspace_proxy_id'): WorkspaceProxy
    {
        if ($proxyId === null) {
            throw ValidationException::withMessages([
                $errorKey => 'Select a proxy.',
            ]);
        }

        $query = WorkspaceProxy::query()->whereKey($proxyId)->where('workspace_id', $workspaceId);
        $this->visibility->applyUse(
            $query,
            $this->contexts->for($user, $workspaceId),
            scopeColumn: 'visibility',
            alwaysVisibleColumn: 'managed_by_env',
        );
        $proxy = $query->first();
        if (! $proxy instanceof WorkspaceProxy) {
            throw ValidationException::withMessages([
                $errorKey => 'The selected proxy is not available to the trigger owner.',
            ]);
        }

        return $proxy;
    }
}
