<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * MCP access checks require a workspace_mcp_settings row, but the row was
     * only created when an admin opened the workspace settings page. Create
     * the default row for every workspace that still lacks one so MCP is
     * really enabled by default, as the UI already claims.
     */
    public function up(): void
    {
        $now = now();

        DB::table('workspaces')
            ->whereNotExists(function ($query): void {
                $query->select(DB::raw(1))
                    ->from('workspace_mcp_settings')
                    ->whereColumn('workspace_mcp_settings.workspace_id', 'workspaces.id');
            })
            ->pluck('id')
            ->chunk(500)
            ->each(function ($ids) use ($now): void {
                DB::table('workspace_mcp_settings')->insertOrIgnore(
                    $ids->map(fn (string $id): array => [
                        'workspace_id' => $id,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ])->all(),
                );
            });
    }

    public function down(): void
    {
        // Backfilled rows are indistinguishable from user-created ones.
    }
};
