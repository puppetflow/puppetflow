<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('flow_runs', function (Blueprint $table) {
            $table->unsignedBigInteger('recording_size_bytes')->default(0);
            $table->unsignedBigInteger('screenshots_size_bytes')->default(0);
            $table->unsignedBigInteger('downloads_size_bytes')->default(0);
            $table->unsignedBigInteger('flow_data_size_bytes')->default(0);
            $table->unsignedBigInteger('console_logs_size_bytes')->default(0);
            $table->unsignedBigInteger('storage_size_bytes')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('flow_runs', function (Blueprint $table) {
            $table->dropColumn([
                'recording_size_bytes',
                'screenshots_size_bytes',
                'downloads_size_bytes',
                'flow_data_size_bytes',
                'console_logs_size_bytes',
                'storage_size_bytes',
            ]);
        });
    }
};
