<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('flow_run_sniff_bodies', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('flow_run_id')->constrained()->cascadeOnDelete();
            $table->char('capture_id', 32);
            $table->text('content');
            $table->timestamp('created_at')->nullable();
            $table->unique(['flow_run_id', 'capture_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('flow_run_sniff_bodies');
    }
};
