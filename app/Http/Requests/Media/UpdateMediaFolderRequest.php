<?php

namespace App\Http\Requests\Media;

use App\Enums\Authorization\Ability;
use App\Models\MediaFolder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

final class UpdateMediaFolderRequest extends FormRequest
{
    public function authorize(): bool
    {
        $folder = $this->route('mediaFolder');

        return $folder instanceof MediaFolder
            && $folder->workspace_id === session('current_workspace_id')
            && Gate::forUser($this->user())->allows(Ability::UPDATE->value, $folder);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return self::rulesFor();
    }

    /** @return array<string, list<mixed>> */
    public static function rulesFor(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }
}
