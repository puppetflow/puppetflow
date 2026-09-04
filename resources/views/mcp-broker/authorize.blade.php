<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    @php($branding = app(\App\Contracts\BrandingProvider::class)->current())
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Connect {{ $branding['name'] }}</title>
    <link rel="icon" href="{{ $branding['logo_url'] }}">
    <style>
        :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
        * { box-sizing: border-box; }
        body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #0f1513; color: #f3f7f5; }
        main { width: min(100%, 560px); padding: 32px; border: 1px solid #2b3934; border-radius: 18px; background: #17201d; box-shadow: 0 24px 70px rgb(0 0 0 / 28%); }
        .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
        .brand img { width: 42px; height: 42px; border-radius: 10px; object-fit: contain; }
        h1 { margin: 0 0 12px; font-size: 24px; line-height: 1.25; }
        p { margin: 0 0 18px; color: #b9c7c1; line-height: 1.55; }
        .workspace-list { display: grid; gap: 10px; margin: 22px 0; }
        .workspace { display: flex; align-items: center; gap: 13px; padding: 15px 16px; border: 1px solid #33433d; border-radius: 12px; background: #101714; cursor: pointer; }
        .workspace:hover { border-color: #48c591; }
        .workspace input { width: 18px; height: 18px; accent-color: #48c591; }
        .workspace strong, .workspace span { display: block; }
        .workspace span { margin-top: 3px; color: #899791; font-size: 13px; }
        .notice { margin: 22px 0; padding: 16px; border-radius: 12px; background: #101714; color: #cdd8d3; line-height: 1.5; }
        .error { margin: 0 0 18px; color: #ffaaa3; }
        button { width: 100%; border: 0; border-radius: 10px; padding: 12px 16px; background: #48c591; color: #092117; font: inherit; font-weight: 650; cursor: pointer; }
        button:disabled { cursor: not-allowed; opacity: .5; }
        .identity { margin-top: 18px; font-size: 13px; color: #899791; text-align: center; }
    </style>
</head>
<body>
    <main>
        <div class="brand">
            <img src="{{ $branding['logo_url'] }}" alt="">
            <strong>{{ $branding['name'] }}</strong>
        </div>

        <h1>Connect to Central MCP Broker</h1>
        <p>Choose the workspace that the broker may access on your behalf.</p>

        @if ($errors->any())
            <div class="error">{{ $errors->first() }}</div>
        @endif

        <form method="POST" action="{{ route('mcp.broker.approve') }}">
            @csrf
            @foreach ($parameters as $name => $value)
                <input type="hidden" name="{{ $name }}" value="{{ $value }}">
            @endforeach

            @if ($workspaces->isEmpty())
                <div class="notice">No eligible MCP workspace is available. Ask a workspace administrator to enable MCP access.</div>
            @else
                <div class="workspace-list">
                    @foreach ($workspaces as $workspace)
                        <label class="workspace">
                            <input
                                type="radio"
                                name="workspace_id"
                                value="{{ $workspace->id }}"
                                @checked(old('workspace_id', $workspaces->first()?->id) === $workspace->id)
                            >
                            <span>
                                <strong>{{ $workspace->name }}</strong>
                                <span>{{ $workspace->id }}</span>
                            </span>
                        </label>
                    @endforeach
                </div>
            @endif

            <div class="notice">
                The broker will receive a revocable MCP access token tied to your account and the selected workspace.
            </div>

            <button type="submit" @disabled($workspaces->isEmpty())>Authorize broker</button>
        </form>

        <div class="identity">Signed in as {{ $user->email }}</div>
    </main>
</body>
</html>
