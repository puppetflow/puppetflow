<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Instance-level OAuth clients are not bound to a workspace: the user picks one during authorization.
        Schema::table('mcp_oauth_clients', function (Blueprint $table) {
            $table->dropForeign(['workspace_id']);
            $table->string('workspace_id', 32)->nullable()->change();
            $table->foreign('workspace_id')->references('id')->on('workspaces')->cascadeOnDelete();
        });

        Schema::create('mcp_oauth_workspace_grants', function (Blueprint $table) {
            $table->id();
            $table->string('user_id', 32);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->uuid('oauth_client_id');
            $table->string('workspace_id', 32);
            $table->foreign('workspace_id')->references('id')->on('workspaces')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'oauth_client_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mcp_oauth_workspace_grants');

        Schema::table('mcp_oauth_clients', function (Blueprint $table) {
            $table->dropForeign(['workspace_id']);
            $table->string('workspace_id', 32)->nullable(false)->change();
            $table->foreign('workspace_id')->references('id')->on('workspaces')->cascadeOnDelete();
        });
    }
};
