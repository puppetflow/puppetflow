<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mcp_oauth_clients', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->string('user_id', 32)->nullable()->change();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            $table->boolean('dynamically_registered')->default(false)->after('redirect_uri');
        });
    }

    public function down(): void
    {
        Schema::table('mcp_oauth_clients', function (Blueprint $table) {
            $table->dropColumn('dynamically_registered');
            $table->dropForeign(['user_id']);
            $table->string('user_id', 32)->nullable(false)->change();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }
};
