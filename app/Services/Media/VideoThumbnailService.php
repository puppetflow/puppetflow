<?php

namespace App\Services\Media;

use App\Models\MediaAsset;
use App\Models\StoredUpload;
use App\Services\Storage\UploadStorage;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

final class VideoThumbnailService
{
    public function __construct(private readonly UploadStorage $uploads) {}

    public function generate(MediaAsset $asset, ?string $sourcePath = null): void
    {
        $upload = $asset->storedUpload()->firstOrFail();
        if (! is_string($upload->mime_type) || ! str_starts_with($upload->mime_type, 'video/')) {
            return;
        }

        $temporaryInput = ! is_string($sourcePath) || ! is_file($sourcePath);
        $input = $temporaryInput ? tempnam(sys_get_temp_dir(), 'media-video-') : $sourcePath;
        $output = tempnam(sys_get_temp_dir(), 'media-thumb-');
        if (! is_string($input) || ! is_string($output)) {
            throw new \RuntimeException('Unable to allocate temporary video thumbnail files.');
        }

        $thumbnailPath = null;
        try {
            if ($temporaryInput) {
                $this->copyToLocalFile($upload, $input);
            }
            if (! $this->extractFrame($input, $output, '1')) {
                $this->extractFrame($input, $output);
            }
            $contents = file_get_contents($output);
            if (! is_string($contents) || $contents === '') {
                throw new \RuntimeException('FFmpeg did not produce a video thumbnail.');
            }

            $thumbnailPath = $this->uploads->put(
                $contents,
                dirname($upload->path).'/thumbnails',
                Str::random(40).'.jpg',
                'image/jpeg',
            );
            $thumbnail = $this->uploads->find($thumbnailPath);
            if (! $thumbnail instanceof StoredUpload) {
                throw new \RuntimeException('Stored video thumbnail could not be resolved.');
            }

            $asset->update(['thumbnail_stored_upload_id' => $thumbnail->id]);
            $thumbnailPath = null;
        } finally {
            if ($temporaryInput) {
                @unlink($input);
            }
            @unlink($output);
            if ($thumbnailPath !== null) {
                $this->uploads->delete($thumbnailPath);
            }
        }
    }

    private function copyToLocalFile(StoredUpload $upload, string $destination): void
    {
        $source = $this->uploads->readStream($upload->path);
        $target = fopen($destination, 'wb');
        if (! is_resource($source) || ! is_resource($target)) {
            if (is_resource($source)) {
                fclose($source);
            }
            if (is_resource($target)) {
                fclose($target);
            }
            throw new \RuntimeException('Unable to stage the video for thumbnail generation.');
        }

        try {
            if (stream_copy_to_stream($source, $target) === false) {
                throw new \RuntimeException('Unable to stage the complete video for thumbnail generation.');
            }
        } finally {
            fclose($source);
            fclose($target);
        }
    }

    private function extractFrame(string $input, string $output, ?string $seek = null): bool
    {
        $command = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y'];
        if ($seek !== null) {
            array_push($command, '-ss', $seek);
        }
        array_push(
            $command,
            '-i',
            $input,
            '-frames:v',
            '1',
            '-vf',
            'scale=640:640:force_original_aspect_ratio=decrease',
            '-q:v',
            '3',
            '-f',
            'image2',
            $output,
        );

        $process = new Process($command);
        $process->setTimeout(30);
        $process->run();

        return $process->isSuccessful()
            && is_file($output)
            && filesize($output) !== false
            && filesize($output) > 0;
    }
}
