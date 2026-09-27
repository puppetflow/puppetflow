<?php

namespace App\Http\Controllers\Mcp;

use App\Http\Controllers\Controller;
use App\Http\Requests\Mcp\McpBrokerAuthorizationRequest;
use App\Http\Requests\Mcp\McpBrokerTokenRequest;
use App\Models\User;
use App\Services\Mcp\McpBrokerDelegationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class McpBrokerController extends Controller
{
    public function __construct(
        private readonly McpBrokerDelegationService $delegation,
    ) {}

    public function showAuthorization(McpBrokerAuthorizationRequest $request): InertiaResponse|RedirectResponse
    {
        $this->delegation->ensureAvailable();

        if (! Auth::check()) {
            return redirect()->route('login', ['redirect' => $request->getRequestUri()]);
        }

        /** @var User $user */
        $user = $request->user();

        return Inertia::render('Auth/McpBrokerAuthorize/McpBrokerAuthorize', [
            'workspaces' => $this->delegation->eligibleWorkspaces($user)
                ->map(fn ($workspace): array => [
                    'id' => (string) $workspace->id,
                    'name' => $workspace->name,
                    'slug' => $workspace->slug,
                ])
                ->values(),
            'parameters' => $request->safe()->only([
                'redirect_uri',
                'state',
                'code_challenge',
                'code_challenge_method',
            ]),
            'userEmail' => $user->email,
            'submitUrl' => route('mcp.broker.approve'),
        ]);
    }

    public function approve(McpBrokerAuthorizationRequest $request): SymfonyResponse
    {
        $this->delegation->ensureAvailable();
        /** @var array{workspace_id: string, redirect_uri: string, state: string, code_challenge: string} $validated */
        $validated = $request->validated();
        /** @var User $user */
        $user = $request->user();

        $code = $this->delegation->createAuthorizationCode(
            $user,
            $validated['workspace_id'],
            $validated['redirect_uri'],
            $validated['code_challenge'],
        );

        $separator = str_contains($validated['redirect_uri'], '?') ? '&' : '?';
        $query = http_build_query([
            'code' => $code,
            'state' => $validated['state'],
        ], '', '&', PHP_QUERY_RFC3986);

        // The page submits through Inertia (XHR): the redirect to the broker is
        // cross-origin, so it must be a full-page navigation via Inertia::location.
        return Inertia::location($validated['redirect_uri'].$separator.$query);
    }

    public function token(McpBrokerTokenRequest $request): JsonResponse
    {
        /** @var array{code: string, code_verifier: string} $validated */
        $validated = $request->validated();
        $result = $this->delegation->exchange($validated['code'], $validated['code_verifier']);

        if ($result === null) {
            return response()->json([
                'error' => 'invalid_grant',
                'error_description' => 'The authorization code is invalid, expired, already used, or does not match the PKCE verifier.',
            ], 400);
        }

        return response()->json($result)
            ->header('Cache-Control', 'no-store')
            ->header('Pragma', 'no-cache');
    }

    public function revoke(Request $request): Response
    {
        $plainToken = $request->bearerToken();
        if (! is_string($plainToken) || ! $this->delegation->revokeAccessToken($plainToken)) {
            return response('', 401)->header('WWW-Authenticate', 'Bearer');
        }

        return response('', 204);
    }
}
