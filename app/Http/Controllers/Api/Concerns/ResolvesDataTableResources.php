<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Enums\Authorization\Ability;
use App\Models\DataTable;
use App\Models\DataTableColumn;
use App\Models\User;
use Illuminate\Http\Request;

trait ResolvesDataTableResources
{
    use ResolvesApiResources;

    private function resolveApiDataTable(
        string $identifier,
        User $user,
        Ability $ability = Ability::VIEW,
    ): DataTable {
        return $this->resolveApiResource(DataTable::class, $identifier, $user, $ability, 'Data table');
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
