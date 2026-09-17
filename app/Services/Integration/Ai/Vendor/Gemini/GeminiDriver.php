<?php

namespace App\Services\Integration\Ai\Vendor\Gemini;

use App\Contracts\Integration\Ai\AiProviderDriverInterface;
use App\Enums\Integration\IntegrationAiProviderEnum;
use App\Services\Integration\Ai\Vendor\Concerns\DecodesToolArguments;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class GeminiDriver implements AiProviderDriverInterface
{
    use DecodesToolArguments;

    public function provider(): IntegrationAiProviderEnum
    {
        return IntegrationAiProviderEnum::GEMINI;
    }

    public function listModels(string $apiKey): array
    {
        $models = [];
        $pageToken = null;

        do {
            $response = $this->request()->get('https://generativelanguage.googleapis.com/v1beta/models', array_filter([
                'key' => $apiKey,
                'pageSize' => 1000,
                'pageToken' => $pageToken,
            ]));
            $this->ensureSuccess($response);
            $data = $response->json('models');
            foreach (is_array($data) ? $data : [] as $model) {
                if (! is_array($model) || ! is_string($model['name'] ?? null)) {
                    continue;
                }
                $methods = is_array($model['supportedGenerationMethods'] ?? null)
                    ? $model['supportedGenerationMethods']
                    : [];
                if (! in_array('generateContent', $methods, true)) {
                    continue;
                }
                $id = preg_replace('#^models/#', '', $model['name']) ?: $model['name'];
                $models[] = [
                    'id' => $id,
                    'label' => is_string($model['displayName'] ?? null) ? $model['displayName'] : $id,
                    'capabilities' => [
                        'text' => true,
                        'vision' => $this->supportsImageInput($id),
                        'structured_output' => null,
                        'tools' => $this->supportsToolCalling($id),
                    ],
                    'context_window' => is_numeric($model['inputTokenLimit'] ?? null)
                        ? (int) $model['inputTokenLimit']
                        : null,
                ];
            }
            $pageToken = $response->json('nextPageToken');
        } while (is_string($pageToken) && $pageToken !== '');

        $sorted = collect($models)->sortBy('label', SORT_NATURAL | SORT_FLAG_CASE)->values()->all();
        /** @var list<array<string, mixed>> $sorted */

        return $sorted;
    }

    private function supportsImageInput(string $aiModelId): ?bool
    {
        $model = strtolower($aiModelId);

        if (in_array($model, ['gemini-pro', 'gemini-1.0-pro'], true)) {
            return false;
        }

        return str_starts_with($model, 'gemini-') ? true : null;
    }

    private function supportsToolCalling(string $aiModelId): ?bool
    {
        return str_starts_with(strtolower($aiModelId), 'gemini-') ? true : null;
    }

    public function message(string $apiKey, string $model, array $messages, array $options = []): array
    {
        $contents = collect($messages)
            ->filter(fn (array $message): bool => ($message['role'] ?? null) !== 'system')
            ->map(function (array $message): array {
                $parts = collect(is_array($message['content'] ?? null) ? $message['content'] : [])
                    ->map(function (mixed $part): ?array {
                        if (! is_array($part)) {
                            return null;
                        }
                        if (($part['type'] ?? null) === 'image' && is_string($part['data'] ?? null)) {
                            return ['inlineData' => [
                                'mimeType' => is_string($part['mime_type'] ?? null) ? $part['mime_type'] : 'image/jpeg',
                                'data' => $part['data'],
                            ]];
                        }
                        if (($part['type'] ?? null) === 'text' && is_string($part['text'] ?? null)) {
                            return ['text' => $part['text']];
                        }
                        if (($part['type'] ?? null) === 'tool_call' && is_string($part['name'] ?? null)) {
                            return ['functionCall' => [
                                'name' => $part['name'],
                                'args' => $this->toolArguments($part),
                                ...(is_string($part['id'] ?? null) ? ['id' => $part['id']] : []),
                            ]];
                        }
                        if (($part['type'] ?? null) === 'tool_result' && is_string($part['name'] ?? null)) {
                            return ['functionResponse' => [
                                'name' => $part['name'],
                                ...(is_string($part['tool_call_id'] ?? null) ? ['id' => $part['tool_call_id']] : []),
                                'response' => [
                                    'result' => is_string($part['text'] ?? null) ? $part['text'] : '',
                                ],
                            ]];
                        }

                        return null;
                    })
                    ->filter()
                    ->values()
                    ->all();

                return [
                    'role' => ($message['role'] ?? null) === 'assistant' ? 'model' : 'user',
                    'parts' => $parts,
                ];
            })
            // Gemini expects the responses of a parallel tool call turn in a single content,
            // so consecutive same-role contents (one per tool result in our format) are merged.
            ->reduce(function (array $contents, array $content): array {
                $last = array_key_last($contents);
                if ($last !== null && $contents[$last]['role'] === $content['role']) {
                    $contents[$last]['parts'] = [...$contents[$last]['parts'], ...$content['parts']];
                } else {
                    $contents[] = $content;
                }

                return $contents;
            }, []);

        $generationConfig = array_filter([
            'temperature' => $options['temperature'] ?? null,
            'topP' => $options['top_p'] ?? null,
            'maxOutputTokens' => $options['max_tokens'] ?? null,
        ], fn (mixed $value): bool => $value !== null && $value !== '');
        if (is_array($options['response_format'] ?? null)) {
            $generationConfig['responseMimeType'] = 'application/json';
            $schema = $options['response_format']['schema'] ?? null;
            if (is_array($schema)) {
                $generationConfig['responseJsonSchema'] = $schema;
            }
        }

        $payload = ['contents' => $contents];
        if ($generationConfig !== []) {
            $payload['generationConfig'] = $generationConfig;
        }
        if (is_string($options['system'] ?? null) && $options['system'] !== '') {
            $payload['systemInstruction'] = ['parts' => [['text' => $options['system']]]];
        }
        if (is_array($options['tools'] ?? null) && $options['tools'] !== []) {
            $payload['tools'] = [[
                'functionDeclarations' => collect($options['tools'])->filter(fn (mixed $tool): bool => is_array($tool))->map(fn (mixed $tool): array => [
                    'name' => is_string($tool['name'] ?? null) ? $tool['name'] : 'tool',
                    'description' => is_string($tool['description'] ?? null) ? $tool['description'] : '',
                    'parametersJsonSchema' => is_array($tool['inputSchema'] ?? null)
                        ? $tool['inputSchema']
                        : ['type' => 'object', 'properties' => new \stdClass],
                ])->values()->all(),
            ]];
        }

        $url = 'https://generativelanguage.googleapis.com/v1beta/models/'
            .rawurlencode($model).':generateContent?key='.rawurlencode($apiKey);
        $response = $this->request()->post($url, $payload);
        for ($attempt = 0; $attempt < 3 && $response->failed(); $attempt++) {
            $removedOption = false;
            foreach ([
                [['temperature'], ['temperature']],
                [['topP'], ['topp', 'top_p']],
                [
                    ['responseJsonSchema', 'responseMimeType'],
                    ['responsejsonschema', 'response_json_schema', 'responsemimetype', 'structured output'],
                ],
            ] as [$configKeys, $errorMarkers]) {
                $hasOption = false;
                foreach ($configKeys as $configKey) {
                    $hasOption = $hasOption
                        || array_key_exists($configKey, $payload['generationConfig'] ?? []);
                }
                if (! $hasOption || ! $this->isUnsupportedOptionError($response, $errorMarkers)) {
                    continue;
                }

                foreach ($configKeys as $configKey) {
                    unset($payload['generationConfig'][$configKey]);
                }
                $response = $this->request()->post($url, $payload);
                $removedOption = true;

                break;
            }

            if (! $removedOption) {
                break;
            }
        }
        $this->ensureSuccess($response);
        $decodedObject = json_decode($response->body());
        $objectParts = is_object($decodedObject)
            && is_array($decodedObject->candidates ?? null)
            && is_object($decodedObject->candidates[0] ?? null)
            && is_object($decodedObject->candidates[0]->content ?? null)
            && is_array($decodedObject->candidates[0]->content->parts ?? null)
                ? $decodedObject->candidates[0]->content->parts
                : [];
        $argumentJson = collect($objectParts)
            ->filter(fn (mixed $part): bool => is_object($part) && is_object($part->functionCall ?? null))
            ->map(fn (object $part): string => json_encode($part->functionCall->args ?? new \stdClass) ?: '{}')
            ->values()
            ->all();
        $decoded = $response->json();
        $raw = is_array($decoded) ? $decoded : [];
        $candidates = is_array($raw['candidates'] ?? null) ? $raw['candidates'] : [];
        $candidate = is_array($candidates[0] ?? null) ? $candidates[0] : [];
        $content = is_array($candidate['content'] ?? null) ? $candidate['content'] : [];
        $parts = is_array($content['parts'] ?? null) ? $content['parts'] : [];
        $text = collect($parts)
            ->pluck('text')
            ->filter(fn (mixed $text): bool => is_string($text))
            ->implode('');
        $toolCalls = collect($parts)
            ->filter(fn (mixed $part): bool => is_array($part) && is_array($part['functionCall'] ?? null))
            ->values()
            ->map(function (array $part, int $index) use ($argumentJson): array {
                $name = is_string($part['functionCall']['name'] ?? null) ? $part['functionCall']['name'] : '';

                return [
                    'id' => is_string($part['functionCall']['id'] ?? null)
                        ? $part['functionCall']['id']
                        : 'gemini-'.$index.'-'.($name !== '' ? $name : 'tool'),
                    'name' => $name,
                    'arguments' => is_array($part['functionCall']['args'] ?? null) ? $part['functionCall']['args'] : [],
                    'argumentsJson' => $argumentJson[$index] ?? '{}',
                ];
            })
            ->filter(fn (array $call): bool => $call['name'] !== '')
            ->values()
            ->all();

        return [
            'text' => $text,
            'toolCalls' => $toolCalls,
            'content' => $parts,
            'usage' => is_array($raw['usageMetadata'] ?? null) ? $raw['usageMetadata'] : [],
            'model' => $model,
            'finishReason' => $candidate['finishReason'] ?? null,
            'raw' => ($options['include_raw'] ?? false) ? $raw : null,
        ];
    }

    private function request(): \Illuminate\Http\Client\PendingRequest
    {
        return Http::acceptJson()->asJson()->connectTimeout(10)->timeout(120);
    }

    /** @param list<string> $markers */
    private function isUnsupportedOptionError(Response $response, array $markers): bool
    {
        if (! $response->failed()) {
            return false;
        }

        $errorMessage = $response->json('error.message', '');
        $detail = is_string($errorMessage) ? strtolower($errorMessage) : '';
        $unsupported = str_contains($detail, 'unsupported')
            || str_contains($detail, 'not supported')
            || str_contains($detail, 'does not support')
            || str_contains($detail, 'unknown name')
            || str_contains($detail, 'cannot find field');

        if (! $unsupported) {
            return false;
        }

        foreach ($markers as $marker) {
            if (str_contains($detail, $marker)) {
                return true;
            }
        }

        return false;
    }

    private function ensureSuccess(Response $response): void
    {
        if ($response->failed()) {
            $detail = $response->json('error.message');
            $suffix = is_string($detail) && $detail !== '' ? " {$detail}" : '';

            throw new RuntimeException("Gemini request failed with HTTP {$response->status()}.{$suffix}");
        }
    }
}
