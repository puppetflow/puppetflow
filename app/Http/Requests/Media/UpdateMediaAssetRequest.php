<?php

namespace App\Http\Requests\Media;

use App\Enums\Authorization\Ability;
use App\Models\MediaAsset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

final class UpdateMediaAssetRequest extends FormRequest
{
    public function authorize(): bool
    {
        $asset = $this->route('mediaAsset');

        return $asset instanceof MediaAsset
            && $asset->workspace_id === session('current_workspace_id')
            && Gate::forUser($this->user())->allows(Ability::UPDATE->value, $asset);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return self::rulesFor(is_string(session('current_workspace_id')) ? session('current_workspace_id') : '');
    }

    /** @return array<string, list<mixed>> */
    public static function rulesFor(string $workspaceId): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'alt_text' => ['sometimes', 'nullable', 'string', 'max:500'],
            'tags' => ['sometimes', 'array', 'max:50'],
            'tags.*' => ['required', 'string', 'max:100', 'distinct'],
            'visibility' => ['sometimes', Rule::in(app(\App\Services\FeatureFlags\FeatureFlagService::class)->allowedScopes())],
            'team_id' => ['sometimes', 'nullable', Rule::exists('workspace_teams', 'id')->where('workspace_id', $workspaceId)],
            'user_id' => ['sometimes', 'required', Rule::exists('user_workspace', 'user_id')->where('workspace_id', $workspaceId)],
            'folder_id' => ['sometimes', 'nullable', Rule::exists('media_folders', 'id')->where('workspace_id', $workspaceId)],
        ];
    }
}
