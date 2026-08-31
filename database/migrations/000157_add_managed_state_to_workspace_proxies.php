<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workspace_proxies', function (Blueprint $table) {
            $table->boolean('managed_by_env')->default(false)->after('group');
            $table->string('managed_key')->nullable()->after('managed_by_env');

            $table->index(['workspace_id', 'managed_by_env']);
            $table->unique(['workspace_id', 'managed_key']);
        });
    }

    public function down(): void
    {
        Schema::table('workspace_proxies', function (Blueprint $table) {
            $table->dropUnique(['workspace_id', 'managed_key']);
            $table->dropIndex(['workspace_id', 'managed_by_env']);
            $table->dropColumn(['managed_by_env', 'managed_key']);
        });
    }
};
