<?php

namespace App\Services\Storage;

use App\Models\Flow;
use App\Models\FlowUserCookieJar;
use Illuminate\Support\Facades\DB;

final class FlowCookieStorage
{
    public function __construct(
        private readonly RunArtifactStorage $artifacts,
    ) {}

    public function generation(Flow $flow): int
    {
        return Flow::query()
            ->whereKey($flow->getKey())
            ->firstOrFail(['cookie_generation'])
            ->cookie_generation;
    }

    /**
     * @return array<string, string>
     */
    public function hydrate(Flow $flow, ?string $userId, string $localDirectory): array
    {
        $this->clearLocalDirectory($localDirectory);
        $this->ensureLocalDirectory($localDirectory);

        if ($userId === null) {
            return [];
        }

        $jars = $this->storedJars($flow, $userId);
        if ($jars === []) {
            $jars = $this->importLegacyJars($flow, $userId);
        }

        foreach ($jars as $filename => $jar) {
            $path = $localDirectory.DIRECTORY_SEPARATOR.$filename;
            if (file_put_contents($path, $jar, LOCK_EX) === false) {
                throw new \RuntimeException("Unable to hydrate cookie jar {$filename}.");
            }
            @chmod($path, 0600);
        }

        return $jars;
    }

    /**
     * @param  array<string, string>  $originalJars
     */
    public function persist(
        Flow $flow,
        ?string $userId,
        string $localDirectory,
        array $originalJars,
        int $cookieGeneration,
    ): void {
        if ($userId === null) {
            $this->clearLocalDirectory($localDirectory);

            return;
        }

        $localJars = $this->readLocalJars($localDirectory);
        if ($localJars === $originalJars) {
            $this->clearLocalDirectory($localDirectory);

            return;
        }

        $this->withLockedGeneration($flow, function (int $currentGeneration) use ($flow, $userId, $originalJars, $localJars, $cookieGeneration): void {
            // The jars were cleared while this run was in flight: its cookies are stale.
            if ($currentGeneration !== $cookieGeneration) {
                return;
            }

            foreach (array_unique([...array_keys($originalJars), ...array_keys($localJars)]) as $filename) {
                $original = $originalJars[$filename] ?? null;
                $current = $localJars[$filename] ?? null;
                if ($current === $original) {
                    continue;
                }

                $profileName = $this->profileNameFromFilename($filename);
                if ($current === null) {
                    FlowUserCookieJar::query()
                        ->where('flow_id', $flow->getKey())
                        ->where('user_id', $userId)
                        ->where('jar_name', $profileName)
                        ->delete();

                    continue;
                }

                $this->writeProfile($flow, $userId, $profileName, $current);
            }
        });

        $this->clearLocalDirectory($localDirectory);
    }

    public function clear(Flow $flow): void
    {
        $this->artifacts->deleteFlowDirectory($flow, 'cookies');
        DB::transaction(function () use ($flow): void {
            Flow::query()->whereKey($flow->getKey())->increment('cookie_generation');
            FlowUserCookieJar::query()->where('flow_id', $flow->getKey())->delete();
        });
    }

    /**
     * Serializes jar writers of a flow through its row lock; the callback receives the current cookie generation.
     *
     * @param  callable(int): void  $callback
     */
    private function withLockedGeneration(Flow $flow, callable $callback): void
    {
        DB::transaction(function () use ($flow, $callback): void {
            $generation = Flow::query()
                ->whereKey($flow->getKey())
                ->lockForUpdate()
                ->firstOrFail(['cookie_generation'])
                ->cookie_generation;
            $callback($generation);
        });
    }

    /**
     * @return array<string, string>
     */
    private function storedJars(Flow $flow, string $userId): array
    {
        $jars = [];
        $storedJars = FlowUserCookieJar::query()
            ->where('flow_id', $flow->getKey())
            ->where('user_id', $userId)
            ->orderBy('jar_name')
            ->get();

        foreach ($storedJars as $storedJar) {
            $profileName = $storedJar->getAttribute('jar_name');
            if (! is_string($profileName)) {
                throw new \RuntimeException('Stored flow cookie profile name is invalid.');
            }
            $filename = $this->filenameFromProfileName($profileName);
            $cookies = $storedJar->cookies;
            $jars[$filename] = json_encode($cookies, JSON_THROW_ON_ERROR);
        }

        return $jars;
    }

    /**
     * Import cookie jars left in the legacy shared flow directory by versions
     * that stored them per flow. They are assigned only to the flow owner.
     *
     * @return array<string, string>
     */
    private function importLegacyJars(Flow $flow, string $userId): array
    {
        if ($flow->owner_id !== $userId) {
            return [];
        }

        $legacyDirectory = $flow->getFlowArtifactsBasePath(false).'/cookies';
        $jars = $this->readLocalJars($legacyDirectory);
        if ($jars === []) {
            return [];
        }

        $this->withLockedGeneration($flow, function () use ($flow, $userId, $jars): void {
            foreach ($jars as $filename => $cookies) {
                $profileName = $this->profileNameFromFilename($filename);
                $exists = FlowUserCookieJar::query()
                    ->where('flow_id', $flow->getKey())
                    ->where('user_id', $userId)
                    ->where('jar_name', $profileName)
                    ->exists();
                if (! $exists) {
                    $this->writeProfile($flow, $userId, $profileName, $cookies);
                }
            }
        });
        $this->clearLocalDirectory($legacyDirectory);

        return $jars;
    }

    /**
     * @return array<string, string>
     */
    private function readLocalJars(string $directory): array
    {
        if (! is_dir($directory)) {
            return [];
        }

        $jars = [];
        foreach (glob($directory.DIRECTORY_SEPARATOR.'*.json') ?: [] as $path) {
            if (! is_file($path) || is_link($path)) {
                continue;
            }
            $filename = basename($path);
            $this->profileNameFromFilename($filename);
            $contents = file_get_contents($path);
            if (! is_string($contents)) {
                throw new \RuntimeException("Unable to read cookie jar {$filename}.");
            }
            $decoded = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
            if (! is_array($decoded)) {
                throw new \RuntimeException("Cookie jar {$filename} must contain a JSON array.");
            }
            $jars[$filename] = json_encode($decoded, JSON_THROW_ON_ERROR);
        }
        ksort($jars);

        return $jars;
    }

    private function profileNameFromFilename(string $filename): string
    {
        if (
            $filename === ''
            || basename($filename) !== $filename
            || str_contains($filename, "\0")
            || in_array($filename, ['.', '..'], true)
            || ! str_ends_with(strtolower($filename), '.json')
        ) {
            throw new \RuntimeException('Stored flow cookie profile filename is invalid.');
        }

        $profileName = substr($filename, 0, -5);
        if ($profileName === '') {
            throw new \RuntimeException('Stored flow cookie profile name is invalid.');
        }

        return $profileName;
    }

    private function filenameFromProfileName(string $profileName): string
    {
        return $this->profileNameFromFilename($profileName.'.json').'.json';
    }

    private function clearLocalDirectory(string $directory): void
    {
        if (! is_dir($directory)) {
            return;
        }

        foreach (glob($directory.DIRECTORY_SEPARATOR.'*.json') ?: [] as $path) {
            if (is_file($path) && ! is_link($path)) {
                @unlink($path);
            }
        }
        @rmdir($directory);
    }

    private function ensureLocalDirectory(string $directory): void
    {
        if (! is_dir($directory) && ! mkdir($directory, 0770, true) && ! is_dir($directory)) {
            throw new \RuntimeException('Unable to create the flow cookie workspace.');
        }
    }

    private function writeProfile(Flow $flow, string $userId, string $profileName, string $cookies): void
    {
        $decoded = json_decode($cookies, true, 512, JSON_THROW_ON_ERROR);
        if (! is_array($decoded)) {
            throw new \RuntimeException("Cookie profile {$profileName} must contain a JSON array.");
        }

        FlowUserCookieJar::query()->updateOrCreate(
            ['flow_id' => $flow->getKey(), 'user_id' => $userId, 'jar_name' => $profileName],
            ['cookies' => $decoded],
        );
    }
}
