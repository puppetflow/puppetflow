<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AddSecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $contentType = strtolower((string) $response->headers->get('Content-Type', ''));
        $isPdfPreview = $request->routeIs('media.preview')
            && str_starts_with($contentType, 'application/pdf');
        $response->headers->set(
            'Content-Security-Policy',
            $isPdfPreview
                ? "frame-ancestors 'self'"
                : "base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
        );
        $response->headers->set('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', $isPdfPreview ? 'SAMEORIGIN' : 'DENY');

        if ($request->isSecure() && app()->isProduction()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000');
        }

        return $response;
    }
}
