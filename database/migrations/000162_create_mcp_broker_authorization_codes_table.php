<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mcp_access_tokens', function (Blueprint $table) {
            $table->boolean('broker_created')->default(false)->index();
        });

        Schema::create('mcp_broker_authorization_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code_hash', 64)->unique();
            $table->string('user_id', 32);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->string('workspace_id', 32);
            $table->foreign('workspace_id')->references('id')->on('workspaces')->cascadeOnDelete();
            $table->string('redirect_uri', 2048);
            $table->string('code_challenge', 43);
            $table->timestamp('expires_at')->index();
            $table->timestamps();

            $table->index(['workspace_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mcp_broker_authorization_codes');

        Schema::table('mcp_access_tokens', function (Blueprint $table) {
            $table->dropColumn('broker_created');
        });
    }
};
