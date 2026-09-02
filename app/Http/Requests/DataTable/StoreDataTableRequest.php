<?php

namespace App\Http\Requests\DataTable;

use App\Enums\Authorization\Ability;
use App\Models\DataTable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class StoreDataTableRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::forUser($this->user())->allows(Ability::CREATE->value, DataTable::class);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:128'],
            'description' => ['nullable', 'string'],
            'group' => ['nullable', 'string', 'max:100'],
            'visibility' => [
                'sometimes',
                Rule::in(app(\App\Services\FeatureFlags\FeatureFlagService::class)->allowedScopes()),
            ],
            'team_id' => ['nullable', 'string'],
            'user_id' => ['nullable', 'string', 'exists:users,id'],
        ];
    }
}
