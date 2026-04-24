FROM php:8.4-cli

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libpq-dev \
    libzip-dev \
    unzip \
    git \
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
    && chmod -R 775 storage bootstrap/cache

# Suppress PHP version in response headers
RUN echo "expose_php = Off" > /usr/local/etc/php/conf.d/security.ini

EXPOSE 8080

# NOTE: artisan serve is for development only. Use PHP-FPM + nginx for production.
CMD php artisan migrate --force --no-interaction && php artisan config:clear && php artisan serve --host=0.0.0.0 --port=8080
