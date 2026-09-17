<?php

namespace App\Services\Media;

use App\Enums\Authorization\Ability;
use App\Jobs\GenerateMediaVideoThumbnail;
use App\Models\MediaAsset;
use App\Models\MediaFolder;
use App\Models\StoredUpload;
use App\Models\User;
use App\Models\Workspace;
use App\Services\Storage\UploadStorage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class MediaStorageService
{
    private const EDITABLE_TEXT_EXTENSIONS = [
        'bash', 'c', 'cc', 'cfg', 'cjs', 'conf', 'cpp', 'cs', 'css', 'csv',
        'env', 'fish', 'go', 'gql', 'graphql', 'h', 'hpp', 'htm', 'html', 'ini',
        'java', 'js', 'json', 'jsonl', 'jsx', 'less', 'log', 'markdown', 'md',
        'mjs', 'ndjson', 'php', 'properties', 'py', 'rb', 'rs', 'sass', 'scss',
        'sh', 'sql', 'svg', 'toml', 'ts', 'tsv', 'tsx', 'txt', 'xml', 'yaml',
        'yml', 'zsh',
    ];

    private const EDITABLE_TEXT_MIME_TYPES = [
        'application/ecmascript',
        'application/javascript',
        'application/json',
        'application/sql',
        'application/toml',
        'application/x-httpd-php',
        'application/x-sh',
        'application/x-yaml',
        'application/xml',
        'application/yaml',
        'image/svg+xml',
    ];

    public function __construct(private readonly UploadStorage $uploads) {}

    /**
     * Stores a batch of files in one location; every asset is rolled back when one upload fails.
     *
     * @param  iterable<UploadedFile>  $files
     * @return Collection<int, MediaAsset>
     */
    public function storeMany(iterable $files, string $workspaceId, MediaLocation $location): Collection
    {
        /** @var Collection<int, MediaAsset> $created */
        $created = collect();
        try {
            foreach ($files as $file) {
                $created->push($this->store($file, $workspaceId, $location));
            }
        } catch (\Throwable $exception) {
            DB::transaction(fn () => $created->each->delete(), 3);
            throw $exception;
        }

        return $created;
    }

    /**
     * Deletes assets and folders of a workspace the actor may delete; 404 when an id is unknown.
     *
     * @param  list<string>  $assetIds
     * @param  list<string>  $folderIds
     * @return int Number of deleted items.
     */
    public function deleteBatch(User $actor, string $workspaceId, array $assetIds, array $folderIds): int
    {
        $assets = MediaAsset::query()->where('workspace_id', $workspaceId)->whereIn('id', $assetIds)->get();
        $folders = MediaFolder::query()->where('workspace_id', $workspaceId)->whereIn('id', $folderIds)->get();
        abort_unless($assets->count() === count($assetIds) && $folders->count() === count($folderIds), 404);
        $gate = Gate::forUser($actor);
        $assets->each(fn (MediaAsset $asset) => $gate->authorize(Ability::DELETE->value, $asset));
        $folders->each(fn (MediaFolder $folder) => $gate->authorize(Ability::DELETE->value, $folder));
        DB::transaction(function () use ($assets, $folders): void {
            $assets->each->delete();
            $folders->each->delete();
        }, 3);

        return $assets->count() + $folders->count();
    }

    public function store(UploadedFile $file, string $workspaceId, MediaLocation $location): MediaAsset
    {
        $path = $this->allocatePath($workspaceId, $file->getClientOriginalName());
        $path = $this->uploads->store(
            $file,
            dirname($path),
            basename($path),
        );

        try {
            $upload = $this->uploads->find($path);
            if (! $upload instanceof StoredUpload) {
                throw new \RuntimeException('Stored media upload could not be resolved.');
            }

            $asset = $this->createAsset(
                $upload,
                $workspaceId,
                $location,
                $file->getClientOriginalName(),
            );
        } catch (\Throwable $exception) {
            $this->uploads->delete($path);
            throw $exception;
        }
        if (str_starts_with((string) $upload->mime_type, 'video/')) {
            GenerateMediaVideoThumbnail::dispatch($asset->id);
        }

        return $asset;
    }

    public function allocatePath(string $workspaceId, string $filename): string
    {
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if ($extension === '' || preg_match('/^[a-z0-9]{1,12}$/', $extension) !== 1) {
            $extension = 'bin';
        }

        return Workspace::splitIdPath($workspaceId).'/media/'.Str::random(40).'.'.$extension;
    }

    public function createAsset(
        StoredUpload $upload,
        string $workspaceId,
        MediaLocation $location,
        string $originalFilename,
    ): MediaAsset {
        $originalName = $this->safeFilename($originalFilename);

        return MediaAsset::create([
            'workspace_id' => $workspaceId,
            ...$location->assignment(),
            'folder_id' => $location->folderId,
            'stored_upload_id' => $upload->id,
            'name' => pathinfo($originalName, PATHINFO_FILENAME) ?: $originalName,
            'original_filename' => $originalName,
        ]);
    }

    public function textContent(MediaAsset $asset): string
    {
        $upload = $asset->storedUpload()->firstOrFail();
        if (! $this->isEditableTextFile($upload->mime_type, $asset->original_filename)) {
            throw ValidationException::withMessages([
                'content' => 'Only UTF-8 text media files can be edited.',
            ]);
        }

        $contents = $this->uploads->contents($upload->path);
        if (! is_string($contents) || ! mb_check_encoding($contents, 'UTF-8')) {
            throw ValidationException::withMessages([
                'content' => 'This text file is not valid UTF-8 and cannot be edited.',
            ]);
        }

        return $contents;
    }

    public function replaceTextContent(MediaAsset $asset, string $contents): void
    {
        $upload = $asset->storedUpload()->firstOrFail();
        if (! $this->isEditableTextFile($upload->mime_type, $asset->original_filename)) {
            throw ValidationException::withMessages([
                'content' => 'Only UTF-8 text media files can be edited.',
            ]);
        }
        if (! mb_check_encoding($contents, 'UTF-8')) {
            throw ValidationException::withMessages([
                'content' => 'Text media content must be valid UTF-8.',
            ]);
        }

        $maxBytes = config()->integer('puppetflow.media.max_upload_bytes');
        if (strlen($contents) > $maxBytes) {
            throw ValidationException::withMessages([
                'content' => 'Text media content may not exceed '.(int) ceil($maxBytes / 1024 / 1024).' MB.',
            ]);
        }

        $this->uploads->put(
            $contents,
            dirname($upload->path),
            basename($upload->path),
            $upload->mime_type,
        );
        $asset->touch();
    }

    private function isEditableTextFile(mixed $mimeType, string $filename): bool
    {
        $normalized = is_string($mimeType)
            ? strtolower(trim(explode(';', $mimeType, 2)[0]))
            : '';
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        return str_starts_with($normalized, 'text/')
            || in_array($normalized, self::EDITABLE_TEXT_MIME_TYPES, true)
            || str_ends_with($normalized, '+json')
            || str_ends_with($normalized, '+xml')
            || in_array($extension, self::EDITABLE_TEXT_EXTENSIONS, true);
    }

    /** Streams the binary of an asset, inline (preview) or as an attachment (download). */
    public function stream(MediaAsset $asset, bool $inline = false): StreamedResponse
    {
        $upload = $asset->storedUpload()->firstOrFail();

        return $this->streamUpload($upload, $asset->original_filename, $inline);
    }

    public function streamThumbnail(MediaAsset $asset): StreamedResponse
    {
        $upload = $asset->thumbnailStoredUpload()->firstOrFail();

        return $this->streamUpload($upload, $asset->id.'-thumbnail.jpg', true);
    }

    private function streamUpload(StoredUpload $upload, string $filename, bool $inline): StreamedResponse
    {
        $stream = $this->uploads->readStream($upload->path);
        abort_unless(is_resource($stream), 404);
        $mime = is_string($upload->mime_type) && $upload->mime_type !== ''
            ? $upload->mime_type
            : 'application/octet-stream';

        return response()->stream(function () use ($stream): void {
            try {
                fpassthru($stream);
            } finally {
                fclose($stream);
            }
        }, 200, [
            'Content-Type' => $mime,
            'Content-Length' => (string) $upload->size_bytes,
            'Content-Disposition' => HeaderUtils::makeDisposition(
                $inline ? HeaderUtils::DISPOSITION_INLINE : HeaderUtils::DISPOSITION_ATTACHMENT,
                $filename,
                'media',
            ),
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; sandbox",
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function safeFilename(string $filename): string
    {
        $filename = preg_replace('/[\x00-\x1F\x7F]/u', '', $filename) ?? '';
        $filename = trim(str_replace(['/', '\\'], '', $filename));

        return $filename !== '' ? mb_substr($filename, 0, 255) : 'media';
    }
}
