<?php

namespace App\Http\Requests\Media;

use App\Enums\Authorization\Ability;
use App\Models\MediaAsset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

final class StoreMediaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::forUser($this->user())->allows(Ability::CREATE->value, MediaAsset::class);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return self::rulesFor(is_string(session('current_workspace_id')) ? session('current_workspace_id') : '');
    }

    /**
     * Shared with the public API, which scopes the rules to the workspace from the URL.
     *
     * @return array<string, list<mixed>>
     */
    public static function rulesFor(string $workspaceId): array
    {
        $maxKilobytes = (int) ceil(config()->integer('puppetflow.media.max_upload_bytes') / 1024);
        $maxFiles = config()->integer('puppetflow.media.max_upload_files');

        return [
            'files' => ['required', 'array', 'min:1', "max:{$maxFiles}"],
            'files.*' => ['required', 'file', "max:{$maxKilobytes}"],
            'visibility' => ['sometimes', Rule::in(app(\App\Services\FeatureFlags\FeatureFlagService::class)->allowedScopes())],
            'team_id' => ['nullable', Rule::exists('workspace_teams', 'id')->where('workspace_id', $workspaceId)],
            'folder_id' => ['nullable', Rule::exists('media_folders', 'id')->where('workspace_id', $workspaceId)],
            'owner_id' => ['nullable', 'string'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return self::messagesFor();
    }

    /** @return array<string, string> */
    public static function messagesFor(): array
    {
        $maxMegabytes = (int) ceil(config()->integer('puppetflow.media.max_upload_bytes') / 1024 / 1024);
        $maxFiles = config()->integer('puppetflow.media.max_upload_files');

        return [
            'files.required' => 'Select at least one file to upload.',
            'files.max' => "Upload no more than {$maxFiles} files at a time.",
            'files.*.uploaded' => 'A file could not be received by PHP. It may exceed the server upload limit.',
            'files.*.max' => "Each file must be no larger than {$maxMegabytes} MB.",
        ];
    }
}
