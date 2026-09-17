<?php

namespace App\Http\Controllers\Internal\Concerns;

use App\Models\Flow;
use App\Models\FlowRun;
use App\Models\User;
use Illuminate\Http\Request;

trait ResolvesRuntimeActor
{
    /**
     * The active run behind a runner capability token, with its flow and the user it acts for.
     *
     * @return array{FlowRun, Flow, User}
     */
    private function runtimeContext(Request $request): array
    {
        $run = $request->attributes->get('runner');
        abort_unless($run instanceof FlowRun && $run->status === 'running', 409, 'The flow run is not active.');
        $flow = Flow::query()->find($run->flow_id);
        $actor = User::query()->find($run->triggered_by);
        abort_unless($flow instanceof Flow && $actor instanceof User, 403);

        return [$run, $flow, $actor];
    }
}
