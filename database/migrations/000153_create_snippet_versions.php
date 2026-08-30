<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('snippet_versions', function (Blueprint $table): void {
            $table->id();
            $table->string('snippet_id', 32);
            $table->foreign('snippet_id')->references('id')->on('snippets')->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->text('args')->nullable();
            $table->longText('code')->nullable();
            $table->string('snippet_type')->default('code');
            $table->json('nodal_graph')->nullable();
            $table->string('published_by', 32)->nullable();
            $table->foreign('published_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamp('published_at');
            $table->timestamps();

            $table->unique(['snippet_id', 'version']);
        });

        Schema::table('snippets', function (Blueprint $table): void {
            $table->timestamp('content_updated_at', precision: 6)->nullable()->after('nodal_graph');
            $table->foreignId('published_version_id')
                ->nullable()
                ->after('is_active')
                ->constrained('snippet_versions')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('snippets', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('published_version_id');
            $table->dropColumn('content_updated_at');
        });

        Schema::dropIfExists('snippet_versions');
    }
};
