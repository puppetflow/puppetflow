<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_assets', function (Blueprint $table): void {
            $table->unsignedBigInteger('thumbnail_stored_upload_id')->nullable()->unique();
            $table->foreign('thumbnail_stored_upload_id')
                ->references('id')
                ->on('stored_uploads')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('media_assets', function (Blueprint $table): void {
            $table->dropForeign(['thumbnail_stored_upload_id']);
            $table->dropColumn('thumbnail_stored_upload_id');
        });
    }
};
