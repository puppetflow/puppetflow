<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('flow_triggers', function (Blueprint $table) {
            // Null means the trigger inherits the flow proxy settings.
            $table->string('proxy_mode', 16)->nullable()->after('config');
            $table->unsignedBigInteger('workspace_proxy_id')->nullable()->after('proxy_mode');
            $table->foreign('workspace_proxy_id')->references('id')->on('workspace_proxies')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('flow_triggers', function (Blueprint $table) {
            $table->dropForeign(['workspace_proxy_id']);
            $table->dropColumn(['workspace_proxy_id', 'proxy_mode']);
        });
    }
};
