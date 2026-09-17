<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workspaces', function (Blueprint $table) {
            $table->string('default_user_agent', 512)->nullable()->after('keyboard_speed');
        });

        Schema::table('flows', function (Blueprint $table) {
            $table->string('user_agent', 512)->nullable()->after('keyboard_speed');
        });
    }

    public function down(): void
    {
        Schema::table('workspaces', function (Blueprint $table) {
            $table->dropColumn('default_user_agent');
        });

        Schema::table('flows', function (Blueprint $table) {
            $table->dropColumn('user_agent');
        });
    }
};
