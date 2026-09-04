<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Enums\Authorization\Ability;
use App\Models\DataTable;
use App\Models\DataTableColumn;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

trait ResolvesDataTableResources
{
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

    private function resolveApiDataTable(
        string $identifier,
        User $user,
        Ability $ability = Ability::VIEW,
    ): DataTable {
        $dataTable = DataTable::query()
            ->whereKey($identifier)
            ->first();

        if (
            ! $dataTable
            || Gate::forUser($user)->denies(Ability::VIEW->value, $dataTable)
        ) {
            abort(404, 'Data table not found.');
        }

        if (
            $ability !== Ability::VIEW
            && Gate::forUser($user)->denies($ability->value, $dataTable)
        ) {
            abort(403, 'Forbidden.');
        }

        return $dataTable;
    }

    private function resolveApiDataTableForRequest(
        Request $request,
        string $identifier,
        Ability $ability = Ability::VIEW,
    ): DataTable {
        /** @var User $user */
        $user = $request->user();

        return $this->resolveApiDataTable($identifier, $user, $ability);
    }

    private function resolveApiDataTableColumn(
        DataTable $dataTable,
        string $identifier,
    ): DataTableColumn {
        $column = $dataTable->columns()->whereKey($identifier)->first();
        if (! $column) {
            abort(404, 'Data table column not found.');
        }

        return $column;
    }

    private function resolveApiRowId(string $identifier): int
    {
        if (! ctype_digit($identifier) || (int) $identifier < 1) {
            abort(404, 'Data table row not found.');
        }

        return (int) $identifier;
    }
}
