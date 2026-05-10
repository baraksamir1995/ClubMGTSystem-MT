#!/bin/sh
# Container entrypoint. Runs once per container start.
#
# 1. Apply pending migrations (idempotent — Laravel's migration table
#    plus FOR UPDATE locking ensures only one container wins if multiple
#    boot in parallel).
# 2. Warm config + route caches so first requests don't pay the
#    bootstrap cost.
# 3. Hand off to supervisord which starts php-fpm and nginx.

set -e

cd /app

echo "[entrypoint] Running migrations..."
php artisan migrate --force --no-interaction || {
    echo "[entrypoint] Migration failed — aborting boot." >&2
    exit 1
}

echo "[entrypoint] Warming caches..."
php artisan config:cache
php artisan route:cache
php artisan event:cache

echo "[entrypoint] Starting supervisord (php-fpm + nginx)..."
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf
