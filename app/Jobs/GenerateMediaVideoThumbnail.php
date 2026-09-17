<?php

namespace App\Jobs;

use App\Models\MediaAsset;
use App\Services\Media\VideoThumbnailService;
use Illuminate\Support\Facades\Log;

final class GenerateMediaVideoThumbnail extends InternalJob
{
    public int $tries = 3;

    public function __construct(public string $mediaAssetId)
    {
        parent::__construct();
    }

    public function handle(VideoThumbnailService $thumbnails): void
    {
        $asset = MediaAsset::query()->find($this->mediaAssetId);
        if ($asset === null || $asset->thumbnail_stored_upload_id !== null) {
            return;
        }
        try {
            $thumbnails->generate($asset);
        } catch (\Throwable $exception) {
            Log::warning('Video thumbnail generation failed.', [
                'media_id' => $this->mediaAssetId,
                'exception' => $exception,
            ]);
            throw $exception;
        }
    }
}
