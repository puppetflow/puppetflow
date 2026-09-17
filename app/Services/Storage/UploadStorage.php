<?php

namespace App\Services\Storage;

use App\Jobs\DeleteStoredFiles;
use App\Models\StorageDeletion;
use App\Models\StoredUpload;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class UploadStorage
{
    /** @var array<string, string> */
    private const RASTER_EXTENSIONS = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
    ];

    public function __construct(
        private readonly InstanceStorageQuotaService $quota,
    ) {}

    public function storeRasterImage(UploadedFile $file, string $directory): string
    {
        $mimeType = $file->getMimeType();
        $extension = is_string($mimeType) ? self::RASTER_EXTENSIONS[$mimeType] ?? null : null;

        if ($extension === null) {
            throw new \InvalidArgumentException('Uploaded image must be JPEG, PNG, GIF, or WebP.');
        }

        return $this->store($file, $directory, bin2hex(random_bytes(20)).'.'.$extension);
    }

    public function store(UploadedFile $file, string $directory, string $filename): string
    {
        $directory = $this->normalizePath($directory);
        $filename = $this->normalizeFilename($filename);
        $path = $directory.'/'.$filename;
        $diskName = $this->selectedDiskName();
        $storagePath = $this->versionedStoragePath($path);
        $sourcePath = $file->getRealPath();
        $sourceSize = filesize($sourcePath);
        $sourceChecksum = hash_file('sha256', $sourcePath);
        $stream = fopen($sourcePath, 'rb');
        if (! is_int($sourceSize) || ! is_string($sourceChecksum)) {
            throw new \RuntimeException('Unable to inspect uploaded file.');
        }
        if (! is_resource($stream)) {
            throw new \RuntimeException('Unable to open uploaded file.');
        }

        try {
            $this->writeAndPersist(
                $path,
                $diskName,
                $storagePath,
                fn (FilesystemAdapter $disk) => $disk->put(
                    $storagePath,
                    $stream,
                    ['mimetype' => $file->getMimeType()],
                ),
                $file->getMimeType(),
                $sourceSize,
                $sourceChecksum,
            );
        } finally {
            fclose($stream);
        }

        return $path;
    }

    public function put(
        string $contents,
        string $directory,
        string $filename,
        ?string $mimeType = null,
    ): string {
        $directory = $this->normalizePath($directory);
        $filename = $this->normalizeFilename($filename);
        $path = $directory.'/'.$filename;
        $diskName = $this->selectedDiskName();
        $storagePath = $this->versionedStoragePath($path);
        $options = $mimeType === null ? [] : ['mimetype' => $mimeType];

        $contentSize = strlen($contents);
        $this->writeAndPersist(
            $path,
            $diskName,
            $storagePath,
            fn (FilesystemAdapter $disk) => $disk->put($storagePath, $contents, $options),
            $mimeType,
            $contentSize,
            hash('sha256', $contents),
        );

        return $path;
    }

    /** @return array{disk: string, storage_path: string} */
    public function allocateDirectTarget(string $path): array
    {
        $path = $this->normalizePath($path);

        return [
            'disk' => $this->selectedDiskName(),
            'storage_path' => $this->versionedStoragePath($path),
        ];
    }

    public function registerVerifiedObject(
        string $path,
        string $disk,
        string $storagePath,
        int $sizeBytes,
        ?string $mimeType,
        string $checksumSha256,
    ): StoredUpload {
        $path = $this->normalizePath($path);
        [$upload, $ids] = $this->persistMetadata($path, $disk, $storagePath, [
            'size_bytes' => $sizeBytes,
            'mime_type' => $mimeType,
            'checksum_sha256' => $checksumSha256,
        ]);
        $this->dispatchDeletions($ids);

        return $upload;
    }

    /** @param list<array{disk: string, storage_path: string}> $locations */
    public function queuePhysicalDeletions(array $locations): void
    {
        if ($locations === []) {
            return;
        }
        $ids = DB::transaction(function () use ($locations): array {
            return array_map(
                fn (array $location): int => $this->stageDeletion(
                    $location['disk'],
                    $location['storage_path'],
                ),
                $locations,
            );
        });
        DB::afterCommit(fn () => $this->dispatchDeletions($ids));
    }

    public function contents(string $path): ?string
    {
        $upload = $this->find($path);
        if ($upload === null) {
            return null;
        }

        $contents = $this->disk($upload->disk)->get($upload->storage_path);

        return is_string($contents) ? $contents : null;
    }

    /** @return resource|null */
    public function readStream(string $path)
    {
        $upload = $this->find($path);
        if ($upload === null) {
            return null;
        }

        $stream = $this->disk($upload->disk)->readStream($upload->storage_path);

        return is_resource($stream) ? $stream : null;
    }

    public function exists(string $path): bool
    {
        $upload = $this->find($path);

        return $upload !== null && $this->disk($upload->disk)->exists($upload->storage_path);
    }

    public function delete(string $path): void
    {
        $path = $this->normalizePath($path);
        $upload = StoredUpload::query()->where('path', $path)->first();
        if ($upload === null) {
            return;
        }

        $ids = DB::transaction(function () use ($upload): array {
            $id = $this->stageDeletion($upload->disk, $upload->storage_path);
            $upload->delete();

            return [$id];
        });
        $this->dispatchDeletions($ids);
    }

    public function deleteDirectory(string $path): void
    {
        $path = $this->normalizePath($path);
        $uploads = StoredUpload::query()
            ->where(fn ($query) => $query->where('path', $path)->orWhere('path', 'like', $path.'/%'))
            ->get();
        if ($uploads->isEmpty()) {
            return;
        }

        $ids = DB::transaction(function () use ($uploads): array {
            $ids = [];
            foreach ($uploads as $upload) {
                $ids[] = $this->stageDeletion($upload->disk, $upload->storage_path);
                $upload->delete();
            }

            return $ids;
        });
        $this->dispatchDeletions($ids);
    }

    public function copy(string $source, string $destination): void
    {
        $source = $this->find($source);
        if ($source === null) {
            throw new \RuntimeException('Uploaded source file is not indexed.');
        }
        $destination = $this->normalizePath($destination);
        $targetDiskName = $this->selectedDiskName();
        $targetPath = $this->versionedStoragePath($destination);
        $stream = $this->disk($source->disk)->readStream($source->storage_path);
        if (! is_resource($stream)) {
            throw new \RuntimeException('Unable to read uploaded source file.');
        }
        try {
            $this->writeAndPersist(
                $destination,
                $targetDiskName,
                $targetPath,
                fn (FilesystemAdapter $disk) => $disk->put($targetPath, $stream),
                $source->mime_type,
                $source->size_bytes,
                $source->checksum_sha256,
            );
        } finally {
            fclose($stream);
        }
    }

    public function url(string $path, ?int $version = null): string
    {
        $url = '/uploads/'.$this->normalizePath($path);

        return $version === null ? $url : $url.'?v='.$version;
    }

    public function find(string $path): ?StoredUpload
    {
        try {
            $path = $this->normalizePath($path);
        } catch (\InvalidArgumentException) {
            return null;
        }

        return StoredUpload::query()
            ->where('path', $path)
            ->where('status', StoredUpload::STATUS_READY)
            ->first();
    }

    public function indexLocal(string $path, string $diskName = 'puppetflow-local'): ?StoredUpload
    {
        $path = $this->normalizePath($path);
        $storagePath = $this->storagePath($path);
        $disk = $this->disk($diskName);
        if (! $disk->exists($storagePath)) {
            return null;
        }

        return $this->persistVerified($path, $diskName, $storagePath);
    }

    public function localSourceExists(string $path): bool
    {
        $path = $this->normalizePath($path);

        return $this->disk('puppetflow-local')->exists($this->storagePath($path));
    }

    public function migrate(StoredUpload $upload, string $targetDiskName, bool $deleteSource = true): void
    {
        if ($upload->disk === $targetDiskName) {
            return;
        }

        Cache::lock(
            StorageLocationLock::name($targetDiskName, $upload->storage_path),
            300,
        )->block(
            30,
            fn () => $this->migrateLocked($upload, $targetDiskName, $deleteSource),
        );
    }

    private function migrateLocked(
        StoredUpload $upload,
        string $targetDiskName,
        bool $deleteSource,
    ): void {
        $sourceDisk = $this->disk($upload->disk);
        $targetDisk = $this->disk($targetDiskName);
        $stream = $sourceDisk->readStream($upload->storage_path);
        if (! is_resource($stream)) {
            throw new \RuntimeException("Unable to read upload {$upload->path}.");
        }
        try {
            $targetDisk->put($upload->storage_path, $stream);
        } finally {
            fclose($stream);
        }
        $metadata = $this->verifiedMetadata($targetDisk, $upload->storage_path);
        if (
            $metadata['size_bytes'] !== $upload->size_bytes
            || ! hash_equals($upload->checksum_sha256, $metadata['checksum_sha256'])
        ) {
            $targetDisk->delete($upload->storage_path);
            throw new \RuntimeException("Upload {$upload->path} failed target storage verification.");
        }

        $sourceDiskName = $upload->disk;
        $ids = DB::transaction(function () use ($upload, $targetDiskName, $sourceDiskName, $deleteSource): array {
            $upload->update(['disk' => $targetDiskName]);

            return $deleteSource ? [$this->stageDeletion($sourceDiskName, $upload->storage_path)] : [];
        });
        $this->dispatchDeletions($ids);
    }

    public function normalizePath(string $path): string
    {
        if ($path === '' || str_contains($path, "\0") || str_starts_with($path, '/') || str_contains($path, '\\')) {
            throw new \InvalidArgumentException('Upload path must be a non-empty relative path.');
        }

        $segments = explode('/', $path);
        foreach ($segments as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..') {
                throw new \InvalidArgumentException('Upload path contains an invalid segment.');
            }
        }

        return implode('/', $segments);
    }

    private function normalizeFilename(string $filename): string
    {
        if ($filename === '' || basename($filename) !== $filename || in_array($filename, ['.', '..'], true)) {
            throw new \InvalidArgumentException('Upload filename is invalid.');
        }

        return $filename;
    }

    public function selectedDiskName(): string
    {
        $disk = config('filesystems.app_storage_disk', 'puppetflow-local');

        if (! is_string($disk) || $disk === '') {
            throw new \UnexpectedValueException('Application storage disk must be a non-empty string.');
        }

        return $disk;
    }

    private function disk(string $disk): FilesystemAdapter
    {
        /** @var FilesystemAdapter $filesystem */
        $filesystem = Storage::disk($disk);

        return $filesystem;
    }

    private function storagePath(string $path): string
    {
        return 'uploads/'.$this->normalizePath($path);
    }

    private function versionedStoragePath(string $path): string
    {
        $storagePath = $this->storagePath($path);

        return dirname($storagePath).'/.versions/'.bin2hex(random_bytes(20)).'-'.basename($storagePath);
    }

    /** @param \Closure(FilesystemAdapter): mixed $write */
    private function writeAndPersist(
        string $path,
        string $diskName,
        string $storagePath,
        \Closure $write,
        ?string $mimeType,
        int $expectedSize,
        string $expectedChecksum,
    ): void {
        $disk = $this->disk($diskName);
        try {
            $write($disk);
            $this->persistVerified(
                $path,
                $diskName,
                $storagePath,
                $mimeType,
                $expectedSize,
                $expectedChecksum,
            );
        } catch (\Throwable $exception) {
            $disk->delete($storagePath);
            throw $exception;
        }
    }

    private function persistVerified(
        string $path,
        string $diskName,
        string $storagePath,
        ?string $verifiedMimeType = null,
        ?int $expectedSize = null,
        ?string $expectedChecksum = null,
    ): StoredUpload {
        $disk = $this->disk($diskName);
        $previous = StoredUpload::query()->where('path', $path)->first();

        try {
            $metadata = $this->verifiedMetadata($disk, $storagePath);
            if (
                ($expectedSize !== null && $metadata['size_bytes'] !== $expectedSize)
                || (
                    $expectedChecksum !== null
                    && ! hash_equals($expectedChecksum, $metadata['checksum_sha256'])
                )
            ) {
                throw new \RuntimeException('Uploaded file failed durable storage verification.');
            }
            if ($verifiedMimeType !== null) {
                $metadata['mime_type'] = $verifiedMimeType;
            }
            [$upload, $ids] = $this->quota->admit(
                fn (): int => $metadata['size_bytes'] - $this->readySize($path),
                fn (): array => $this->persistMetadata($path, $diskName, $storagePath, $metadata),
            );
        } catch (\Throwable $exception) {
            if (
                $previous === null
                || $previous->disk !== $diskName
                || $previous->storage_path !== $storagePath
            ) {
                $disk->delete($storagePath);
            }
            throw $exception;
        }

        $this->dispatchDeletions($ids);

        return $upload;
    }

    /**
     * @param  array{size_bytes: int, mime_type: string|null, checksum_sha256: string}  $metadata
     * @return array{StoredUpload, list<int>}
     */
    private function persistMetadata(
        string $path,
        string $diskName,
        string $storagePath,
        array $metadata,
    ): array {
        return DB::transaction(function () use ($path, $diskName, $storagePath, $metadata): array {
            $current = StoredUpload::query()->where('path', $path)->lockForUpdate()->first();
            $previousDisk = $current?->disk;
            $previousStoragePath = $current?->storage_path;
            $attributes = [
                'storage_path' => $storagePath,
                'disk' => $diskName,
                ...$metadata,
                'status' => StoredUpload::STATUS_READY,
            ];
            if ($current === null) {
                $current = StoredUpload::query()->create(['path' => $path, ...$attributes]);
            } else {
                $current->update($attributes);
            }
            $ids = [];
            if (
                $previousDisk !== null
                && $previousStoragePath !== null
                && ($previousDisk !== $diskName || $previousStoragePath !== $storagePath)
            ) {
                $ids[] = $this->stageDeletion($previousDisk, $previousStoragePath);
            }

            return [$current, $ids];
        });
    }

    private function readySize(string $path): int
    {
        $size = StoredUpload::query()
            ->where('path', $path)
            ->where('status', StoredUpload::STATUS_READY)
            ->value('size_bytes');

        return is_numeric($size) ? (int) $size : 0;
    }

    /** @return array{size_bytes: int, mime_type: string|null, checksum_sha256: string} */
    private function verifiedMetadata(FilesystemAdapter $disk, string $storagePath): array
    {
        if (! $disk->exists($storagePath)) {
            throw new \RuntimeException('Uploaded file is missing after storage write.');
        }
        $stream = $disk->readStream($storagePath);
        if (! is_resource($stream)) {
            throw new \RuntimeException('Unable to verify uploaded file.');
        }
        try {
            $hash = hash_init('sha256');
            hash_update_stream($hash, $stream);
            $checksum = hash_final($hash);
        } finally {
            fclose($stream);
        }

        $mimeType = $disk->mimeType($storagePath);

        return [
            'size_bytes' => $disk->size($storagePath),
            'mime_type' => is_string($mimeType) ? $mimeType : null,
            'checksum_sha256' => $checksum,
        ];
    }

    private function stageDeletion(string $disk, string $storagePath): int
    {
        return (int) StorageDeletion::query()->create([
            'disk' => $disk,
            'storage_path' => $storagePath,
        ])->id;
    }

    /** @param list<int> $ids */
    private function dispatchDeletions(array $ids): void
    {
        if ($ids === []) {
            return;
        }
        try {
            DeleteStoredFiles::dispatch($ids);
        } catch (\Throwable $exception) {
            report($exception);
        }
    }
}
