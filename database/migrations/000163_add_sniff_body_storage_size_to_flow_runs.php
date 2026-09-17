<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('flow_runs', function (Blueprint $table): void {
            $table->unsignedBigInteger('sniff_bodies_size_bytes')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('flow_runs', function (Blueprint $table): void {
            $table->dropColumn('sniff_bodies_size_bytes');
        });
    }
};
