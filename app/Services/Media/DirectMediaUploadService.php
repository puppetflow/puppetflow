<?php

namespace App\Services\Media;

use App\Jobs\GenerateMediaVideoThumbnail;
use App\Models\MediaAsset;
use App\Models\StorageUploadReservation;
use App\Models\User;
use App\Services\Storage\InstanceStorageQuotaService;
use App\Services\Storage\UploadStorage;
use Illuminate\Filesystem\AwsS3V3Adapter;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

final class DirectMediaUploadService
{
    private const EXPIRES_MINUTES = 10;

    public function __construct(
        private readonly UploadStorage $uploads,
        private readonly InstanceStorageQuotaService $quota,
        private readonly MediaStorageService $media,
        private readonly MediaUploadTransport $transport,
    ) {}

    /**
     * @param  list<array{name: string, size: int, mime_type: string, checksum_sha256: string, checksum_md5?: string|null}>  $files
     * @return array{reservation_id: string, expires_at: string, uploads: list<array{url: string, method: string, headers: array<string, string>}>}
     */
    public function initiate(
        User $actor,
        string $workspaceId,
        MediaLocation $location,
        array $files,
    ): array {
        abort_unless($this->transport->current() === MediaUploadTransport::PRESIGNED, 409, 'Direct uploads are not available for the configured storage.');
        $disk = $this->uploads->selectedDiskName();
        $filesystem = Storage::disk($disk);
        if (! $filesystem instanceof AwsS3V3Adapter) {
            abort(409, 'Direct uploads require S3-compatible storage.');
        }
        $checksumAlgorithm = $this->transport->checksumAlgorithm();
        $expiresAt = now()->addMinutes(self::EXPIRES_MINUTES);
        $manifest = [];
        $instructions = [];
        foreach ($files as $file) {
            $logicalPath = $this->media->allocatePath($workspaceId, $file['name']);
            $target = $this->uploads->allocateDirectTarget($logicalPath);
            abort_unless($target['disk'] === $disk, 409, 'The configured storage changed during upload initialization.');
            $mimeType = trim($file['mime_type']) !== '' ? $file['mime_type'] : 'application/octet-stream';
            $checksumOptions = $checksumAlgorithm === MediaUploadTransport::CHECKSUM_MD5
                ? ['ContentMD5' => base64_encode(hex2bin((string) ($file['checksum_md5'] ?? '')) ?: '')]
                : ['ChecksumSHA256' => base64_encode(hex2bin($file['checksum_sha256']) ?: '')];
            $signed = $filesystem->temporaryUploadUrl(
                $target['storage_path'],
                $expiresAt,
                [
                    'ContentType' => $mimeType,
                    ...$checksumOptions,
                ],
            );
            $manifest[] = [
                'name' => $file['name'],
                'size' => $file['size'],
                'mime_type' => $mimeType,
                'checksum_sha256' => strtolower($file['checksum_sha256']),
                'checksum_md5' => $checksumAlgorithm === MediaUploadTransport::CHECKSUM_MD5 && is_string($file['checksum_md5'] ?? null)
                    ? strtolower($file['checksum_md5'])
                    : null,
                'path' => $logicalPath,
                'storage_path' => $target['storage_path'],
            ];
            $browserHeaders = $this->browserHeaders($signed['headers']);
            $browserHeaders['Content-Type'] = $mimeType;
            $instructions[] = [
                'url' => $signed['url'],
                'method' => 'PUT',
                'headers' => $browserHeaders,
            ];
        }
        $expectedBytes = array_sum(array_column($manifest, 'size'));
        $reservation = $this->quota->admit($expectedBytes, fn () => StorageUploadReservation::query()->create([
            'workspace_id' => $workspaceId,
            'user_id' => $actor->id,
            'disk' => $disk,
            'status' => StorageUploadReservation::STATUS_PENDING,
            'expected_bytes' => $expectedBytes,
            'payload' => [
                'location' => [
                    'user_id' => $location->userId,
                    'visibility' => $location->visibility,
                    'team_id' => $location->teamId,
                    'folder_id' => $location->folderId,
                ],
                'files' => $manifest,
            ],
            'expires_at' => $expiresAt,
        ]));

        return [
            'reservation_id' => $reservation->id,
            'expires_at' => $expiresAt->toIso8601String(),
            'uploads' => $instructions,
        ];
    }

    /** @return Collection<int, MediaAsset> */
    public function complete(StorageUploadReservation $reservation, User $actor): Collection
    {
        abort_unless($reservation->user_id === $actor->id, 404);

        $reservation->refresh();
        if ($reservation->status === StorageUploadReservation::STATUS_COMPLETED) {
            return $this->completedAssets($reservation);
        }
        abort_unless($reservation->status === StorageUploadReservation::STATUS_PENDING, 409, 'This upload can no longer be completed.');
        abort_if($reservation->expires_at->isPast(), 410, 'This upload expired before it was completed.');
        $payload = $reservation->payload;
        $files = $this->manifest($payload);
        foreach ($files as $file) {
            $this->verifyObject($reservation->disk, $file);
        }
        /** @var array{Collection<int, MediaAsset>, bool} $completion */
        $completion = DB::transaction(function () use ($reservation, $payload, $files): array {
            $locked = StorageUploadReservation::query()->lockForUpdate()->findOrFail($reservation->id);
            if ($locked->status === StorageUploadReservation::STATUS_COMPLETED) {
                return [$this->completedAssets($locked), false];
            }
            abort_unless($locked->status === StorageUploadReservation::STATUS_PENDING, 409, 'This upload can no longer be completed.');
            $locationData = is_array($payload['location'] ?? null) ? $payload['location'] : [];
            $userId = $locationData['user_id'] ?? null;
            $visibility = $locationData['visibility'] ?? null;
            abort_unless(is_string($userId) && is_string($visibility), 422, 'The upload placement is invalid.');
            $location = new MediaLocation(
                $userId,
                $visibility,
                is_string($locationData['team_id'] ?? null) ? $locationData['team_id'] : null,
                is_string($locationData['folder_id'] ?? null) ? $locationData['folder_id'] : null,
            );
            $assets = collect();
            foreach ($files as $file) {
                /** @var array{name: string, size: int, mime_type: string, checksum_sha256: string, checksum_md5: string|null, path: string, storage_path: string} $file */
                $upload = $this->uploads->registerVerifiedObject(
                    $file['path'],
                    $locked->disk,
                    $file['storage_path'],
                    $file['size'],
                    $file['mime_type'],
                    $file['checksum_sha256'],
                );
                $assets->push($this->media->createAsset(
                    $upload,
                    $locked->workspace_id,
                    $location,
                    $file['name'],
                ));
            }
            $locked->update([
                'status' => StorageUploadReservation::STATUS_COMPLETED,
                'payload' => [...$payload, 'media_ids' => $assets->pluck('id')->all()],
            ]);

            return [$assets, true];
        }, 3);
        [$assets, $completedNow] = $completion;
        if ($completedNow) {
            foreach ($assets as $index => $asset) {
                if (! str_starts_with($files[$index]['mime_type'] ?? '', 'video/')) {
                    continue;
                }
                try {
                    GenerateMediaVideoThumbnail::dispatch($asset->id);
                } catch (\Throwable $exception) {
                    report($exception);
                }
            }
        }

        return $assets;
    }

    public function cancel(StorageUploadReservation $reservation, User $actor): void
    {
        abort_unless($reservation->user_id === $actor->id, 404);
        StorageUploadReservation::query()
            ->whereKey($reservation->id)
            ->where('status', StorageUploadReservation::STATUS_PENDING)
            ->update(['status' => StorageUploadReservation::STATUS_CANCELLED]);
    }

    public function cleanupExpired(int $limit = 100): int
    {
        $reservations = StorageUploadReservation::query()
            ->where('expires_at', '<=', now()->subMinutes(5))
            ->orderBy('expires_at')
            ->limit($limit)
            ->get();
        $deletedCount = DB::transaction(function () use ($reservations): int {
            $locked = StorageUploadReservation::query()
                ->whereKey($reservations->modelKeys())
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $locations = [];
            foreach ($locked as $reservation) {
                if ($reservation->status !== StorageUploadReservation::STATUS_COMPLETED) {
                    $files = $reservation->payload['files'] ?? [];
                    if (is_array($files)) {
                        foreach ($files as $file) {
                            if (is_array($file) && is_string($file['storage_path'] ?? null)) {
                                $locations[] = [
                                    'disk' => $reservation->disk,
                                    'storage_path' => $file['storage_path'],
                                ];
                            }
                        }
                    }
                }
            }
            $this->uploads->queuePhysicalDeletions($locations);
            StorageUploadReservation::query()->whereKey($locked->modelKeys())->delete();

            return $locked->count();
        }, 3);

        return $deletedCount;
    }

    /** @param array<string, mixed> $headers
     * @return array<string, string>
     */
    private function browserHeaders(array $headers): array
    {
        $result = [];
        foreach ($headers as $name => $value) {
            if (in_array(strtolower($name), ['host', 'content-length'], true)) {
                continue;
            }
            if (is_array($value)) {
                $result[$name] = implode(', ', array_filter($value, 'is_string'));
            } elseif (is_scalar($value)) {
                $result[$name] = (string) $value;
            }
        }

        return $result;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return list<array{name: string, size: int, mime_type: string, checksum_sha256: string, checksum_md5: string|null, path: string, storage_path: string}>
     */
    private function manifest(array $payload): array
    {
        $rawFiles = $payload['files'] ?? null;
        abort_unless(is_array($rawFiles), 422, 'The upload manifest is invalid.');
        $files = [];
        foreach ($rawFiles as $file) {
            abort_unless(is_array($file), 422, 'The upload manifest is invalid.');
            $name = $file['name'] ?? null;
            $size = $file['size'] ?? null;
            $mimeType = $file['mime_type'] ?? null;
            $checksum = $file['checksum_sha256'] ?? null;
            $checksumMd5 = $file['checksum_md5'] ?? null;
            $path = $file['path'] ?? null;
            $storagePath = $file['storage_path'] ?? null;
            abort_unless(
                is_string($name)
                && is_int($size)
                && is_string($mimeType)
                && is_string($checksum)
                && is_string($path)
                && is_string($storagePath),
                422,
                'The upload manifest is invalid.',
            );
            $files[] = compact('name', 'size') + [
                'mime_type' => $mimeType,
                'checksum_sha256' => $checksum,
                'checksum_md5' => is_string($checksumMd5) ? $checksumMd5 : null,
                'path' => $path,
                'storage_path' => $storagePath,
            ];
        }

        return $files;
    }

    /** @param array{name: string, size: int, mime_type: string, checksum_sha256: string, checksum_md5: string|null, path: string, storage_path: string} $file */
    private function verifyObject(string $disk, array $file): void
    {
        $filesystem = Storage::disk($disk);
        if (! $filesystem instanceof AwsS3V3Adapter) {
            abort(409, 'Direct upload verification requires S3-compatible storage.');
        }
        $config = config("filesystems.disks.{$disk}");
        abort_unless(is_array($config) && is_string($config['bucket'] ?? null), 500, 'The cloud storage bucket is not configured.');
        $root = trim(is_string($config['root'] ?? null) ? $config['root'] : '', '/');
        $storagePath = $file['storage_path'];
        $key = $root === '' ? $storagePath : $root.'/'.$storagePath;
        $headOptions = [
            'Bucket' => $config['bucket'],
            'Key' => $key,
        ];
        if ($file['checksum_md5'] === null) {
            $headOptions['ChecksumMode'] = 'ENABLED';
        }
        $head = $filesystem->getClient()->headObject($headOptions);
        $actualSize = $head->get('ContentLength');
        $actualMime = $head->get('ContentType');
        abort_unless(is_numeric($actualSize) && (int) $actualSize === $file['size'], 422, 'The uploaded file size does not match the reservation.');
        abort_unless(is_string($actualMime) && $actualMime === $file['mime_type'], 422, 'The uploaded file type does not match the reservation.');
        if ($file['checksum_md5'] !== null) {
            $actualMd5 = $head->get('ETag');
            abort_unless(
                is_string($actualMd5)
                && hash_equals($file['checksum_md5'], strtolower(trim($actualMd5, '"'))),
                422,
                'The uploaded file checksum is invalid.',
            );

            return;
        }
        $actualChecksum = $head->get('ChecksumSHA256');
        $expectedChecksum = base64_encode(hex2bin($file['checksum_sha256']) ?: '');
        abort_unless(is_string($actualChecksum) && hash_equals($expectedChecksum, $actualChecksum), 422, 'The uploaded file checksum is invalid.');
    }

    /** @return Collection<int, MediaAsset> */
    private function completedAssets(StorageUploadReservation $reservation): Collection
    {
        $rawIds = $reservation->payload['media_ids'] ?? [];
        if (! is_array($rawIds)) {
            return collect();
        }
        $ids = array_values(array_filter($rawIds, fn ($id): bool => is_int($id) || is_string($id)));
        $assets = MediaAsset::query()->whereIn('id', $ids)->get()->keyBy('id');

        return collect($ids)->map(fn ($id) => $assets->get($id))->filter()->values();
    }
}
