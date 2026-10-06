<?php

namespace App\Services\Mcp\Tools;

use App\Authorization\AuthorizationContextFactory;
use App\Authorization\Visibility\SharedResourceVisibility;
use App\Enums\Authorization\Ability;
use App\Http\Requests\Media\StoreMediaRequest;
use App\Http\Requests\Media\UpdateMediaAssetRequest;
use App\Http\Requests\Media\UpdateMediaFolderRequest;
use App\Models\MediaAsset;
use App\Models\MediaFolder;
use App\Services\Media\MediaAssetProjector;
use App\Services\Media\MediaPlacementService;
use App\Services\Media\MediaStorageService;
use App\Services\Media\UploadStoragePreview;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * @phpstan-type Arguments array<string, mixed>
 * @phpstan-type AssetMetadata array{name?: string, description?: string|null, alt_text?: string|null, tags?: list<string>}
 * @phpstan-type ToolDefinition array{name: string, description: string, inputSchema: array<string, mixed>}
 */
final class MediaLibraryMcpTools implements McpToolHandler
{
    public const TOOL_NAMES = [
        'search_media_assets',
        'get_media_asset',
        'search_media_folders',
        'get_media_folder',
        'upload_media_asset',
        'update_media_asset',
        'update_media_folder',
    ];

    public function __construct(
        private readonly AuthorizationContextFactory $contexts,
        private readonly SharedResourceVisibility $visibility,
        private readonly MediaPlacementService $placement,
        private readonly MediaStorageService $storage,
    ) {}

    /** @return list<ToolDefinition> */
    public function definitions(): array
    {
        $assetId = ['type' => 'string', 'description' => 'Media Asset ID returned by search_media_assets.'];
        $maxUploadBytes = config()->integer('puppetflow.media.max_upload_bytes');
        $maxBase64Characters = 4 * (int) ceil($maxUploadBytes / 3);

        return [
            [
                'name' => 'search_media_assets',
                'description' => 'Search visible Media Library assets by metadata, type, folder, or scope without downloading file content.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'properties' => [
                        'query' => ['type' => 'string', 'maxLength' => 128, 'description' => 'Search name, original filename, description, alt text, tags, or ID.'],
                        'folder_id' => ['type' => ['string', 'null'], 'description' => 'Exact folder ID. Null selects root assets.'],
                        'mime_type' => ['type' => 'string', 'maxLength' => 128, 'description' => 'Exact MIME type or prefix ending in /, such as image/.'],
                        'visibility' => ['type' => 'string', 'enum' => ['owner', 'workspace', 'team']],
                        'tag' => ['type' => 'string'],
                        'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 100, 'default' => 20],
                        'offset' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 1000000, 'default' => 0],
                    ],
                ],
            ],
            [
                'name' => 'get_media_asset',
                'description' => 'Get Media Library asset metadata, file properties, authenticated route paths, and permissions without returning binary content.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['media_asset_id'],
                    'properties' => ['media_asset_id' => $assetId],
                ],
            ],
            [
                'name' => 'search_media_folders',
                'description' => 'Search visible Media Library folders with parent relationships and item counts.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'properties' => [
                        'query' => ['type' => 'string', 'maxLength' => 128, 'description' => 'Search folder name or ID.'],
                        'parent_id' => ['type' => ['string', 'null'], 'description' => 'Exact parent folder ID. Null selects root folders.'],
                        'visibility' => ['type' => 'string', 'enum' => ['owner', 'workspace', 'team']],
                        'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 200, 'default' => 100],
                    ],
                ],
            ],
            [
                'name' => 'get_media_folder',
                'description' => 'Get a visible Media Library folder with its parent relationship, item counts, scope, and permissions.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['media_folder_id'],
                    'properties' => [
                        'media_folder_id' => [
                            'type' => 'string',
                            'description' => 'Media Folder ID returned by search_media_folders.',
                        ],
                    ],
                ],
            ],
            [
                'name' => 'upload_media_asset',
                'description' => 'Upload one Media Library file from strict base64 content. The server detects its MIME type and enforces the configured media size limit.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['filename', 'content_base64'],
                    'properties' => [
                        'filename' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 255],
                        'content_base64' => [
                            'type' => 'string',
                            'maxLength' => $maxBase64Characters,
                            'description' => 'Raw base64 only. Data URLs are not accepted.',
                        ],
                        'folder_id' => ['type' => ['string', 'null']],
                        'visibility' => ['type' => 'string', 'enum' => ['owner', 'workspace', 'team']],
                        'team_id' => ['type' => ['string', 'null']],
                        'name' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 255],
                        'description' => ['type' => ['string', 'null'], 'maxLength' => 5000],
                        'alt_text' => ['type' => ['string', 'null'], 'maxLength' => 500],
                        'tags' => [
                            'type' => 'array',
                            'maxItems' => 50,
                            'items' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 100],
                        ],
                    ],
                ],
            ],
            [
                'name' => 'update_media_asset',
                'description' => 'Update Media Library asset metadata without replacing, moving, or downloading the stored file.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['media_asset_id'],
                    'anyOf' => [
                        ['required' => ['name']],
                        ['required' => ['description']],
                        ['required' => ['alt_text']],
                        ['required' => ['tags']],
                    ],
                    'properties' => [
                        'media_asset_id' => $assetId,
                        'name' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 255],
                        'description' => ['type' => ['string', 'null'], 'maxLength' => 5000],
                        'alt_text' => ['type' => ['string', 'null'], 'maxLength' => 500],
                        'tags' => [
                            'type' => 'array',
                            'maxItems' => 50,
                            'items' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 100],
                        ],
                    ],
                ],
            ],
            [
                'name' => 'update_media_folder',
                'description' => 'Rename or reorder a Media Library folder without moving it or changing its visibility or ownership.',
                'inputSchema' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['media_folder_id'],
                    'anyOf' => [
                        ['required' => ['name']],
                        ['required' => ['sort_order']],
                    ],
                    'properties' => [
                        'media_folder_id' => [
                            'type' => 'string',
                            'description' => 'Media Folder ID returned by search_media_folders.',
                        ],
                        'name' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 255],
                        'sort_order' => ['type' => 'integer', 'minimum' => 0],
                    ],
                ],
            ],
        ];
    }

    public function handles(string $name): bool
    {
        return in_array($name, self::TOOL_NAMES, true);
    }

    public function call(string $name, array $arguments, McpToolContext $context): array
    {
        return match ($name) {
            'search_media_assets' => $this->searchAssets($arguments, $context),
            'get_media_asset' => $this->getAsset($arguments, $context),
            'search_media_folders' => $this->searchFolders($arguments, $context),
            'get_media_folder' => $this->getFolder($arguments, $context),
            'upload_media_asset' => $this->uploadAsset($arguments, $context),
            'update_media_asset' => $this->updateAsset($arguments, $context),
            'update_media_folder' => $this->updateFolder($arguments, $context),
            default => throw ValidationException::withMessages(['name' => 'Unknown Media Library tool.']),
        };
    }

    /**
     * @param  Arguments  $arguments
     * @return array<string, mixed>
     */
    private function searchAssets(array $arguments, McpToolContext $context): array
    {
        $validated = validator($arguments, [
            'query' => ['sometimes', 'string', 'max:128'],
            'folder_id' => ['sometimes', 'nullable', 'string'],
            'mime_type' => ['sometimes', 'string', 'max:128'],
            'visibility' => ['sometimes', 'string', 'in:owner,workspace,team'],
            'tag' => ['sometimes', 'string', 'max:100'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'offset' => ['sometimes', 'integer', 'min:0', 'max:1000000'],
        ])->validate();
        $query = MediaAsset::query()
            ->with(['storedUpload', 'folder:id,name', 'user:id,name', 'team:id,name']);
        $this->visibility->applyView(
            $query,
            $this->contexts->for($context->user, $context->workspace->id),
            scopeColumn: 'visibility',
        );
        $search = trim((string) ($validated['query'] ?? ''));
        if ($search !== '') {
            $query->where(fn (Builder $query) => $query
                ->where('id', 'like', "%{$search}%")
                ->orWhere('name', 'like', "%{$search}%")
                ->orWhere('original_filename', 'like', "%{$search}%")
                ->orWhere('description', 'like', "%{$search}%")
                ->orWhere('alt_text', 'like', "%{$search}%")
                ->orWhereJsonContains('tags', $search));
        }
        if (array_key_exists('folder_id', $validated)) {
            is_string($validated['folder_id']) && $validated['folder_id'] !== ''
                ? $query->where('folder_id', $validated['folder_id'])
                : $query->whereNull('folder_id');
        }
        if (($mimeType = trim((string) ($validated['mime_type'] ?? ''))) !== '') {
            $query->whereHas('storedUpload', fn (Builder $upload) => str_ends_with($mimeType, '/')
                ? $upload->where('mime_type', 'like', $mimeType.'%')
                : $upload->where('mime_type', $mimeType));
        }
        if (isset($validated['visibility'])) {
            $query->where('visibility', $validated['visibility']);
        }
        if (($tag = trim((string) ($validated['tag'] ?? ''))) !== '') {
            $query->whereJsonContains('tags', $tag);
        }
        $limit = (int) ($validated['limit'] ?? 20);
        $offset = (int) ($validated['offset'] ?? 0);
        $assets = $query
            ->orderByDesc('updated_at')
            ->orderBy('id')
            ->offset($offset)
            ->limit($limit + 1)
            ->get()
            ->filter(fn (MediaAsset $asset): bool => Gate::forUser($context->user)
                ->allows(Ability::VIEW->value, $asset))
            ->values();
        $hasMore = $assets->count() > $limit;
        if ($hasMore) {
            $assets->pop();
        }

        return [
            'media_assets' => $assets
                ->map(fn (MediaAsset $asset): array => $this->serializeAsset($asset, $context))
                ->values()
                ->all(),
            'limit' => $limit,
            'offset' => $offset,
            'has_more' => $hasMore,
        ];
    }

    /**
     * @param  Arguments  $arguments
     * @return array<string, mixed>
     */
    private function getAsset(array $arguments, McpToolContext $context): array
    {
        $asset = $this->asset(
            McpToolArguments::string($arguments, 'media_asset_id'),
            $context,
            Ability::VIEW,
        );

        return ['media_asset' => $this->serializeAsset($asset, $context)];
    }

    /**
     * @param  Arguments  $arguments
     * @return array<string, mixed>
     */
    private function searchFolders(array $arguments, McpToolContext $context): array
    {
        $validated = validator($arguments, [
            'query' => ['sometimes', 'string', 'max:128'],
            'parent_id' => ['sometimes', 'nullable', 'string'],
            'visibility' => ['sometimes', 'string', 'in:owner,workspace,team'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:200'],
        ])->validate();
        $query = MediaFolder::query()
            ->with(['parent:id,name', 'user:id,name', 'team:id,name'])
            ->withCount(['assets', 'children']);
        $this->visibility->applyView(
            $query,
            $this->contexts->for($context->user, $context->workspace->id),
            scopeColumn: 'visibility',
        );
        if (($search = trim((string) ($validated['query'] ?? ''))) !== '') {
            $query->where(fn (Builder $query) => $query
                ->where('id', 'like', "%{$search}%")
                ->orWhere('name', 'like', "%{$search}%"));
        }
        if (array_key_exists('parent_id', $validated)) {
            is_string($validated['parent_id']) && $validated['parent_id'] !== ''
                ? $query->where('parent_id', $validated['parent_id'])
                : $query->whereNull('parent_id');
        }
        if (isset($validated['visibility'])) {
            $query->where('visibility', $validated['visibility']);
        }

        return ['media_folders' => $query
            ->orderBy('sort_order')
            ->orderBy('name')
            ->limit((int) ($validated['limit'] ?? 100))
            ->get()
            ->filter(fn (MediaFolder $folder): bool => Gate::forUser($context->user)
                ->allows(Ability::VIEW->value, $folder))
            ->map(fn (MediaFolder $folder): array => $this->serializeFolder($folder, $context))
            ->values()
            ->all()];
    }

    /**
     * @param  Arguments  $arguments
     * @return array<string, mixed>
     */
    private function getFolder(array $arguments, McpToolContext $context): array
    {
        $folder = $this->folder(
            McpToolArguments::string($arguments, 'media_folder_id'),
            $context,
            Ability::VIEW,
        );

        return ['media_folder' => $this->serializeFolder($folder, $context)];
    }

    /**
     * @param  Arguments  $arguments
     * @return array<string, mixed>
     */
    private function uploadAsset(array $arguments, McpToolContext $context): array
    {
        if (Gate::forUser($context->user)->denies(Ability::CREATE->value, MediaAsset::class)) {
            throw ValidationException::withMessages([
                'media_asset' => 'Media upload is not allowed for this user.',
            ]);
        }
        $maxUploadBytes = config()->integer('puppetflow.media.max_upload_bytes');
        $maxBase64Characters = 4 * (int) ceil($maxUploadBytes / 3);
        $placementRules = array_intersect_key(
            StoreMediaRequest::rulesFor($context->workspace->id),
            array_flip(['visibility', 'team_id', 'folder_id']),
        );
        $metadataRules = array_intersect_key(
            UpdateMediaAssetRequest::rulesFor($context->workspace->id),
            array_flip(['name', 'description', 'alt_text', 'tags', 'tags.*']),
        );
        $validated = validator($arguments, [
            'filename' => ['required', 'string', 'max:255'],
            'content_base64' => ['present', 'string', "max:{$maxBase64Characters}"],
            ...$placementRules,
            ...$metadataRules,
        ])->validate();
        $encoded = $validated['content_base64'];
        if (! is_string($encoded) || str_starts_with($encoded, 'data:')) {
            throw ValidationException::withMessages([
                'content_base64' => 'Provide raw base64 content without a data URL prefix.',
            ]);
        }
        $contents = base64_decode($encoded, true);
        if (! is_string($contents)) {
            throw ValidationException::withMessages([
                'content_base64' => 'The media content is not valid base64.',
            ]);
        }
        if (strlen($contents) > $maxUploadBytes) {
            throw ValidationException::withMessages([
                'content_base64' => 'The decoded media file exceeds the configured upload size limit.',
            ]);
        }
        $filename = $validated['filename'];
        if (! is_string($filename)) {
            throw ValidationException::withMessages(['filename' => 'A valid filename is required.']);
        }
        $filename = trim($filename);
        if ($filename === '') {
            throw ValidationException::withMessages(['filename' => 'A valid filename is required.']);
        }
        $location = $this->placement->resolveLocation(
            $context->user,
            $context->workspace->id,
            $validated,
            'folder_id',
        );
        $temporaryPath = tempnam(sys_get_temp_dir(), 'puppetflow-mcp-media-');
        if (! is_string($temporaryPath)) {
            throw ValidationException::withMessages([
                'content_base64' => 'The server could not prepare the media upload.',
            ]);
        }

        $asset = null;
        try {
            if (file_put_contents($temporaryPath, $contents) === false) {
                throw new \RuntimeException('The temporary media upload could not be written.');
            }
            $file = new UploadedFile($temporaryPath, $filename, null, UPLOAD_ERR_OK, true);
            $asset = $this->storage->store($file, $context->workspace->id, $location);
            $metadata = array_intersect_key(
                $validated,
                array_flip(['name', 'description', 'alt_text', 'tags']),
            );
            if ($metadata !== []) {
                $this->placement->updateAsset($asset, $this->normalizeAssetMetadata($metadata));
            }
            $asset->refresh();
        } catch (\Throwable $exception) {
            $asset?->delete();
            throw $exception;
        } finally {
            if (is_file($temporaryPath)) {
                unlink($temporaryPath);
            }
        }

        return ['media_asset' => $this->serializeAsset($asset, $context)];
    }

    /**
     * @param  Arguments  $arguments
     * @return array<string, mixed>
     */
    private function updateAsset(array $arguments, McpToolContext $context): array
    {
        $rules = array_intersect_key(
            UpdateMediaAssetRequest::rulesFor($context->workspace->id),
            array_flip(['name', 'description', 'alt_text', 'tags', 'tags.*']),
        );
        $validated = validator($arguments, [
            'media_asset_id' => ['required', 'string'],
            ...$rules,
        ])->validate();
        $asset = $this->asset((string) $validated['media_asset_id'], $context, Ability::UPDATE);
        unset($validated['media_asset_id']);
        if ($validated === []) {
            throw ValidationException::withMessages(['media_asset' => 'Provide at least one media metadata change.']);
        }
        $validated = $this->normalizeAssetMetadata($validated);
        $this->placement->updateAsset($asset, $validated);
        $asset->refresh();

        return ['media_asset' => $this->serializeAsset($asset, $context)];
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @return AssetMetadata
     */
    private function normalizeAssetMetadata(array $metadata): array
    {
        /** @var AssetMetadata $normalized */
        $normalized = [];
        foreach (['description', 'alt_text'] as $field) {
            if (array_key_exists($field, $metadata)) {
                $value = $metadata[$field];
                if ($value === null || is_string($value)) {
                    $normalized[$field] = is_string($value) ? (trim($value) ?: null) : null;
                }
            }
        }
        if (array_key_exists('name', $metadata) && is_string($metadata['name'])) {
            $normalized['name'] = trim($metadata['name']);
        }
        if (isset($metadata['tags']) && is_array($metadata['tags'])) {
            $tags = [];
            foreach ($metadata['tags'] as $tag) {
                if (is_string($tag)) {
                    $tags[] = trim($tag);
                }
            }
            $normalized['tags'] = $tags;
        }

        return $normalized;
    }

    /**
     * @param  Arguments  $arguments
     * @return array<string, mixed>
     */
    private function updateFolder(array $arguments, McpToolContext $context): array
    {
        $validated = validator($arguments, [
            'media_folder_id' => ['required', 'string'],
            ...UpdateMediaFolderRequest::rulesFor(),
        ])->validate();
        $folder = $this->folder((string) $validated['media_folder_id'], $context, Ability::UPDATE);
        unset($validated['media_folder_id']);
        if ($validated === []) {
            throw ValidationException::withMessages(['media_folder' => 'Provide at least one folder metadata change.']);
        }
        if (array_key_exists('name', $validated)) {
            $validated['name'] = trim((string) $validated['name']);
        }
        $this->placement->updateFolder($folder, $validated);
        $folder->refresh();

        return ['media_folder' => $this->serializeFolder($folder, $context)];
    }

    private function asset(string $id, McpToolContext $context, Ability $ability): MediaAsset
    {
        $asset = MediaAsset::query()
            ->where('workspace_id', $context->workspace->id)
            ->with(['storedUpload', 'folder:id,name', 'user:id,name', 'team:id,name'])
            ->find($id);
        if (! $asset || Gate::forUser($context->user)->denies($ability->value, $asset)) {
            throw ValidationException::withMessages([
                'media_asset_id' => 'Media asset not found or not accessible.',
            ]);
        }

        return $asset;
    }

    private function folder(string $id, McpToolContext $context, Ability $ability): MediaFolder
    {
        $folder = MediaFolder::query()
            ->where('workspace_id', $context->workspace->id)
            ->with(['parent:id,name', 'user:id,name', 'team:id,name'])
            ->withCount(['assets', 'children'])
            ->find($id);
        if (! $folder || Gate::forUser($context->user)->denies($ability->value, $folder)) {
            throw ValidationException::withMessages([
                'media_folder_id' => 'Media folder not found or not accessible.',
            ]);
        }

        return $folder;
    }

    /** @return array<string, mixed> */
    private function serializeAsset(MediaAsset $asset, McpToolContext $context): array
    {
        $asset->loadMissing(['storedUpload', 'folder:id,name', 'user:id,name', 'team:id,name']);
        $mime = $asset->storedUpload->mime_type ?? 'application/octet-stream';
        $inline = UploadStoragePreview::supportsInline($mime);

        return [
            'id' => $asset->id,
            'name' => $asset->name,
            'original_filename' => $asset->original_filename,
            'description' => $asset->description,
            'alt_text' => $asset->alt_text,
            'tags' => $asset->tags ?? [],
            'mime_type' => $mime,
            'size_bytes' => $asset->storedUpload->size_bytes,
            'folder_id' => $asset->folder_id,
            'folder_name' => $asset->folder?->name,
            'visibility' => $asset->visibility,
            'owner_id' => $asset->user_id,
            'owner_name' => $asset->user?->name,
            'team_id' => $asset->team_id,
            'team_name' => $asset->team?->name,
            'preview_path' => $inline ? route('media.preview', $asset, false) : null,
            'thumbnail_path' => MediaAssetProjector::thumbnailUrl($asset, $mime),
            'download_path' => route('media.download', $asset, false),
            'created_at' => $asset->created_at?->toIso8601String(),
            'updated_at' => $asset->updated_at?->toIso8601String(),
            'capabilities' => [
                'view' => Gate::forUser($context->user)->allows(Ability::VIEW->value, $asset),
                'update_metadata' => Gate::forUser($context->user)->allows(Ability::UPDATE->value, $asset),
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function serializeFolder(MediaFolder $folder, McpToolContext $context): array
    {
        $folder->loadMissing(['parent:id,name', 'user:id,name', 'team:id,name']);

        return [
            'id' => $folder->id,
            'name' => $folder->name,
            'parent_id' => $folder->parent_id,
            'parent_name' => $folder->parent?->name,
            'visibility' => $folder->visibility,
            'owner_id' => $folder->user_id,
            'owner_name' => $folder->user?->name,
            'team_id' => $folder->team_id,
            'team_name' => $folder->team?->name,
            'sort_order' => $folder->sort_order,
            'assets_count' => (int) ($folder->assets_count ?? 0),
            'children_count' => (int) ($folder->children_count ?? 0),
            'created_at' => $folder->created_at?->toIso8601String(),
            'updated_at' => $folder->updated_at?->toIso8601String(),
            'capabilities' => [
                'view' => Gate::forUser($context->user)->allows(Ability::VIEW->value, $folder),
                'update' => Gate::forUser($context->user)->allows(Ability::UPDATE->value, $folder),
            ],
        ];
    }
}
