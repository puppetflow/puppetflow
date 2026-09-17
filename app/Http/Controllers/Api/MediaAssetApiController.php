<?php

namespace App\Http\Controllers\Api;

use App\Authorization\AuthorizationContextFactory;
use App\Authorization\Visibility\SharedResourceVisibility;
use App\Enums\Authorization\Ability;
use App\Http\Controllers\Api\Concerns\ResolvesApiResources;
use App\Http\Controllers\Controller;
use App\Http\Requests\Media\StoreMediaRequest;
use App\Http\Requests\Media\UpdateMediaAssetRequest;
use App\Models\MediaAsset;
use App\Models\User;
use App\Services\FeatureFlags\FeatureFlagService;
use App\Services\Media\MediaPlacementService;
use App\Services\Media\MediaStorageService;
use App\Services\Media\UploadStoragePreview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class MediaAssetApiController extends Controller
{
    use ResolvesApiResources;

    public function __construct(
        private readonly MediaStorageService $storage,
        private readonly MediaPlacementService $placement,
        private readonly AuthorizationContextFactory $contexts,
        private readonly SharedResourceVisibility $visibility,
        private readonly FeatureFlagService $features,
    ) {}

    public function index(Request $request, string $workspace): JsonResponse
    {
        $user = $this->apiUser($request);
        $resolvedWorkspace = $this->resolveApiWorkspace($workspace, $user);
        $validated = $request->validate([
            'search' => ['sometimes', 'string', 'max:128'],
            'folder_id' => ['sometimes', 'nullable', 'string'],
            'visibility' => ['sometimes', Rule::in($this->features->allowedScopes())],
            'team_id' => ['sometimes', 'string'],
            'mime_type' => ['sometimes', 'string', 'max:128'],
            'tag' => ['sometimes', 'string', 'max:100'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $query = MediaAsset::query()->with(['user:id,name', 'team:id,name', 'storedUpload']);
        $this->visibility->applyView(
            $query,
            $this->contexts->for($user, $resolvedWorkspace->id),
            scopeColumn: 'visibility',
        );

        if (isset($validated['search'])) {
            $search = $validated['search'];
            $query->where(fn ($nested) => $nested->where('name', 'like', "%{$search}%")
                ->orWhere('original_filename', 'like', "%{$search}%"));
        }
        if (array_key_exists('folder_id', $validated)) {
            $folderId = $validated['folder_id'];
            $folderId === null || $folderId === ''
                ? $query->whereNull('folder_id')
                : $query->where('folder_id', $folderId);
        }
        if (isset($validated['visibility'])) {
            $query->where('visibility', $validated['visibility']);
        }
        if (isset($validated['team_id'])) {
            $query->where('team_id', $validated['team_id']);
        }
        if (isset($validated['mime_type'])) {
            $mime = $validated['mime_type'];
            $query->whereHas('storedUpload', fn ($upload) => $upload->where('mime_type', 'like', "{$mime}%"));
        }
        if (isset($validated['tag'])) {
            $query->whereJsonContains('tags', $validated['tag']);
        }

        $paginator = $query->orderBy('name')->orderBy('id')->paginate($validated['per_page'] ?? 50);
        $paginator->through(fn (MediaAsset $asset): array => $this->serialize($asset, $user));

        return response()->json($paginator);
    }

    /** Uploads one or more files (multipart `files[]`) into a folder, a team, the workspace or a member's personal space. */
    public function store(Request $request, string $workspace): JsonResponse
    {
        $user = $this->apiUser($request);
        $resolvedWorkspace = $this->resolveApiWorkspace($workspace, $user);
        Gate::forUser($user)->authorize(Ability::CREATE->value, MediaAsset::class);
        $this->rejectCombinedPlacement($request, 'folder_id');
        $rules = StoreMediaRequest::rulesFor($resolvedWorkspace->id);
        unset($rules['owner_id']);
        $rules['folder_id'] = [
            'nullable',
            Rule::exists('media_folders', 'id')->where('workspace_id', $resolvedWorkspace->id),
        ];
        $rules['user_id'] = [
            'sometimes',
            'required',
            Rule::exists('user_workspace', 'user_id')->where('workspace_id', $resolvedWorkspace->id),
        ];
        $validated = $request->validate($rules, StoreMediaRequest::messagesFor());
        if (isset($validated['user_id'])) {
            $validated['owner_id'] = $validated['user_id'];
            unset($validated['user_id']);
        }
        $location = $this->placement->resolveLocation($user, $resolvedWorkspace->id, $validated, 'folder_id');
        /** @var list<\Illuminate\Http\UploadedFile> $files */
        $files = $request->file('files', []);
        $created = $this->storage->storeMany($files, $resolvedWorkspace->id, $location);

        return response()->json([
            'media' => $created->map(fn (MediaAsset $asset): array => $this->serialize($asset->load(['user:id,name', 'team:id,name']), $user)),
        ], 201);
    }

    public function show(Request $request, string $media): JsonResponse
    {
        $user = $this->apiUser($request);
        $asset = $this->resolveApiResource(MediaAsset::class, $media, $user, Ability::VIEW, 'Media');

        return response()->json($this->serialize($asset, $user));
    }

    public function update(Request $request, string $media): JsonResponse
    {
        $user = $this->apiUser($request);
        $asset = $this->resolveApiResource(MediaAsset::class, $media, $user, Ability::UPDATE, 'Media');
        $this->rejectCombinedPlacement($request, 'folder_id');
        $rules = UpdateMediaAssetRequest::rulesFor($asset->workspace_id);
        $rules['folder_id'] = [
            'sometimes',
            'nullable',
            Rule::exists('media_folders', 'id')->where('workspace_id', $asset->workspace_id),
        ];
        $validated = $request->validate($rules);
        $this->placement->updateAsset($asset, $validated);

        return response()->json($this->serialize($asset->refresh(), $user));
    }

    public function content(Request $request, string $media): JsonResponse
    {
        $asset = $this->resolveApiResource(
            MediaAsset::class,
            $media,
            $this->apiUser($request),
            Ability::VIEW,
            'Media',
        );

        return response()->json(['content' => $this->storage->textContent($asset)]);
    }

    public function updateContent(Request $request, string $media): JsonResponse
    {
        $asset = $this->resolveApiResource(
            MediaAsset::class,
            $media,
            $this->apiUser($request),
            Ability::UPDATE,
            'Media',
        );
        /** @var array{content: string} $validated */
        $validated = $request->validate(['content' => ['present', 'string']]);
        $this->storage->replaceTextContent($asset, $validated['content']);

        return response()->json($this->serialize($asset->refresh(), $this->apiUser($request)));
    }

    public function destroy(Request $request, string $media): JsonResponse
    {
        $asset = $this->resolveApiResource(MediaAsset::class, $media, $this->apiUser($request), Ability::DELETE, 'Media');
        $asset->delete();

        return response()->json(['message' => 'Media deleted.']);
    }

    /** Deletes several assets and folders of a workspace in one call. */
    public function destroyBatch(Request $request, string $workspace): JsonResponse
    {
        $user = $this->apiUser($request);
        $resolvedWorkspace = $this->resolveApiWorkspace($workspace, $user);
        /** @var array{ids?: list<string>, folder_ids?: list<string>} $validated */
        $validated = $request->validate([
            'ids' => ['required_without:folder_ids', 'array', 'min:1', 'max:200'],
            'ids.*' => ['required', 'string', 'distinct'],
            'folder_ids' => ['required_without:ids', 'array', 'min:1', 'max:200'],
            'folder_ids.*' => ['required', 'string', 'distinct'],
        ]);
        $deleted = $this->storage->deleteBatch(
            $user,
            $resolvedWorkspace->id,
            $validated['ids'] ?? [],
            $validated['folder_ids'] ?? [],
        );

        return response()->json(['deleted' => $deleted]);
    }

    /** Streams the file as an attachment, or inline (`?inline=1`) for browser-safe types. */
    public function download(Request $request, string $media): StreamedResponse
    {
        $asset = $this->resolveApiResource(MediaAsset::class, $media, $this->apiUser($request), Ability::VIEW, 'Media');
        $inline = $request->boolean('inline');
        if ($inline) {
            $mime = $asset->storedUpload()->value('mime_type');
            abort_unless(UploadStoragePreview::supportsInline(is_string($mime) ? $mime : null), 415, 'This file type cannot be previewed inline.');
        }

        return $this->storage->stream($asset, inline: $inline);
    }

    public function thumbnail(Request $request, string $media): StreamedResponse
    {
        $asset = $this->resolveApiResource(MediaAsset::class, $media, $this->apiUser($request), Ability::VIEW, 'Media');
        abort_if($asset->thumbnail_stored_upload_id === null, 404);

        return $this->storage->streamThumbnail($asset);
    }

    /** @return array<string, mixed> */
    private function serialize(MediaAsset $asset, User $user): array
    {
        $asset->loadMissing(['user:id,name', 'team:id,name', 'storedUpload']);

        return [
            'id' => $asset->id,
            'workspace_id' => $asset->workspace_id,
            'user_id' => $asset->user_id,
            'user_name' => $asset->user?->name,
            'team_id' => $asset->team_id,
            'team_name' => $asset->team?->name,
            'folder_id' => $asset->folder_id,
            'name' => $asset->name,
            'original_filename' => $asset->original_filename,
            'extension' => pathinfo($asset->original_filename, PATHINFO_EXTENSION) ?: null,
            'mime_type' => $asset->storedUpload->mime_type ?? 'application/octet-stream',
            'size_bytes' => $asset->storedUpload->size_bytes,
            'visibility' => $asset->visibility,
            'description' => $asset->description,
            'alt_text' => $asset->alt_text,
            'tags' => $asset->tags ?? [],
            'thumbnail_url' => $asset->thumbnail_stored_upload_id !== null
                ? route('api.v1.media.thumbnail', $asset)
                : (
                    str_starts_with($asset->storedUpload->mime_type ?? '', 'image/')
                    ? route('api.v1.media.download', ['media' => $asset, 'inline' => 1])
                    : null
                ),
            'download_url' => route('api.v1.media.download', $asset),
            'can_manage' => Gate::forUser($user)->allows(Ability::UPDATE->value, $asset),
            'created_at' => $asset->created_at?->toIso8601String(),
            'updated_at' => $asset->updated_at?->toIso8601String(),
        ];
    }
}
