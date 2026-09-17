<?php

namespace App\Http\Middleware;

use App\Models\ApiKey;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApiKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! $token) {
            return response()->json(['error' => 'API key required.'], 401);
        }

        $hashedKey = hash('sha256', $token);
        $apiKey = ApiKey::where('key', $hashedKey)->first();

        if (! $apiKey || ! $apiKey->user) {
            return response()->json(['error' => 'Invalid API key.'], 401);
        }

        $apiKey->update(['last_used_at' => now()]);

        $request->setUserResolver(fn () => $apiKey->user);
        // Also expose the key owner to Gate::authorize() calls made by shared services.
        Auth::setUser($apiKey->user);

        return $next($request);
    }
}
