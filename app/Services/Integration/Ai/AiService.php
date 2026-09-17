<?php

namespace App\Services\Integration\Ai;

use App\Contracts\Integration\Ai\AiProviderDriverInterface;
use App\Enums\Integration\IntegrationAiProviderEnum;
use App\Models\AiModel;
use App\Models\Integration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use LogicException;

class AiService
{
    /** @var array<string, AiProviderDriverInterface> */
    private array $drivers = [];

    /** @param iterable<AiProviderDriverInterface> $drivers */
    public function __construct(iterable $drivers)
    {
        foreach ($drivers as $driver) {
            $this->drivers[$driver->provider()->value] = $driver;
        }
    }

    public function driver(IntegrationAiProviderEnum $provider): AiProviderDriverInterface
    {
        return $this->drivers[$provider->value]
            ?? throw new LogicException("No AI driver is registered for {$provider->value}.");
    }

    /** @return list<array<string, mixed>> */
    public function listModels(IntegrationAiProviderEnum $provider, string $apiKey, bool $refresh = false): array
    {
        $cacheKey = 'ai-models:v3:'.$provider->value.':'.hash('sha256', $apiKey);
        if ($refresh) {
            Cache::forget($cacheKey);
        }

        return Cache::remember($cacheKey, now()->addMinutes(10), fn (): array => $this->driver($provider)->listModels($apiKey));
    }

    /**
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    public function validateConfig(
        IntegrationAiProviderEnum $provider,
        array $config,
        ?Integration $existing = null,
        bool $verifyRemote = true,
    ): array {
        $merged = $existing instanceof Integration
            ? $existing->mergeConfigPreservingBlank($config)
            : $config;

        $apiKey = $merged['api_key'] ?? null;
        if (! is_string($apiKey) || trim($apiKey) === '') {
            throw ValidationException::withMessages(['config.api_key' => 'An API key is required.']);
        }

        if ($verifyRemote) {
            $this->listModels($provider, $apiKey, true);
        }

        $merged['api_key'] = trim($apiKey);

        return $merged;
    }

    /**
     * @param  list<array<string, mixed>>  $messages
     * @param  array<string, mixed>  $options
     * @return array<string, mixed>
     */
    public function execute(
        AiModel $aiModel,
        string $capability,
        array $messages,
        array $options = [],
    ): array {
        $integration = $aiModel->aiIntegration;
        if (! $integration instanceof Integration) {
            throw ValidationException::withMessages(['ai_model_id' => 'The linked AI integration is unavailable.']);
        }
        $provider = $integration->aiProvider();
        $config = $integration->config ?? [];
        $apiKey = $config['api_key'] ?? null;
        if (! is_string($apiKey) || $apiKey === '') {
            throw ValidationException::withMessages(['ai_model_id' => 'The linked AI integration has no API key.']);
        }

        $capabilities = $aiModel->capabilities;
        if (($capabilities[$capability] ?? false) !== true) {
            throw ValidationException::withMessages([
                'ai_model_id' => "This AI model does not support {$capability} input.",
            ]);
        }
        if (
            is_array($options['tools'] ?? null)
            && $options['tools'] !== []
            && ! $this->supportsTools($provider, $aiModel->ai_model_id, $capabilities)
        ) {
            throw ValidationException::withMessages([
                'ai_model_id' => 'This AI model does not support tool calls.',
            ]);
        }
        if (is_array($options['tools'] ?? null)) {
            $options['tools'] = array_map(function (mixed $tool): mixed {
                if (! is_array($tool)) {
                    return $tool;
                }

                $tool['inputSchema'] = $this->normalizeInputSchema($tool['inputSchema'] ?? null);

                return $tool;
            }, $options['tools']);
        }

        $result = $this->driver($provider)->message(
            $apiKey,
            $aiModel->ai_model_id,
            $messages,
            $options,
        );
        $result['provider'] = $provider->value;

        return $result;
    }

    /** @param array<string, mixed> $capabilities */
    private function supportsTools(
        IntegrationAiProviderEnum $provider,
        string $model,
        array $capabilities,
    ): bool {
        $configured = $capabilities['tools'] ?? null;
        if (is_bool($configured)) {
            return $configured;
        }

        return $provider === IntegrationAiProviderEnum::ANTHROPIC
            || ($provider === IntegrationAiProviderEnum::GEMINI
                && str_starts_with(strtolower($model), 'gemini-'));
    }

    /** @return array<string, mixed> */
    private function normalizeInputSchema(mixed $schema): array
    {
        if (! is_array($schema) || $schema === []) {
            return ['type' => 'object', 'properties' => new \stdClass];
        }

        $schema['type'] = 'object';
        $schema['properties'] = $this->normalizeSchemaMap($schema['properties'] ?? null);
        $normalized = $this->normalizeSchemaNode($schema);

        return is_array($normalized) ? $normalized : ['type' => 'object', 'properties' => new \stdClass];
    }

    /**
     * @param  array<string, mixed>  $schema
     * @return array<string, mixed>|\stdClass
     */
    private function normalizeSchemaNode(array $schema): array|\stdClass
    {
        if ($schema === []) {
            return new \stdClass;
        }

        if (array_key_exists('properties', $schema)) {
            $schema['properties'] = $this->normalizeSchemaMap($schema['properties']);
        }
        foreach (['allOf', 'anyOf', 'oneOf', 'prefixItems'] as $keyword) {
            if (is_array($schema[$keyword] ?? null)) {
                $schema[$keyword] = array_map(
                    fn (mixed $child): mixed => $this->normalizeUnknownSchema($child),
                    $schema[$keyword],
                );
            }
        }
        foreach (['items', 'additionalProperties', 'unevaluatedProperties', 'contains', 'not', 'if', 'then', 'else', 'propertyNames'] as $keyword) {
            if (is_array($schema[$keyword] ?? null)) {
                $schema[$keyword] = $this->normalizeUnknownSchema($schema[$keyword]);
            }
        }

        return $schema;
    }

    /** @return array<string, mixed>|\stdClass */
    private function normalizeSchemaMap(mixed $schemas): array|\stdClass
    {
        if (! is_array($schemas) || $schemas === []) {
            return new \stdClass;
        }

        return array_map(
            fn (mixed $schema): mixed => $this->normalizeUnknownSchema($schema),
            $schemas,
        );
    }

    private function normalizeUnknownSchema(mixed $schema): mixed
    {
        if (! is_array($schema)) {
            return $schema;
        }

        /** @var array<string, mixed> $schema */
        return $this->normalizeSchemaNode($schema);
    }
}
