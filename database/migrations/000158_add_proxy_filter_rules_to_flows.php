<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('flows', function (Blueprint $table): void {
            $table->json('proxy_filter_rules')->nullable()->after('workspace_proxy_id');
        });
    }

    public function down(): void
    {
        Schema::table('flows', function (Blueprint $table): void {
            $table->dropColumn('proxy_filter_rules');
        });
    }
};
