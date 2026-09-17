<?php

namespace App\Services\Integration\Ai\Vendor\OpenAi;

use App\Contracts\Integration\Ai\AiProviderDriverInterface;
use App\Enums\Integration\IntegrationAiProviderEnum;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class OpenAiDriver implements AiProviderDriverInterface
{
    public function provider(): IntegrationAiProviderEnum
    {
        return IntegrationAiProviderEnum::OPENAI;
    }

    public function listModels(string $apiKey): array
    {
        $response = $this->request($apiKey)->get('https://api.openai.com/v1/models');
        $this->ensureSuccess($response);

        $data = $response->json('data');

        $models = collect(is_array($data) ? $data : [])
            ->filter(fn (mixed $model): bool => is_array($model) && is_string($model['id'] ?? null))
            ->reject(fn (array $model): bool => $this->isUnsupportedModel($model['id']))
            ->map(function (array $model): array {
                $capabilities = $this->resolveCapabilities($model['id']);

                return [
                    'id' => $model['id'],
                    'label' => $model['id'],
                    'capabilities' => $capabilities,
                    'context_window' => null,
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
        $input = collect($messages)->flatMap(function (array $message): array {
            $role = in_array($message['role'] ?? null, ['user', 'assistant', 'system'], true)
                ? $message['role']
                : 'user';
            $parts = is_array($message['content'] ?? null) ? $message['content'] : [];
            $conversationContent = collect($parts)
                ->map(function (mixed $part) use ($role): ?array {
                    if (! is_array($part)) {
                        return null;
                    }
                    if (($part['type'] ?? null) === 'image' && is_string($part['data'] ?? null)) {
                        $mime = is_string($part['mime_type'] ?? null) ? $part['mime_type'] : 'image/jpeg';

                        return ['type' => 'input_image', 'image_url' => "data:{$mime};base64,{$part['data']}"];
                    }
                    if (($part['type'] ?? null) === 'text' && is_string($part['text'] ?? null)) {
                        return ['type' => $role === 'assistant' ? 'output_text' : 'input_text', 'text' => $part['text']];
                    }

                    return null;
                })
                ->filter()
                ->values()
                ->all();
            $items = $conversationContent === [] ? [] : [['role' => $role, 'content' => $conversationContent]];
            foreach ($parts as $part) {
                if (! is_array($part)) {
                    continue;
                }
                if (($part['type'] ?? null) === 'tool_call' && is_string($part['id'] ?? null) && is_string($part['name'] ?? null)) {
                    $items[] = [
                        'type' => 'function_call',
                        'call_id' => $part['id'],
                        'name' => $part['name'],
                        'arguments' => is_string($part['arguments_json'] ?? null)
                            ? $part['arguments_json']
                            : json_encode(
                                is_array($part['arguments'] ?? null) && $part['arguments'] !== []
                                    ? $part['arguments']
                                    : new \stdClass,
                            ),
                    ];
                }
                if (($part['type'] ?? null) === 'tool_result' && is_string($part['tool_call_id'] ?? null)) {
                    $items[] = [
                        'type' => 'function_call_output',
                        'call_id' => $part['tool_call_id'],
                        'output' => is_string($part['text'] ?? null) ? $part['text'] : '',
                    ];
                }
            }

            return $items;
        })->values()->all();

        // OpenAI rejects json_object output unless an input message mentions "json".
        $responseFormat = is_array($options['response_format'] ?? null) ? $options['response_format'] : [];
        if (($responseFormat['type'] ?? null) === 'json_object' && ! $this->inputMentionsJson($input)) {
            array_unshift($input, [
                'role' => 'system',
                'content' => [['type' => 'input_text', 'text' => 'Respond with a single valid JSON object.']],
            ]);
        }

        $payload = array_filter([
            'model' => $model,
            'input' => $input,
            'instructions' => $options['system'] ?? null,
            'temperature' => $options['temperature'] ?? null,
            'top_p' => $options['top_p'] ?? null,
            'max_output_tokens' => $options['max_tokens'] ?? null,
        ], fn (mixed $value): bool => $value !== null && $value !== '');

        if (is_array($options['response_format'] ?? null)) {
            $payload['text'] = ['format' => $options['response_format']];
        }
        if (is_array($options['tools'] ?? null) && $options['tools'] !== []) {
            $payload['tools'] = collect($options['tools'])->filter(fn (mixed $tool): bool => is_array($tool))->map(fn (mixed $tool): array => [
                'type' => 'function',
                'name' => is_string($tool['name'] ?? null) ? $tool['name'] : 'tool',
                'description' => is_string($tool['description'] ?? null) ? $tool['description'] : '',
                'parameters' => is_array($tool['inputSchema'] ?? null)
                    ? $tool['inputSchema']
                    : ['type' => 'object', 'properties' => new \stdClass],
                'strict' => false,
            ])->values()->all();
        }

        $response = $this->request($apiKey)->post('https://api.openai.com/v1/responses', $payload);
        for ($attempt = 0; $attempt < 3 && $response->failed(); $attempt++) {
            $removedOption = false;
            foreach ([
                'temperature' => ['temperature'],
                'top_p' => ['top_p'],
                'text' => ['text.format', 'response_format', 'structured output'],
            ] as $payloadKey => $errorMarkers) {
                if (! array_key_exists($payloadKey, $payload)
                    || ! $this->isUnsupportedOptionError($response, $errorMarkers)) {
                    continue;
                }

                unset($payload[$payloadKey]);
                $response = $this->request($apiKey)->post('https://api.openai.com/v1/responses', $payload);
                $removedOption = true;

                break;
            }

            if (! $removedOption) {
                break;
            }
        }
        $this->ensureSuccess($response);
        $decoded = $response->json();
        $raw = is_array($decoded) ? $decoded : [];
        $output = is_array($raw['output'] ?? null) ? $raw['output'] : [];
        $text = collect($output)
            ->flatMap(fn (mixed $item): array => is_array($item) && is_array($item['content'] ?? null) ? $item['content'] : [])
            ->filter(fn (mixed $part): bool => is_array($part) && ($part['type'] ?? null) === 'output_text')
            ->pluck('text')
            ->filter(fn (mixed $text): bool => is_string($text))
            ->implode('');
        $toolCalls = collect($output)
            ->filter(fn (mixed $item): bool => is_array($item) && ($item['type'] ?? null) === 'function_call')
            ->map(fn (array $item): array => [
                'id' => is_string($item['call_id'] ?? null) ? $item['call_id'] : (string) ($item['id'] ?? ''),
                'name' => is_string($item['name'] ?? null) ? $item['name'] : '',
                'arguments' => is_string($item['arguments'] ?? null)
                    ? (json_decode($item['arguments'], true) ?: [])
                    : [],
                'argumentsJson' => is_string($item['arguments'] ?? null) ? $item['arguments'] : '{}',
            ])
            ->filter(fn (array $call): bool => $call['id'] !== '' && $call['name'] !== '')
            ->values()
            ->all();

        return [
            'text' => $text,
            'toolCalls' => $toolCalls,
            'content' => $output,
            'usage' => is_array($raw['usage'] ?? null) ? $raw['usage'] : [],
            'model' => $raw['model'] ?? $model,
            'finishReason' => $raw['status'] ?? null,
            'raw' => $options['include_raw'] ?? false ? $raw : null,
        ];
    }

    /** @param array<int, array<string, mixed>> $input */
    private function inputMentionsJson(array $input): bool
    {
        foreach ($input as $message) {
            foreach (is_array($message['content'] ?? null) ? $message['content'] : [] as $part) {
                if (is_array($part) && str_contains(strtolower(is_string($part['text'] ?? null) ? $part['text'] : ''), 'json')) {
                    return true;
                }
            }
        }

        return false;
    }

    private function request(string $apiKey): \Illuminate\Http\Client\PendingRequest
    {
        return Http::acceptJson()
            ->asJson()
            ->withToken($apiKey)
            ->connectTimeout(10)
            ->timeout(120);
    }

    /** @return array{text: bool|null, vision: bool|null, structured_output: bool|null, tools: bool|null} */
    private function resolveCapabilities(string $aiModelId): array
    {
        $model = strtolower($aiModelId);
        if (str_starts_with($model, 'ft:')) {
            $model = substr($model, 3);
        }

        if ($this->startsWithAny($model, ['o1-mini', 'o1-preview', 'o3-mini', 'codex-mini'])) {
            return $this->capabilities(text: true, vision: false, structuredOutput: true, tools: true);
        }

        if (str_contains($model, '-search-preview')) {
            return $this->capabilities(text: true, vision: false, structuredOutput: true, tools: true);
        }

        if ($this->startsWithAny($model, ['gpt-5.2-pro'])) {
            return $this->capabilities(text: true, vision: true, structuredOutput: false, tools: true);
        }

        if ($this->startsWithAny($model, [
            'gpt-5',
            'gpt-4.1',
            'gpt-4o',
            'chatgpt-4o',
            'gpt-4-turbo',
            'o1',
            'o3',
            'o4-mini',
            'computer-use-preview',
        ])) {
            return $this->capabilities(text: true, vision: true, structuredOutput: true, tools: true);
        }

        if ($this->startsWithAny($model, ['gpt-4', 'gpt-3.5', 'codex'])) {
            return $this->capabilities(text: true, vision: false, structuredOutput: false, tools: true);
        }

        return $this->capabilities(text: null, vision: null, structuredOutput: null, tools: null);
    }

    private function isUnsupportedModel(string $aiModelId): bool
    {
        $model = strtolower($aiModelId);

        if ($this->startsWithAny($model, [
            'text-embedding-',
            'embedding-',
            'text-moderation-',
            'omni-moderation-',
            'dall-e-',
            'gpt-image-',
            'sora-',
            'whisper-',
            'tts-',
        ])) {
            return true;
        }

        foreach (['-realtime', '-audio', '-transcribe', '-tts'] as $marker) {
            if (str_contains($model, $marker)) {
                return true;
            }
        }

        return false;
    }

    /** @param list<string> $markers */
    private function isUnsupportedOptionError(Response $response, array $markers): bool
    {
        if (! $response->failed()) {
            return false;
        }

        $errorParam = $response->json('error.param', '');
        $errorMessage = $response->json('error.message', '');
        $param = is_string($errorParam) ? strtolower($errorParam) : '';
        $detail = is_string($errorMessage) ? strtolower($errorMessage) : '';
        $unsupported = str_contains($detail, 'unsupported')
            || str_contains($detail, 'not supported')
            || str_contains($detail, 'does not support');

        if (! $unsupported) {
            return false;
        }

        foreach ($markers as $marker) {
            if (str_contains($param, $marker) || str_contains($detail, $marker)) {
                return true;
            }
        }

        return false;
    }

    /** @param list<string> $prefixes */
    private function startsWithAny(string $value, array $prefixes): bool
    {
        foreach ($prefixes as $prefix) {
            if (str_starts_with($value, $prefix)) {
                return true;
            }
        }

        return false;
    }

    /** @return array{text: bool|null, vision: bool|null, structured_output: bool|null, tools: bool|null} */
    private function capabilities(
        ?bool $text,
        ?bool $vision,
        ?bool $structuredOutput,
        ?bool $tools,
    ): array {
        return [
            'text' => $text,
            'vision' => $vision,
            'structured_output' => $structuredOutput,
            'tools' => $tools,
        ];
    }

    private function ensureSuccess(Response $response): void
    {
        if ($response->failed()) {
            $detail = $response->json('error.message');
            $suffix = is_string($detail) && $detail !== '' ? " {$detail}" : '';

            throw new RuntimeException("OpenAI request failed with HTTP {$response->status()}.{$suffix}");
        }
    }
}
