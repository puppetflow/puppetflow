<?php

namespace App\Http\Controllers\Api;

use App\Enums\Authorization\Ability;
use App\Http\Controllers\Api\Concerns\ResolvesFlow;
use App\Http\Controllers\Controller;
use App\Models\Flow;
use App\Models\FlowVersion;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class FlowVersionApiController extends Controller
{
    use ResolvesFlow;

    public function index(Request $request, string $id): JsonResponse
    {
        [$flow, $error] = $this->authorizedFlow($request, $id, Ability::VIEW);
        if ($error) {
            return $error;
        }
        /** @var Flow $flow */
        $flow->load('publishedVersion:id,version');

        $versions = $flow->versions()
            ->with('publisher:id,name')
            ->latest('version')
            ->get()
            ->map(fn (FlowVersion $version): array => $this->metadata($version))
            ->values();

        return response()->json([
            'flow_id' => $flow->id,
            'published_version' => $flow->publishedVersion?->version,
            'content_updated_at' => ($flow->content_updated_at ?? $flow->updated_at)?->toJSON(),
            'versions' => $versions,
        ]);
    }

    public function show(Request $request, string $id, int $version): JsonResponse
    {
        [$flow, $error] = $this->authorizedFlow($request, $id, Ability::VIEW);
        if ($error) {
            return $error;
        }
        /** @var Flow $flow */
        $flowVersion = $this->version($flow, $version);
        if (! $flowVersion) {
            return response()->json(['error' => 'Flow version not found.'], 404);
        }
        $flowVersion->load('publisher:id,name');

        return response()->json([
            ...$this->metadata($flowVersion),
            'code' => $flowVersion->code,
            'nodal_graph' => $flowVersion->nodal_graph,
        ]);
    }

    public function restore(Request $request, string $id, int $version): JsonResponse
    {
        [$flow, $error] = $this->authorizedFlow($request, $id, Ability::UPDATE);
        if ($error) {
            return $error;
        }
        /** @var Flow $flow */
        $validated = $request->validate([
            'content_updated_at' => ['required', 'string'],
        ]);
        $clientTimestamp = $this->contentTimestamp($validated['content_updated_at']);

        /** @var array{flow: Flow, version: FlowVersion}|null $result */
        $result = DB::transaction(function () use ($flow, $request, $version, $clientTimestamp): ?array {
            $lockedFlow = Flow::query()
                ->where('workspace_id', $flow->workspace_id)
                ->whereKey($flow->id)
                ->lockForUpdate()
                ->first();
            /** @var User $user */
            $user = $request->user();
            if (! $lockedFlow || Gate::forUser($user)->denies(Ability::UPDATE->value, $lockedFlow)) {
                return null;
            }
            if ($lockedFlow->source_type !== 'code') {
                abort(423, 'Duplicate externally managed flows before restoring a historical version.');
            }

            $flowVersion = $this->version($lockedFlow, $version);
            if (! $flowVersion) {
                return null;
            }

            $serverTimestamp = $lockedFlow->content_updated_at ?? $lockedFlow->updated_at;
            if (! $serverTimestamp || ! $serverTimestamp->equalTo($clientTimestamp)) {
                throw ValidationException::withMessages([
                    'content_updated_at' => 'This flow changed since it was read. Read the latest flow and retry.',
                ]);
            }

            $lockedFlow->update([
                'code' => $flowVersion->code,
                'nodal_graph' => $flowVersion->flow_type === 'nodal' ? $flowVersion->nodal_graph : null,
                'flow_type' => $flowVersion->flow_type,
            ]);

            return ['flow' => $lockedFlow, 'version' => $flowVersion];
        }, 3);

        if ($result === null) {
            return response()->json(['error' => 'Flow or version not found.'], 404);
        }

        $restoredFlow = $result['flow']->fresh(['publishedVersion']) ?? $result['flow'];

        return response()->json([
            'flow_id' => $restoredFlow->id,
            'restored_version' => $result['version']->version,
            'flow_type' => $restoredFlow->flow_type,
            'is_published' => (bool) $restoredFlow->is_published,
            'published_version' => $restoredFlow->published_version_number,
            'content_updated_at' => ($restoredFlow->content_updated_at ?? $restoredFlow->updated_at)?->toJSON(),
        ]);
    }

    /**
     * @return array{0: Flow|null, 1: JsonResponse|null}
     */
    private function authorizedFlow(Request $request, string $id, Ability $ability): array
    {
        /** @var User $user */
        $user = $request->user();
        $flow = $this->resolveFlow($id, $user);
        if (! $flow) {
            return [null, response()->json(['error' => 'Flow not found.'], 404)];
        }
        if (Gate::forUser($user)->denies($ability->value, $flow)) {
            return [null, response()->json(['error' => 'Forbidden.'], 403)];
        }

        return [$flow, null];
    }

    private function version(Flow $flow, int $version): ?FlowVersion
    {
        if ($version < 1) {
            return null;
        }

        return $flow->versions()->where('version', $version)->first();
    }

    private function contentTimestamp(string $value): Carbon
    {
        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            throw ValidationException::withMessages([
                'content_updated_at' => 'The content timestamp is invalid.',
            ]);
        }
    }

    /** @return array<string, mixed> */
    private function metadata(FlowVersion $version): array
    {
        $publisher = $version->publisher;

        return [
            'id' => $version->id,
            'version' => $version->version,
            'flow_type' => $version->flow_type,
            'published_at' => $version->published_at->toJSON(),
            'publisher' => $publisher instanceof User
                ? ['id' => $publisher->id, 'name' => $publisher->name]
                : null,
        ];
    }
}
