<?php

use App\Models\Flow;
use App\Models\FlowVersion;
use App\Services\Flow\NodalGraphCompiler;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Log;

/**
 * run() now receives the run context as its own argument instead of reading it from $input.
 * Compiled nodal code is stored, so every graph is recompiled against the new prelude.
 */
return new class extends Migration
{
    public function up(): void
    {
        $compiler = app(NodalGraphCompiler::class);
        $recompile = function (Model $model) use ($compiler): void {
            /** @var array<string, mixed>|null $graph */
            $graph = $model->getAttribute('nodal_graph');
            if ($graph === null) {
                return;
            }
            try {
                $model->newQuery()->whereKey($model->getKey())->update(['code' => $compiler->compile($graph)]);
            } catch (\Throwable $exception) {
                Log::warning('Nodal flow could not be recompiled; saving it in the editor will.', [
                    'model' => $model::class,
                    'id' => $model->getKey(),
                    'error' => $exception->getMessage(),
                ]);
            }
        };

        Flow::query()->whereNotNull('nodal_graph')->eachById($recompile);
        FlowVersion::query()->whereNotNull('nodal_graph')->eachById($recompile);
    }

    public function down(): void
    {
        // The previous compiled code is not kept; re-running up() on the old compiler restores it.
    }
};
