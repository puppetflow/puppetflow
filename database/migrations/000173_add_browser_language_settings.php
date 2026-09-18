<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workspaces', function (Blueprint $table) {
            $table->string('default_language', 64)->nullable()->after('default_user_agent');
        });

        Schema::table('flows', function (Blueprint $table) {
            $table->string('language', 64)->nullable()->after('user_agent');
        });
    }

    public function down(): void
    {
        Schema::table('workspaces', function (Blueprint $table) {
            $table->dropColumn('default_language');
        });

        Schema::table('flows', function (Blueprint $table) {
            $table->dropColumn('language');
        });
    }
};
