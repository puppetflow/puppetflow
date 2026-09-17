<?php

namespace App\Http\Requests\Media;

use App\Enums\Authorization\Ability;
use App\Models\MediaFolder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

final class StoreMediaFolderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::forUser($this->user())->allows(Ability::CREATE->value, MediaFolder::class);
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
            'name' => ['required', 'string', 'max:255'],
            'parent_id' => ['nullable', Rule::exists('media_folders', 'id')->where('workspace_id', $workspaceId)],
            'team_id' => ['nullable', Rule::exists('workspace_teams', 'id')->where('workspace_id', $workspaceId)],
            'visibility' => ['sometimes', Rule::in(app(\App\Services\FeatureFlags\FeatureFlagService::class)->allowedScopes())],
            'is_shared' => ['sometimes', 'boolean'],
            'owner_id' => ['nullable', 'string'],
        ];
    }
}
