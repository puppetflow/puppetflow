<?php

namespace App\Http\Requests\Media;

use App\Enums\Authorization\Ability;
use App\Models\MediaAsset;
use App\Services\FeatureFlags\FeatureFlagService;
use App\Services\Media\MediaUploadTransport;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

final class InitiateMediaUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::forUser($this->user())->allows(Ability::CREATE->value, MediaAsset::class);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        $workspaceId = is_string(session('current_workspace_id')) ? session('current_workspace_id') : '';
        $maxBytes = config()->integer('puppetflow.media.max_upload_bytes');
        $maxFiles = config()->integer('puppetflow.media.max_upload_files');
        $requiresMd5 = app(MediaUploadTransport::class)->checksumAlgorithm() === MediaUploadTransport::CHECKSUM_MD5;

        return [
            'files' => ['required', 'array', 'min:1', "max:{$maxFiles}"],
            'files.*.name' => ['required', 'string', 'max:255'],
            'files.*.size' => ['required', 'integer', 'min:0', "max:{$maxBytes}"],
            'files.*.mime_type' => ['required', 'string', 'max:255'],
            'files.*.checksum_sha256' => ['required', 'string', 'regex:/^[a-f0-9]{64}$/i'],
            'files.*.checksum_md5' => [Rule::requiredIf($requiresMd5), 'nullable', 'string', 'regex:/^[a-f0-9]{32}$/i'],
            'visibility' => ['sometimes', Rule::in(app(FeatureFlagService::class)->allowedScopes())],
            'team_id' => ['nullable', Rule::exists('workspace_teams', 'id')->where('workspace_id', $workspaceId)],
            'folder_id' => ['nullable', Rule::exists('media_folders', 'id')->where('workspace_id', $workspaceId)],
            'owner_id' => ['nullable', 'string'],
        ];
    }
}
