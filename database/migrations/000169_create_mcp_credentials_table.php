<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mcp_credentials', function (Blueprint $table) {
            $table->string('id', 32)->primary();
            $table->string('workspace_id', 32);
            $table->foreign('workspace_id')->references('id')->on('workspaces')->cascadeOnDelete();
            $table->string('user_id', 32);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->string('team_id', 32)->nullable();
            $table->foreign('team_id')->references('id')->on('workspace_teams')->nullOnDelete();
            $table->string('name');
            $table->string('authentication', 32);
            $table->text('config')->nullable();
            $table->string('scope')->default('user');
            $table->boolean('is_active')->default(true);
            $table->boolean('stale')->default(false);
            $table->timestamps();

            $table->index(['workspace_id', 'is_active']);
            $table->index(['workspace_id', 'scope']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mcp_credentials');
    }
};
