<?php

namespace App\Services\Workspace;

use App\Models\Flow;
use App\Models\Workspace;
use App\Models\WorkspaceProxy;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use JsonException;

final class ManagedWorkspaceProxyService
{
    public function syncForWorkspace(?Workspace $workspace): void
    {
        if (! $workspace) {
            return;
        }

        $definitions = $this->definitions();
        if ($definitions === null) {
            return;
        }

        if (
            $definitions === []
            && ! WorkspaceProxy::query()
                ->where('workspace_id', $workspace->id)
                ->where('managed_by_env', true)
                ->exists()
        ) {
            return;
        }

        $labels = array_column($definitions, 'label');
        $conflictingLabel = $labels === []
            ? null
            : WorkspaceProxy::query()
                ->where('workspace_id', $workspace->id)
                ->where('managed_by_env', false)
                ->whereIn('label', $labels)
                ->value('label');

        if (is_string($conflictingLabel)) {
            Log::warning('Managed proxies were not synchronized because a workspace proxy already uses a configured label.', [
                'workspace_id' => $workspace->id,
                'label' => $conflictingLabel,
            ]);

            return;
        }

        DB::transaction(function () use ($workspace, $definitions): void {
            $configuredKeys = array_column($definitions, 'key');
            $staleQuery = WorkspaceProxy::query()
                ->where('workspace_id', $workspace->id)
                ->where('managed_by_env', true);

            if ($configuredKeys !== []) {
                $staleQuery->whereNotIn('managed_key', $configuredKeys);
            }

            $staleIds = $staleQuery->lockForUpdate()->pluck('id');
            if ($staleIds->isNotEmpty()) {
                Flow::query()
                    ->where('workspace_id', $workspace->id)
                    ->whereIn('workspace_proxy_id', $staleIds)
                    ->update([
                        'proxy_mode' => 'none',
                        'workspace_proxy_id' => null,
                    ]);
                WorkspaceProxy::query()->whereIn('id', $staleIds)->delete();
            }

            foreach ($definitions as $definition) {
                $proxy = WorkspaceProxy::query()->firstOrNew([
                    'workspace_id' => $workspace->id,
                    'managed_key' => $definition['key'],
                ]);
                $proxy->fill([
                    'user_id' => null,
                    'team_id' => null,
                    'label' => $definition['label'],
                    'visibility' => 'workspace',
                    'group' => $definition['group'],
                    'managed_by_env' => true,
                    'scheme' => $definition['scheme'],
                    'host' => $definition['host'],
                    'port' => $definition['port'],
                    'country_code' => $definition['country_code'],
                    'username' => $definition['username'],
                    'password' => $definition['password'],
                ]);

                if (! $proxy->exists || $proxy->isDirty()) {
                    $proxy->save();
                }
            }
        }, 3);
    }

    /**
     * @return list<array{
     *     key: string,
     *     label: string,
     *     scheme: string,
     *     host: string,
     *     port: int,
     *     country_code: string|null,
     *     group: string|null,
     *     username: string|null,
     *     password: string|null
     * }>|null
     */
    private function definitions(): ?array
    {
        $configured = config('puppetflow.managed_proxies', '');
        if (! is_string($configured) || trim($configured) === '') {
            return [];
        }

        try {
            $decoded = json_decode($configured, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            $this->logInvalidConfiguration($exception->getMessage());

            return null;
        }

        if (! is_array($decoded) || ! array_is_list($decoded)) {
            $this->logInvalidConfiguration('The value must be a JSON array.');

            return null;
        }

        $definitions = [];
        $keys = [];
        $labels = [];

        foreach ($decoded as $index => $entry) {
            $definition = is_array($entry) ? $this->normalize($entry) : null;
            if ($definition === null) {
                $this->logInvalidConfiguration("Entry {$index} is invalid.");

                return null;
            }

            if (isset($keys[$definition['key']]) || isset($labels[$definition['label']])) {
                $this->logInvalidConfiguration("Entry {$index} duplicates a key or label.");

                return null;
            }

            $keys[$definition['key']] = true;
            $labels[$definition['label']] = true;
            $definitions[] = $definition;
        }

        return $definitions;
    }

    /**
     * @param  array<mixed>  $entry
     * @return array{
     *     key: string,
     *     label: string,
     *     scheme: string,
     *     host: string,
     *     port: int,
     *     country_code: string|null,
     *     group: string|null,
     *     username: string|null,
     *     password: string|null
     * }|null
     */
    private function normalize(array $entry): ?array
    {
        $label = $this->trimmedString($entry['label'] ?? null);
        $key = $this->trimmedString($entry['key'] ?? $label);
        $scheme = $this->trimmedString($entry['scheme'] ?? null);
        $host = trim($this->trimmedString($entry['host'] ?? null) ?? '', '[]');
        $port = $entry['port'] ?? null;
        $countryCode = $this->nullableTrimmedString($entry['country_code'] ?? null);
        $group = $this->nullableTrimmedString($entry['group'] ?? null);
        $username = $this->nullableTrimmedString($entry['username'] ?? null);
        $password = $entry['password'] ?? null;

        if (
            $label === null
            || strlen($label) > 255
            || $key === null
            || strlen($key) > 255
            || ! in_array($scheme, ['http', 'https', 'socks4', 'socks5'], true)
            || $host === ''
            || strlen($host) > 255
            || preg_match('/^(?!.*[\s\/@])(?:[0-9A-Fa-f:]+|[0-9A-Za-z](?:[0-9A-Za-z.-]*[0-9A-Za-z])?)$/', $host) !== 1
            || ! is_int($port)
            || $port < 1
            || $port > 65535
            || ($countryCode !== null && preg_match('/^[A-Za-z]{2}$/', $countryCode) !== 1)
            || ($group !== null && strlen($group) > 255)
            || ($username !== null && strlen($username) > 1000)
            || ($password !== null && ! is_string($password))
            || (is_string($password) && strlen($password) > 4000)
            || ($username === null && is_string($password) && $password !== '')
        ) {
            return null;
        }

        return [
            'key' => $key,
            'label' => $label,
            'scheme' => $scheme,
            'host' => $host,
            'port' => $port,
            'country_code' => $countryCode === null ? null : strtoupper($countryCode),
            'group' => $group,
            'username' => $username,
            'password' => $username === null ? null : (is_string($password) ? $password : ''),
        ];
    }

    private function trimmedString(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);

        return $value === '' ? null : $value;
    }

    private function nullableTrimmedString(mixed $value): ?string
    {
        return $value === null || $value === '' ? null : $this->trimmedString($value);
    }

    private function logInvalidConfiguration(string $reason): void
    {
        Log::warning('MANAGED_PROXIES contains invalid JSON configuration. Existing managed proxies were preserved.', [
            'reason' => $reason,
        ]);
    }
}
