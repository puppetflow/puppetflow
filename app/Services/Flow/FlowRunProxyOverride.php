<?php

namespace App\Services\Flow;

use App\Models\FlowTrigger;

/**
 * Per-run proxy selection that replaces the flow proxy settings.
 * Built from the manual run form or from a trigger configured with its own proxy.
 */
final readonly class FlowRunProxyOverride
{
    public const MODES = ['none', 'auto', 'specific'];

    public function __construct(
        public string $mode,
        public ?int $workspaceProxyId = null,
    ) {}

    /** @param array<string, mixed> $data */
    public static function fromRequest(array $data): ?self
    {
        $mode = $data['proxy_mode'] ?? null;
        if (! is_string($mode) || ! in_array($mode, self::MODES, true)) {
            return null;
        }
        $proxyId = $data['workspace_proxy_id'] ?? null;

        return new self(
            $mode,
            $mode === 'specific' && is_numeric($proxyId) ? (int) $proxyId : null,
        );
    }

    public static function fromTrigger(FlowTrigger $trigger): ?self
    {
        $mode = $trigger->proxy_mode;
        if (! is_string($mode) || ! in_array($mode, self::MODES, true)) {
            return null;
        }

        return new self(
            $mode,
            $mode === 'specific' ? $trigger->workspace_proxy_id : null,
        );
    }
}
