# CLBY API — Security Fixes (2026-04-14)

Fixes applied in response to a black-box security audit of `https://api.staging.clbyapp.com`.

---

## ISSUE 1 — APP_DEBUG Stack Trace Exposure (CRITICAL)

**Problem:** `APP_DEBUG=true` on the staging server caused full stack traces (file paths, line numbers, class names, middleware stack) to be returned on every error response.

**Fix:** Added production-safe exception rendering in `bootstrap/app.php`:
- 404 → `{"message": "Route not found", "status": 404}`
- 422 → `{"message": "...", "errors": {...}}` (validation field errors only)
- Other HTTP exceptions → message + status code, no internals
- Unhandled exceptions → `{"message": "Server error", "status": 500}` (when `APP_DEBUG=false`)
- Debug mode still works locally for development

**Files changed:** `bootstrap/app.php`

**Deployment requirement:** Ensure `APP_DEBUG=false` and `APP_ENV=production` are set in the Coolify environment variables (not hardcoded in code).

---

## ISSUE 2 — Laravel Welcome Page Exposed

**Problem:** `GET /` returned the default Laravel welcome HTML page, leaking framework version (v13.4.0) and documentation links.

**Fix:** Replaced the welcome view route with a clean JSON response:
```json
{"service": "CLBY API", "status": "ok", "version": "1.0.0"}
```

**Files changed:** `routes/web.php`

---

## ISSUE 3 — PHP Version Leaked via Headers

**Problem:** Response headers included `x-powered-by: PHP/8.4.20`, revealing the exact PHP version.

**Fix:** Enhanced `SecurityHeaders` middleware to:
- Remove `X-Powered-By` and `Server` headers
- Set `X-Frame-Options: DENY`
- Set `X-Content-Type-Options: nosniff`
- Set `Referrer-Policy: strict-origin-when-cross-origin`
- Set `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- Set `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- Set `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`

The middleware is now registered globally (prepended to all middleware) so it runs on every request, not just API routes.

**Files changed:** `app/Http/Middleware/SecurityHeaders.php`, `bootstrap/app.php`

**Note:** PHP-level `expose_php = Off` should also be set in `php.ini` on the server to fully suppress the header at the PHP-FPM level.

---

## ISSUE 4 — Cookie Security Flags Missing

**Problem:** `XSRF-TOKEN` and `clby-session` cookies were missing the `Secure` flag, allowing transmission over plain HTTP.

**Fix:** Updated `config/session.php` defaults:
- `secure` → `env('SESSION_SECURE_COOKIE', true)` (defaults to HTTPS-only)
- `http_only` → `true` (already was)
- `same_site` → `env('SESSION_SAME_SITE', 'strict')` (was `lax`)
- `domain` → `env('SESSION_DOMAIN', '.clbyapp.com')` (covers all subdomains)

**Files changed:** `config/session.php`

**Note:** For local development, set `SESSION_SECURE_COOKIE=false` and `SESSION_DOMAIN=localhost` in your `.env`.

---

## ISSUE 5 — API Routes Verified

**Problem:** Auditor reported all API routes returning 404.

**Finding:** All 184 routes are registered and compile correctly. The 404s were caused by Issue 1 (debug traces making error responses look like misconfiguration) and the auditor testing non-existent paths (e.g., `/api/gyms` instead of `/api/gyms/{id}`).

**Additional fix:** Sanitized the `/api/health` endpoint to no longer leak database table/function counts. It now returns only `{"status": "ok", "timestamp": "..."}`.

**Files changed:** `routes/api.php`

---

## ISSUE 6 — CORS Hardened

**Problem:** `allowed_methods` was set to `['*']` (wildcard). `allowed_origins` defaulted to `http://localhost:3000` only.

**Fix:** Updated `config/cors.php`:
- `allowed_methods` → `['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']`
- `allowed_origins` → defaults to `https://staging.clbyapp.com,https://admin.clbyapp.com` (via `CORS_ALLOWED_ORIGINS` env var)
- `supports_credentials` → `true` (already was)
- `allowed_headers` → `['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']` (already was)

**Files changed:** `config/cors.php`

**Deployment requirement:** Set `CORS_ALLOWED_ORIGINS` in Coolify to the comma-separated list of allowed frontend origins.

---

## ISSUE 7 — Rate Limiting Configured

**Problem:** Auth routes had a permissive `throttle:30,1` (30 req/min) only on login. Register, forgot-password, and reset-password had no rate limiting.

**Fix:**
- Defined named rate limiters in `AppServiceProvider`:
  - `auth` → 5 requests/minute per IP (login, register, forgot-password, reset-password)
  - `contact` → 10 requests/minute per IP
- API default throttle remains at 60 requests/minute (set in `bootstrap/app.php`)
- All auth routes now share the `throttle:auth` middleware group

**Files changed:** `app/Providers/AppServiceProvider.php`, `routes/api.php`

---

## Deployment Checklist

Ensure these environment variables are set on the Coolify staging/production server:

```env
APP_ENV=production
APP_DEBUG=false
CORS_ALLOWED_ORIGINS=https://staging.clbyapp.com,https://admin.clbyapp.com
SESSION_DOMAIN=.clbyapp.com
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=strict
```

Also verify in `php.ini`:
```ini
expose_php = Off
```
