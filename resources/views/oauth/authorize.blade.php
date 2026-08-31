<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    @php($branding = app(\App\Contracts\BrandingProvider::class)->current())
    @php($mcpClient = \App\Models\McpOauthClient::with('workspace')->where('oauth_client_id', $client->id)->first())
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Connect {{ $branding['name'] }}</title>
    <link rel="icon" href="{{ $branding['logo_url'] }}">
    <style>
        :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
        * { box-sizing: border-box; }
        body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #0f1513; color: #f3f7f5; }
        main { width: min(100%, 520px); padding: 32px; border: 1px solid #2b3934; border-radius: 18px; background: #17201d; box-shadow: 0 24px 70px rgb(0 0 0 / 28%); }
        .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
        .brand img { width: 42px; height: 42px; border-radius: 10px; object-fit: contain; }
        h1 { margin: 0 0 12px; font-size: 24px; line-height: 1.25; }
        p { margin: 0 0 18px; color: #b9c7c1; line-height: 1.55; }
        .details { margin: 22px 0; padding: 16px; border-radius: 12px; background: #101714; }
        .details strong, .details span { display: block; }
        .details span { margin-top: 5px; color: #9eada7; font-size: 14px; }
        ul { margin: 10px 0 0; padding-left: 20px; color: #cdd8d3; }
        .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 26px; }
        button { width: 100%; border: 0; border-radius: 10px; padding: 12px 16px; font: inherit; font-weight: 650; cursor: pointer; }
        .approve { background: #48c591; color: #092117; }
        .deny { background: #2a3531; color: #e6ece9; }
        .identity { margin-top: 18px; font-size: 13px; color: #899791; text-align: center; }
    </style>
</head>
<body>
    <main>
        <div class="brand">
            <img src="{{ $branding['logo_url'] }}" alt="">
            <strong>{{ $branding['name'] }}</strong>
        </div>

        <h1>Authorize {{ $client->name }}</h1>
        <p>This application is requesting access to the MCP tools enabled in your workspace.</p>

        <div class="details">
            <strong>{{ $mcpClient?->workspace?->name ?? 'Puppetflow workspace' }}</strong>
            <span>The client can only use tools and flows allowed by your Puppetflow permissions.</span>
            @foreach ($client->redirect_uris as $redirectUri)
                <span>Redirect: {{ parse_url($redirectUri, PHP_URL_HOST) ?? $redirectUri }}</span>
            @endforeach
            @if (count($scopes) > 0)
                <ul>
                    @foreach ($scopes as $scope)
                        <li>{{ $scope->description }}</li>
                    @endforeach
                </ul>
            @endif
        </div>

        <p>Only continue if you trust this client. You can revoke the connection later from Workspace Settings.</p>

        <div class="actions">
            <form method="POST" action="{{ route('passport.authorizations.deny') }}">
                @csrf
                @method('DELETE')
                <input type="hidden" name="auth_token" value="{{ $authToken }}">
                <button class="deny" type="submit">Cancel</button>
            </form>
            <form method="POST" action="{{ route('passport.authorizations.approve') }}">
                @csrf
                <input type="hidden" name="auth_token" value="{{ $authToken }}">
                <button class="approve" type="submit">Authorize</button>
            </form>
        </div>

        <div class="identity">Signed in as {{ $user->email }}</div>
    </main>
</body>
</html>
