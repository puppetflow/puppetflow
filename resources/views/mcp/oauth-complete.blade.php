<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ ($authorized ?? true) ? 'MCP authorization complete' : 'MCP authorization not completed' }}</title>
    <style>
        :root {
            color-scheme: light dark;
            font-family: ui-sans-serif, system-ui, sans-serif;
        }

        body {
            min-height: 100vh;
            margin: 0;
            display: grid;
            place-items: center;
            color: #172033;
            background: #f7f8fb;
        }

        main {
            width: min(420px, calc(100vw - 48px));
            padding: 32px;
            text-align: center;
            border: 1px solid #dfe3eb;
            border-radius: 18px;
            background: #fff;
            box-shadow: 0 18px 55px rgba(25, 34, 52, 0.09);
        }

        .icon {
            width: 48px;
            height: 48px;
            margin: 0 auto 20px;
            display: grid;
            place-items: center;
            border-radius: 50%;
            color: #15803d;
            background: #dcfce7;
            font-size: 25px;
            font-weight: 700;
        }

        .icon.error {
            color: #b42318;
            background: #fee4e2;
        }

        h1 {
            margin: 0 0 10px;
            font-size: 21px;
        }

        p {
            margin: 0;
            color: #667085;
            font-size: 14px;
            line-height: 1.55;
        }

        @media (prefers-color-scheme: dark) {
            body {
                color: #f3f4f6;
                background: #111827;
            }

            main {
                border-color: #344054;
                background: #1f2937;
                box-shadow: none;
            }

            p {
                color: #aab2c0;
            }
        }
    </style>
</head>
<body>
    <main>
        @if ($authorized ?? true)
            <div class="icon" aria-hidden="true">✓</div>
            <h1>Authorization complete</h1>
            <p>Your MCP connection is ready. You can close this tab and return to Puppetflow.</p>
        @else
            <div class="icon error" aria-hidden="true">×</div>
            <h1>Authorization not completed</h1>
            <p>{{ $message }}</p>
            <p>You can close this tab and return to Puppetflow.</p>
        @endif
    </main>
</body>
</html>
