<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workspaces', function (Blueprint $table) {
            $table->boolean('click_markers_enabled')->default(true)->after('default_language');
        });

        Schema::table('flows', function (Blueprint $table) {
            $table->boolean('click_markers_enabled')->nullable()->after('disable_web_security');
        });
    }

    public function down(): void
    {
        Schema::table('workspaces', function (Blueprint $table) {
            $table->dropColumn('click_markers_enabled');
        });

        Schema::table('flows', function (Blueprint $table) {
            $table->dropColumn('click_markers_enabled');
        });
    }
};
