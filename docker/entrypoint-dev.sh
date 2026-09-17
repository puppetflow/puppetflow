#!/bin/bash
set -e

MEDIA_MAX_UPLOAD_BYTES="${MEDIA_MAX_UPLOAD_BYTES:-52428800}"
if [[ ! "$MEDIA_MAX_UPLOAD_BYTES" =~ ^[0-9]+$ ]] || (( MEDIA_MAX_UPLOAD_BYTES < 1024 )); then
    echo "[entrypoint-dev] MEDIA_MAX_UPLOAD_BYTES must be an integer of at least 1024 bytes." >&2
    exit 1
fi
# The API accepts 20 files. Keep one MiB for the multipart envelope.
MEDIA_MAX_REQUEST_BYTES=$((MEDIA_MAX_UPLOAD_BYTES * 20 + 1048576))
export MEDIA_MAX_UPLOAD_BYTES MEDIA_MAX_REQUEST_BYTES

echo "[entrypoint-dev] Clearing bootstrap cache..."
php artisan package:discover --ansi
php artisan config:clear 2>/dev/null || true

if [[ "$*" == *"artisan serve"* ]]; then
    if [[ ! -f bootstrap/nodal-compiler/compiler.mjs || ! -f bootstrap/nodal-compiler/catalog.json ]]; then
        echo "[entrypoint-dev] Building nodal compiler and catalog..."
        npm run build:nodal-compiler
    fi

    if [[ "${APP_AUTO_MIGRATE:-false}" == "true" ]]; then
        echo "[entrypoint-dev] Running migrations..."
        php artisan migrate --force
    fi

    if [[ ! -e public/storage ]]; then
        echo "[entrypoint-dev] Linking public storage..."
        php artisan storage:link
    fi

    echo "[entrypoint-dev] Bootstrapping environment license..."
    php artisan license:bootstrap-env

    echo "[entrypoint-dev] Synchronizing entitlements..."
    php artisan entitlements:sync-stale
fi

exec "$@"
