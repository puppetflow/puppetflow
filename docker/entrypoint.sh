#!/bin/bash
set -e

has_passport_env_value() {
    local value="${1:-}"
    [[ -n "$value" && "$value" != "null" && "$value" != "(null)" ]]
}

ensure_passport_keys() {
    local private_env=false
    local public_env=false

    has_passport_env_value "${PASSPORT_PRIVATE_KEY:-}" && private_env=true
    has_passport_env_value "${PASSPORT_PUBLIC_KEY:-}" && public_env=true

    if [[ "$private_env" == true && "$public_env" == true ]]; then
        return
    fi

    if [[ "$private_env" != "$public_env" ]]; then
        echo "[entrypoint] PASSPORT_PRIVATE_KEY and PASSPORT_PUBLIC_KEY must be configured together." >&2
        exit 1
    fi

    local private_file="storage/mcp-oauth-private.key"
    local public_file="storage/mcp-oauth-public.key"

    if [[ -f "$private_file" && -f "$public_file" ]]; then
        chmod 600 "$private_file" "$public_file"
        return
    fi

    if [[ -e "$private_file" || -e "$public_file" ]]; then
        echo "[entrypoint] The Passport key pair in storage is incomplete. Restore or remove both key files." >&2
        exit 1
    fi

    echo "[entrypoint] Generating persistent Passport OAuth keys..."
    umask 077
    openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -out "$private_file"
    openssl pkey -in "$private_file" -pubout -out "$public_file"
    chmod 600 "$private_file" "$public_file"
}

# The web container owns first-run initialization. Docker Compose mounts
# /app/storage as a shared persistent volume for every application container.
if [[ "$1" == *"supervisord"* ]]; then
    ensure_passport_keys
fi

# Cache Laravel config with runtime env vars (always, for all containers)
php artisan config:cache

# Web container init
if [[ "$1" == *"supervisord"* ]]; then
    mkdir -p storage/app/public

    if [[ ! -e public/storage && ! -L public/storage ]]; then
        php artisan storage:link
    fi

    php artisan route:cache
    php artisan view:cache

    if [[ "${APP_AUTO_MIGRATE:-false}" == "true" ]]; then
        echo "[entrypoint] Running migrations..."
        php artisan migrate --force
    fi

    echo "[entrypoint] Cleaning up disabled Safe Mode identity..."
    php artisan safe-mode:cleanup

    echo "[entrypoint] Bootstrapping environment license..."
    php artisan license:bootstrap-env

    echo "[entrypoint] Synchronizing entitlements..."
    php artisan entitlements:sync-stale
fi

exec "$@"
