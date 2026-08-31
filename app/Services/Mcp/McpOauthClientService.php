<?php

namespace App\Services\Mcp;

use App\Models\McpOauthClient;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use Laravel\Passport\Client;
use Laravel\Passport\ClientRepository;

final class McpOauthClientService
{
    public function __construct(
        private readonly ClientRepository $passportClients,
    ) {}

    /**
     * @param  list<string>  $redirectUris
     * @return array{client: Client, registration: McpOauthClient}
     */
    public function create(
        Workspace $workspace,
        string $name,
        array $redirectUris,
        ?User $owner = null,
        bool $dynamicallyRegistered = false,
    ): array {
        return DB::transaction(function () use ($workspace, $name, $redirectUris, $owner, $dynamicallyRegistered): array {
            $client = $this->passportClients->createAuthorizationCodeGrantClient(
                $name,
                $redirectUris,
                false,
                $owner,
            );

            $registration = McpOauthClient::create([
                'workspace_id' => $workspace->id,
                'user_id' => $owner?->id,
                'oauth_client_id' => $client->id,
                'name' => $name,
                'redirect_uri' => implode(', ', $redirectUris),
                'dynamically_registered' => $dynamicallyRegistered,
            ]);

            return ['client' => $client, 'registration' => $registration];
        });
    }
}
