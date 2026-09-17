<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Models\FlowRun;
use App\Services\Media\MediaStorageService;
use App\Services\Runtime\MediaRuntimeService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class RuntimeMediaController extends Controller
{
    public function __construct(
        private readonly MediaRuntimeService $media,
        private readonly MediaStorageService $storage,
    ) {}

    public function download(Request $request): StreamedResponse
    {
        $run = $request->attributes->get('runner');
        abort_unless($run instanceof FlowRun, 401, 'Runner capability context is missing.');
        $contentLength = $request->headers->get('Content-Length');
        abort_if(is_numeric($contentLength) && (int) $contentLength > 16_384, 413, 'The media request body is too large.');
        abort_if(strlen($request->getContent()) > 16_384, 413, 'The media request body is too large.');
        $validated = $request->validate(['media_id' => ['required', 'string', 'max:64']]);

        return $this->storage->stream($this->media->resolve($run, $validated['media_id']));
    }
}
