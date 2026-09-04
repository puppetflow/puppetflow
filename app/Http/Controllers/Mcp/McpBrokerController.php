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
use Illuminate\View\View;

class McpBrokerController extends Controller
{
    public function __construct(
        private readonly McpBrokerDelegationService $delegation,
    ) {}

    public function showAuthorization(McpBrokerAuthorizationRequest $request): View|RedirectResponse
    {
        $this->delegation->ensureAvailable();

        if (! Auth::check()) {
            return redirect()->route('login', ['redirect' => $request->getRequestUri()]);
        }

        /** @var User $user */
        $user = $request->user();

        return view('mcp-broker.authorize', [
            'user' => $user,
            'workspaces' => $this->delegation->eligibleWorkspaces($user),
            'parameters' => $request->safe()->only([
                'redirect_uri',
                'state',
                'code_challenge',
                'code_challenge_method',
            ]),
        ]);
    }

    public function approve(McpBrokerAuthorizationRequest $request): RedirectResponse
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

        return redirect()->away($validated['redirect_uri'].$separator.$query);
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
