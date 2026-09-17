<?php

namespace App\Services\Mcp;

use App\Services\Security\PublicHttpTargetGuard;
use Illuminate\Validation\ValidationException;

/** Applies the MCP client network policy to every URL the client or the OAuth flow contacts. */
final class McpTargetGuard
{
    public function __construct(private readonly PublicHttpTargetGuard $targets) {}

    /**
     * HTTP client options pinning the URL to its resolved address; rejects the URL with a 422 when the policy denies it.
     *
     * @return array<string, mixed>
     */
    public function requestOptions(string $url): array
    {
        try {
            return $this->targets->requestOptions(
                $url,
                allowPrivateAddresses: (bool) config('puppetflow.mcp_client_allow_private', false),
                allowHttp: (bool) config('puppetflow.mcp_client_allow_http', false),
            );
        } catch (\InvalidArgumentException $exception) {
            throw ValidationException::withMessages(['endpoint' => $exception->getMessage()]);
        }
    }
}
