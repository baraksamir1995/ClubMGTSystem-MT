FROM php:8.4-fpm

# Install system dependencies + nginx + supervisor.
# We run nginx and php-fpm side-by-side under supervisor so the container
# exposes a single port (8080) for Coolify's health-check / proxy.
RUN apt-get update && apt-get install -y \
    libpq-dev \
    libzip-dev \
    unzip \
    git \
    nginx \
    supervisor \
    && docker-php-ext-install pdo pdo_pgsql pgsql zip pcntl posix \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Copy composer files first for caching
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-scripts --no-interaction

# Copy app
COPY . .

# Run post-install scripts
RUN composer dump-autoload --optimize

# Storage permissions
RUN mkdir -p storage/framework/{sessions,views,cache/data} \
    && chmod -R 775 storage bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

# Suppress PHP version in response headers
RUN echo "expose_php = Off" > /usr/local/etc/php/conf.d/security.ini

# PHP-FPM pool tuning. Each worker holds one persistent PDO connection
# (see config/database.php). Keep worker count below the Postgres
# max_connections cap (default 100) by a healthy margin.
COPY docker/php-fpm/www.conf /usr/local/etc/php-fpm.d/www.conf

# nginx site config — proxies all requests to PHP-FPM via FastCGI.
COPY docker/nginx/default.conf /etc/nginx/sites-available/default
RUN ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default \
    && rm -f /etc/nginx/sites-enabled/default.dpkg-dist 2>/dev/null || true

# supervisord boots both daemons and forwards stdout/stderr to container logs
# so Coolify can pick them up.
COPY docker/supervisor/supervisord.conf /etc/supervisor/supervisord.conf

# Container entrypoint — runs migrations + warm caches once, then hands
# off to supervisor. Migrations are idempotent so a multi-container
# deploy in the future would still be safe (only one will win the lock).
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8080

CMD ["/usr/local/bin/entrypoint.sh"]
