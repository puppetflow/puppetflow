<?php

use App\Models\McpCredential;
use App\Models\UserVariable;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $credentialIdsByWorkspace = McpCredential::query()
            ->get(['id', 'workspace_id'])
            ->groupBy('workspace_id')
            ->map(fn ($credentials) => $credentials->pluck('id')->flip());
        UserVariable::query()
            ->where('type', 'secret')
            ->eachById(function (UserVariable $variable) use ($credentialIdsByWorkspace): void {
                if ($credentialIdsByWorkspace->get($variable->workspace_id)?->has($variable->value)) {
                    $variable->updateQuietly(['type' => UserVariable::TYPE_MCP_CREDENTIALS]);
                }
            });
    }

    public function down(): void
    {
        UserVariable::query()
            ->where('type', UserVariable::TYPE_MCP_CREDENTIALS)
            ->update(['type' => 'secret']);
    }
};
