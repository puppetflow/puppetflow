<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Enums\Authorization\Ability;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/** Resolves workspace-scoped resources for the public API: 404 when invisible, 403 when the ability is denied. */
trait ResolvesApiResources
{
    private function rejectCombinedPlacement(Request $request, string $folderKey): void
    {
        if ($request->exists($folderKey) && $request->hasAny(['visibility', 'team_id', 'user_id'])) {
            throw ValidationException::withMessages([
                $folderKey => 'A folder target cannot be combined with visibility, team_id or user_id.',
            ]);
        }
    }

    private function apiUser(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }

    private function resolveApiWorkspace(string $identifier, User $user): Workspace
    {
        $workspace = Workspace::query()
            ->where('id', $identifier)
            ->orWhere('lookup_key', $identifier)
            ->first();

        if (
            ! $workspace
            || Gate::forUser($user)->denies(Ability::VIEW->value, $workspace)
        ) {
            abort(404, 'Workspace not found.');
        }

        return $workspace;
    }

    /**
     * @template TModel of Model
     *
     * @param  class-string<TModel>  $model
     * @return TModel
     */
    private function resolveApiResource(
        string $model,
        string $identifier,
        User $user,
        Ability $ability,
        string $label,
    ): Model {
        /** @var TModel|null $resource */
        $resource = $model::query()->whereKey($identifier)->first();
        $gate = Gate::forUser($user);

        if (! $resource || $gate->denies(Ability::VIEW->value, $resource)) {
            abort(404, "{$label} not found.");
        }
        if ($ability !== Ability::VIEW && $gate->denies($ability->value, $resource)) {
            abort(403, 'Forbidden.');
        }

        return $resource;
    }
}
