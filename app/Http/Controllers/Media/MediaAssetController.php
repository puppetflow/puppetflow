<?php

namespace App\Http\Controllers\Media;

use App\Authorization\AuthorizationContextFactory;
use App\Authorization\Visibility\SharedResourceVisibility;
use App\Enums\Authorization\Ability;
use App\Http\Controllers\Controller;
use App\Http\Requests\Media\InitiateMediaUploadRequest;
use App\Http\Requests\Media\StoreMediaRequest;
use App\Http\Requests\Media\UpdateMediaAssetRequest;
use App\Models\MediaAsset;
use App\Models\StorageUploadReservation;
use App\Models\User;
use App\Services\FeatureFlags\FeatureFlagService;
use App\Services\Media\DirectMediaUploadService;
use App\Services\Media\MediaAssetProjector;
use App\Services\Media\MediaExplorerQuery;
use App\Services\Media\MediaPickerQuery;
use App\Services\Media\MediaPlacementService;
use App\Services\Media\MediaStorageService;
use App\Services\Media\UploadStoragePreview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class MediaAssetController extends Controller
{
    public function __construct(
        private readonly MediaExplorerQuery $explorer,
        private readonly MediaPickerQuery $picker,
        private readonly MediaStorageService $storage,
        private readonly DirectMediaUploadService $directUploads,
        private readonly MediaPlacementService $placement,
        private readonly MediaAssetProjector $projector,
        private readonly AuthorizationContextFactory $contexts,
        private readonly SharedResourceVisibility $visibility,
        private readonly FeatureFlagService $features,
    ) {}

    public function index(Request $request): Response
    {
        return $this->explorer->render($request, $this->workspaceIdFromSession(), $this->actor($request));
    }

    /**
     * Uploads files into the explorer location described by the shared payload:
     * folder_id, team_id / visibility, or owner_id (on behalf).
     */
    public function store(StoreMediaRequest $request): JsonResponse|RedirectResponse
    {
        $workspaceId = $this->workspaceIdFromSession();
        $user = $this->actor($request);
        $location = $this->placement->resolveLocation($user, $workspaceId, $request->validated(), 'folder_id');
        /** @var list<\Illuminate\Http\UploadedFile> $files */
        $files = $request->file('files', []);
        $created = $this->storage->storeMany($files, $workspaceId, $location);

        return $request->wantsJson()
            ? response()->json(['media' => $created->map(fn (MediaAsset $asset): array => $this->projector->full($asset, $user))], 201)
            : back()->with('success', $created->count().' media items uploaded.');
    }

    public function initiateUpload(InitiateMediaUploadRequest $request): JsonResponse
    {
        $workspaceId = $this->workspaceIdFromSession();
        $user = $this->actor($request);
        $validated = $request->validated();
        $location = $this->placement->resolveLocation($user, $workspaceId, $validated, 'folder_id');
        /** @var list<array{name: string, size: int, mime_type: string, checksum_sha256: string, checksum_md5?: string|null}> $files */
        $files = $validated['files'];

        return response()->json($this->directUploads->initiate($user, $workspaceId, $location, $files), 201);
    }

    public function completeUpload(Request $request, StorageUploadReservation $reservation): JsonResponse
    {
        abort_unless($reservation->workspace_id === $this->workspaceIdFromSession(), 404);
        $user = $this->actor($request);
        $created = $this->directUploads->complete($reservation, $user);

        return response()->json([
            'media' => $created->map(fn (MediaAsset $asset): array => $this->projector->full($asset, $user)),
        ], 201);
    }

    public function cancelUpload(Request $request, StorageUploadReservation $reservation): JsonResponse
    {
        abort_unless($reservation->workspace_id === $this->workspaceIdFromSession(), 404);
        $this->directUploads->cancel($reservation, $this->actor($request));

        return response()->json(null, 204);
    }

    /** Updates the metadata and, optionally, the placement (owner, scope, team, folder) of an asset. */
    public function update(UpdateMediaAssetRequest $request, MediaAsset $mediaAsset): JsonResponse|RedirectResponse
    {
        /** @var array{
         *     name?: string, description?: string|null, alt_text?: string|null, tags?: list<string>,
         *     visibility?: string, team_id?: string|null, user_id?: string, folder_id?: string|null
         * } $validated
         */
        $validated = $request->validated();
        $this->placement->updateAsset($mediaAsset, $validated);

        return $this->assetResponse($request, $mediaAsset, 'Media updated.');
    }

    /**
     * Moves an asset with the shared explorer payload ({ folder_id } or
     * { workspace_folder_id, scope, team_id, change_visibility }).
     */
    public function move(Request $request, MediaAsset $mediaAsset): JsonResponse|RedirectResponse
    {
        $this->authorizeOwn($mediaAsset, Ability::UPDATE);
        /** @var array{folder_id?: string|null, workspace_folder_id?: string|null, scope?: string, team_id?: string|null, owner_id?: string|null} $validated */
        $validated = $request->validate([
            'folder_id' => ['nullable', 'string'],
            'workspace_folder_id' => ['nullable', 'string'],
            'scope' => ['sometimes', 'in:'.implode(',', $this->features->allowedScopes())],
            'team_id' => ['nullable', 'string'],
            'owner_id' => ['nullable', 'string'],
            'change_visibility' => ['sometimes', 'boolean'],
        ]);
        $this->placement->moveAsset($mediaAsset, $validated, $request->boolean('change_visibility'));

        return $this->assetResponse($request, $mediaAsset, 'Media moved.');
    }

    public function destroy(Request $request, MediaAsset $mediaAsset): JsonResponse|RedirectResponse
    {
        $this->authorizeOwn($mediaAsset, Ability::DELETE);
        $mediaAsset->delete();

        return $request->wantsJson()
            ? response()->json(['message' => 'Media deleted.'])
            : back()->with('success', 'Media deleted.');
    }

    /** Deletes the selected assets and folders (shared explorer batch payload). */
    public function destroyBatch(Request $request): JsonResponse|RedirectResponse
    {
        $workspaceId = $this->workspaceIdFromSession();
        /** @var array{ids?: list<string>, folder_ids?: list<string>} $validated */
        $validated = $request->validate([
            'ids' => ['sometimes', 'array', 'max:200'],
            'ids.*' => ['required', 'string', 'distinct'],
            'folder_ids' => ['sometimes', 'array', 'max:200'],
            'folder_ids.*' => ['required', 'string', 'distinct'],
        ]);
        $assetIds = $validated['ids'] ?? [];
        $folderIds = $validated['folder_ids'] ?? [];
        if ($assetIds === [] && $folderIds === []) {
            return back()->with('error', 'No items selected.');
        }
        $deleted = $this->storage->deleteBatch($this->actor($request), $workspaceId, $assetIds, $folderIds);
        $message = "Deleted {$deleted} item(s).";

        return $request->wantsJson()
            ? response()->json(['message' => $message])
            : back()->with('success', $message);
    }

    /** Autocomplete source for $upload() in the flow editor. */
    public function suggestions(Request $request): JsonResponse
    {
        $query = MediaAsset::query()->with(['storedUpload:id,mime_type', 'team:id,name']);
        $this->visibility->applyUse(
            $query,
            $this->contexts->for($this->actor($request), $this->workspaceIdFromSession()),
            scopeColumn: 'visibility',
        );
        $search = trim($request->string('search')->toString());
        if ($search !== '') {
            $query->where(fn ($nested) => $nested->where('name', 'like', "%{$search}%")
                ->orWhere('original_filename', 'like', "%{$search}%"));
        }

        return response()->json($query->orderBy('name')->get()->map(function (MediaAsset $asset): array {
            $mime = $asset->storedUpload->mime_type ?? 'application/octet-stream';

            return [
                'id' => $asset->id,
                'name' => $asset->name,
                'original_filename' => $asset->original_filename,
                'mime_type' => $mime,
                'thumbnail_url' => MediaAssetProjector::thumbnailUrl($asset, $mime),
                'visibility' => $asset->visibility,
                'team_name' => $asset->team?->name,
            ];
        })->values());
    }

    public function picker(Request $request): JsonResponse
    {
        return response()->json(
            $this->picker->data($this->workspaceIdFromSession(), $this->actor($request)),
        );
    }

    public function download(MediaAsset $mediaAsset): StreamedResponse
    {
        $this->authorizeOwn($mediaAsset, Ability::VIEW);

        return $this->storage->stream($mediaAsset);
    }

    public function preview(MediaAsset $mediaAsset): StreamedResponse
    {
        $this->authorizeOwn($mediaAsset, Ability::VIEW);
        $mime = $mediaAsset->storedUpload()->value('mime_type');
        abort_unless(UploadStoragePreview::supportsInline(is_string($mime) ? $mime : null), 415);

        return $this->storage->stream($mediaAsset, inline: true);
    }

    public function thumbnail(MediaAsset $mediaAsset): StreamedResponse
    {
        $this->authorizeOwn($mediaAsset, Ability::VIEW);
        abort_if($mediaAsset->thumbnail_stored_upload_id === null, 404);

        return $this->storage->streamThumbnail($mediaAsset);
    }

    public function content(Request $request, MediaAsset $mediaAsset): JsonResponse
    {
        $this->authorizeOwn($mediaAsset, Ability::VIEW);

        return response()->json(['content' => $this->storage->textContent($mediaAsset)]);
    }

    public function updateContent(Request $request, MediaAsset $mediaAsset): JsonResponse
    {
        $this->authorizeOwn($mediaAsset, Ability::UPDATE);
        /** @var array{content: string} $validated */
        $validated = $request->validate(['content' => ['present', 'string']]);
        $this->storage->replaceTextContent($mediaAsset, $validated['content']);

        return response()->json([
            'message' => 'Media content updated.',
            'size_bytes' => $mediaAsset->storedUpload()->value('size_bytes'),
            'updated_at' => $mediaAsset->updated_at?->toIso8601String(),
        ]);
    }

    private function actor(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }

    /** Ensures the asset belongs to the current workspace and the actor holds the ability. */
    private function authorizeOwn(MediaAsset $asset, Ability $ability): void
    {
        abort_unless($asset->workspace_id === $this->workspaceIdFromSession(), 404);
        Gate::authorize($ability->value, $asset);
    }

    private function assetResponse(Request $request, MediaAsset $asset, string $message): JsonResponse|RedirectResponse
    {
        return $request->wantsJson()
            ? response()->json($this->projector->full($asset->refresh(), $this->actor($request)))
            : back()->with('success', $message);
    }
}
