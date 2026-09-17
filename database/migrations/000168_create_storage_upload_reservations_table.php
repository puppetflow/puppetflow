<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storage_upload_reservations', function (Blueprint $table): void {
            $table->string('id', 32)->primary();
            $table->string('workspace_id', 32)->index();
            $table->string('user_id', 32)->index();
            $table->string('disk');
            $table->string('status')->index();
            $table->unsignedBigInteger('expected_bytes');
            $table->json('payload');
            $table->timestamp('expires_at')->index();
            $table->timestamps();

            $table->index(['status', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storage_upload_reservations');
    }
};
