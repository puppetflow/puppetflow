<?php

namespace App\Http\Requests\Mcp;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class McpBrokerAuthorizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->isMethod('GET') || $this->user() !== null;
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        $callbackUrl = config('puppetflow.mcp_broker.callback_url');

        return [
            'redirect_uri' => [
                'required',
                'string',
                'max:2048',
                Rule::in([is_string($callbackUrl) ? $callbackUrl : '']),
            ],
            'state' => ['required', 'string', 'max:2048'],
            'code_challenge' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{43}$/'],
            'code_challenge_method' => ['required', Rule::in(['S256'])],
            'workspace_id' => [Rule::requiredIf($this->isMethod('POST')), 'string', 'max:32'],
        ];
    }
}
