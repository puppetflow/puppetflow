<?php

namespace App\Services\Integration\Ai\Vendor\Mistral;

use App\Contracts\Integration\Ai\AiProviderDriverInterface;
use App\Enums\Integration\IntegrationAiProviderEnum;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class MistralDriver implements AiProviderDriverInterface
{
    public function provider(): IntegrationAiProviderEnum
    {
        return IntegrationAiProviderEnum::MISTRAL;
    }

    public function listModels(string $apiKey): array
    {
        $response = $this->request($apiKey)->get('https://api.mistral.ai/v1/models');
        $this->ensureSuccess($response);

        $data = $response->json('data');

        $models = collect(is_array($data) ? $data : [])
            ->filter(fn (mixed $model): bool => is_array($model) && is_string($model['id'] ?? null))
            ->map(function (array $model): array {
                $capabilities = is_array($model['capabilities'] ?? null) ? $model['capabilities'] : [];

                return [
                    'id' => $model['id'],
                    'label' => $model['id'],
                    'capabilities' => [
                        'text' => is_bool($capabilities['completion_chat'] ?? null)
                            ? $capabilities['completion_chat']
                            : null,
                        'vision' => is_bool($capabilities['vision'] ?? null) ? $capabilities['vision'] : null,
                        'structured_output' => null,
                        'tools' => is_bool($capabilities['function_calling'] ?? null)
                            ? $capabilities['function_calling']
                            : null,
                    ],
                    'context_window' => is_numeric($model['max_context_length'] ?? null)
                        ? (int) $model['max_context_length']
                        : null,
                ];
            })
            ->sortBy('label', SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->all();
        /** @var list<array<string, mixed>> $models */

        return $models;
    }

    public function message(string $apiKey, string $model, array $messages, array $options = []): array
    {
        $normalized = collect($messages)->map(function (array $message): array {
            $parts = is_array($message['content'] ?? null) ? $message['content'] : [];
            $toolResult = collect($parts)->first(fn (mixed $part): bool => (
                is_array($part) && ($part['type'] ?? null) === 'tool_result'
            ));
            if (is_array($toolResult) && is_string($toolResult['tool_call_id'] ?? null)) {
                return [
                    'role' => 'tool',
                    'tool_call_id' => $toolResult['tool_call_id'],
                    'content' => is_string($toolResult['text'] ?? null) ? $toolResult['text'] : '',
                ];
            }
            $content = collect($parts)
                ->map(function (mixed $part): ?array {
                    if (! is_array($part)) {
                        return null;
                    }
                    if (($part['type'] ?? null) === 'image' && is_string($part['data'] ?? null)) {
                        $mime = is_string($part['mime_type'] ?? null) ? $part['mime_type'] : 'image/jpeg';

                        return ['type' => 'image_url', 'image_url' => "data:{$mime};base64,{$part['data']}"];
                    }
                    if (($part['type'] ?? null) === 'text' && is_string($part['text'] ?? null)) {
                        return ['type' => 'text', 'text' => $part['text']];
                    }

                    return null;
                })
                ->filter()
                ->values()
                ->all();
            $toolCalls = collect($parts)
                ->filter(fn (mixed $part): bool => is_array($part) && ($part['type'] ?? null) === 'tool_call')
                ->map(fn (array $part): array => [
                    'id' => $part['id'],
                    'type' => 'function',
                    'function' => [
                        'name' => $part['name'],
                        'arguments' => is_string($part['arguments_json'] ?? null)
                            ? $part['arguments_json']
                            : json_encode(
                                is_array($part['arguments'] ?? null) && $part['arguments'] !== []
                                    ? $part['arguments']
                                    : new \stdClass,
                            ),
                    ],
                ])
                ->values()
                ->all();

            return [
                'role' => in_array($message['role'] ?? null, ['user', 'assistant', 'system'], true)
                    ? $message['role']
                    : 'user',
                'content' => $content,
                ...($toolCalls !== [] ? ['tool_calls' => $toolCalls] : []),
            ];
        })->values()->all();

        if (is_string($options['system'] ?? null) && $options['system'] !== '') {
            array_unshift($normalized, ['role' => 'system', 'content' => [['type' => 'text', 'text' => $options['system']]]]);
        }

        $payload = array_filter([
            'model' => $model,
            'messages' => $normalized,
            'temperature' => $options['temperature'] ?? null,
            'top_p' => $options['top_p'] ?? null,
            'max_tokens' => $options['max_tokens'] ?? null,
        ], fn (mixed $value): bool => $value !== null && $value !== '');
        $responseFormat = is_array($options['response_format'] ?? null) ? $options['response_format'] : [];
        if (
            ($responseFormat['type'] ?? null) === 'json_schema'
            && is_array($responseFormat['schema'] ?? null)
        ) {
            $payload['response_format'] = [
                'type' => 'json_schema',
                'json_schema' => [
                    'schema' => $responseFormat['schema'],
                    'name' => is_string($responseFormat['name'] ?? null)
                        ? $responseFormat['name']
                        : 'response',
                    'strict' => true,
                ],
            ];
        } elseif (($responseFormat['type'] ?? null) === 'json_object') {
            $payload['response_format'] = ['type' => 'json_object'];
        }
        if (is_array($options['tools'] ?? null) && $options['tools'] !== []) {
            $payload['tools'] = collect($options['tools'])->filter(fn (mixed $tool): bool => is_array($tool))->map(fn (mixed $tool): array => [
                'type' => 'function',
                'function' => [
                    'name' => is_string($tool['name'] ?? null) ? $tool['name'] : 'tool',
                    'description' => is_string($tool['description'] ?? null) ? $tool['description'] : '',
                    'parameters' => is_array($tool['inputSchema'] ?? null)
                        ? $tool['inputSchema']
                        : ['type' => 'object', 'properties' => new \stdClass],
                ],
            ])->values()->all();
        }

        $response = $this->request($apiKey)->post('https://api.mistral.ai/v1/chat/completions', $payload);
        $this->ensureSuccess($response);
        $decoded = $response->json();
        $raw = is_array($decoded) ? $decoded : [];
        $choices = is_array($raw['choices'] ?? null) ? $raw['choices'] : [];
        $choice = is_array($choices[0] ?? null) ? $choices[0] : [];
        $message = is_array($choice['message'] ?? null) ? $choice['message'] : [];
        $content = $message['content'] ?? '';
        $text = is_string($content) ? $content : '';
        $toolCalls = collect(is_array($message['tool_calls'] ?? null) ? $message['tool_calls'] : [])
            ->filter(fn (mixed $call): bool => is_array($call) && is_array($call['function'] ?? null))
            ->map(fn (array $call): array => [
                'id' => is_string($call['id'] ?? null) ? $call['id'] : '',
                'name' => is_string($call['function']['name'] ?? null) ? $call['function']['name'] : '',
                'arguments' => is_string($call['function']['arguments'] ?? null)
                    ? (json_decode($call['function']['arguments'], true) ?: [])
                    : [],
                'argumentsJson' => is_string($call['function']['arguments'] ?? null)
                    ? $call['function']['arguments']
                    : '{}',
            ])
            ->filter(fn (array $call): bool => $call['id'] !== '' && $call['name'] !== '')
            ->values()
            ->all();

        return [
            'text' => $text,
            'toolCalls' => $toolCalls,
            'content' => is_array($content) ? $content : [['type' => 'text', 'text' => $text]],
            'usage' => is_array($raw['usage'] ?? null) ? $raw['usage'] : [],
            'model' => $raw['model'] ?? $model,
            'finishReason' => $choice['finish_reason'] ?? null,
            'raw' => ($options['include_raw'] ?? false) ? $raw : null,
        ];
    }

    private function request(string $apiKey): \Illuminate\Http\Client\PendingRequest
    {
        return Http::acceptJson()
            ->asJson()
            ->withToken($apiKey)
            ->connectTimeout(10)
            ->timeout(120);
    }

    private function ensureSuccess(Response $response): void
    {
        if ($response->failed()) {
            $detail = $response->json('error.message');
            $suffix = is_string($detail) && $detail !== '' ? " {$detail}" : '';

            throw new RuntimeException("Mistral request failed with HTTP {$response->status()}.{$suffix}");
        }
    }
}
