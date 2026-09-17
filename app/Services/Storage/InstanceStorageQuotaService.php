<?php

namespace App\Services\Storage;

use App\Exceptions\InstanceStorageQuotaExceededException;
use App\Models\FlowRunArtifact;
use App\Models\StorageUploadReservation;
use App\Models\StoredUpload;
use App\Services\FeatureFlags\FeatureFlagService;
use Closure;
use Illuminate\Support\Facades\Cache;

final class InstanceStorageQuotaService
{
    private const LOCK_NAME = 'instance-storage:quota-admission';

    private const LOCK_SECONDS = 300;

    private const WAIT_SECONDS = 30;

    public function __construct(
        private readonly FeatureFlagService $featureFlags,
    ) {}

    public function limitBytes(): int
    {
        return max(0, $this->featureFlags->limit('instance_storage_limit_bytes'));
    }

    public function usedBytes(): int
    {
        return (int) (
            StoredUpload::query()->where('status', StoredUpload::STATUS_READY)->sum('size_bytes')
            + FlowRunArtifact::query()->where('status', FlowRunArtifact::STATUS_READY)->sum('size_bytes')
            + StorageUploadReservation::query()
                ->where('status', StorageUploadReservation::STATUS_PENDING)
                ->where('expires_at', '>', now())
                ->sum('expected_bytes')
        );
    }

    /**
     * @template TResult
     *
     * @param  int|Closure(): int  $deltaBytes
     * @param  Closure(): TResult  $callback
     * @return TResult
     */
    public function admit(int|Closure $deltaBytes, Closure $callback): mixed
    {
        // Unlimited instances (the default) never pay for the global
        // admission lock; it only serializes writes when a quota is enforced.
        $limit = $this->limitBytes();
        if ($limit <= 0) {
            return $callback();
        }

        return Cache::lock(self::LOCK_NAME, self::LOCK_SECONDS)->block(self::WAIT_SECONDS, function () use ($deltaBytes, $callback, $limit): mixed {
            $delta = max(0, is_int($deltaBytes) ? $deltaBytes : $deltaBytes());
            if ($delta > 0) {
                $used = $this->usedBytes();
                if ($used + $delta > $limit) {
                    throw new InstanceStorageQuotaExceededException($used, $delta, $limit);
                }
            }

            return $callback();
        });
    }
}
