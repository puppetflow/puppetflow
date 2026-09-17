<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_folders', function (Blueprint $table): void {
            $table->string('id', 32)->primary();
            $table->string('workspace_id', 32);
            $table->foreign('workspace_id')->references('id')->on('workspaces')->cascadeOnDelete();
            $table->string('user_id', 32);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->string('team_id', 32)->nullable();
            $table->foreign('team_id')->references('id')->on('workspace_teams')->nullOnDelete();
            $table->string('parent_id', 32)->nullable();
            $table->string('name', 255);
            $table->string('visibility', 20)->default('owner');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['workspace_id', 'visibility']);
            $table->index(['workspace_id', 'user_id']);
            $table->index(['workspace_id', 'team_id']);
            $table->index(['workspace_id', 'parent_id']);
        });

        Schema::table('media_folders', function (Blueprint $table): void {
            $table->foreign('parent_id')->references('id')->on('media_folders')->cascadeOnDelete();
        });

        Schema::create('media_assets', function (Blueprint $table): void {
            $table->string('id', 32)->primary();
            $table->string('workspace_id', 32);
            $table->foreign('workspace_id')->references('id')->on('workspaces')->cascadeOnDelete();
            $table->string('user_id', 32);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->string('team_id', 32)->nullable();
            $table->foreign('team_id')->references('id')->on('workspace_teams')->nullOnDelete();
            $table->string('folder_id', 32)->nullable();
            $table->foreign('folder_id')->references('id')->on('media_folders')->nullOnDelete();
            $table->unsignedBigInteger('stored_upload_id')->unique();
            $table->foreign('stored_upload_id')->references('id')->on('stored_uploads')->restrictOnDelete();
            $table->string('name', 255);
            $table->string('original_filename', 255);
            $table->text('description')->nullable();
            $table->string('alt_text', 500)->nullable();
            $table->json('tags')->nullable();
            $table->string('visibility', 20)->default('owner');
            $table->timestamps();

            $table->index(['workspace_id', 'visibility']);
            $table->index(['workspace_id', 'user_id']);
            $table->index(['workspace_id', 'team_id']);
            $table->index(['workspace_id', 'folder_id']);
        });
    }

    public function down(): void
    {
        if (
            (Schema::hasTable('media_assets') && DB::table('media_assets')->exists())
            || (Schema::hasTable('media_folders') && DB::table('media_folders')->exists())
        ) {
            throw new RuntimeException('Delete every media asset and folder before rolling back the Media Library.');
        }

        Schema::dropIfExists('media_assets');
        Schema::dropIfExists('media_folders');
    }
};
