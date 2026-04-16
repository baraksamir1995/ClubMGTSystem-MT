# Security Remediation Report

**Date:** 2026-04-13
**Scope:** CLBY Gym Management Admin Dashboard (Next.js + Supabase)
**Auditor findings:** 7 confirmed vulnerabilities (2 Critical, 2 High, 3 Medium)

---

## CRITICAL-1: RLS Disabled / Overly Permissive on Multiple Tables

**Risk:** Unauthenticated or cross-tenant data access.

**What was changed:**

| File | Change |
|------|--------|
| `supabase/migrations/security_rls_hardening.sql` | New migration |

**Details:**
- **Dropped** `gyms_anon_read_active` policy — removed unauthenticated access to all gym records (owner_id, email, phone, saas_tier, branding exposed)
- **Dropped** `membership_plans_anon_select` policy — removed unauthenticated access to plan pricing
- **Replaced 10 `USING (true)` policies** with gym-scoped alternatives on: `check_ins`, `member_memberships`, `plan_branches`, `recurring_session_templates`, `schedule_settings`, `staff_member_roles`, `staff_role_permissions`, `membership_transfer_logs`, `gym_banners`
- **`saas_tiers`** — changed from open to authenticated-only (reference data, read-only)

**Verification:** After running the migration, test with the anon key:
```bash
curl "https://<project>.supabase.co/rest/v1/gyms?select=*" \
  -H "apikey: <anon_key>"
# Should return empty array or 401, not gym data
```

---

## CRITICAL-2: Database Schema Leaked via PostgREST Error Hints

**Risk:** Attackers can enumerate table names, column names, and relationships.

**What was changed:**

| File | Change |
|------|--------|
| `gym-admin/lib/sanitize-error.ts` | New utility |

**Details:**
- Created `safeErrorResponse()` utility that logs full error details server-side but returns sanitized messages to clients
- Strips PostgREST hint patterns: "perhaps you meant", "relation does not exist", "column does not exist", constraint violations, permission errors
- All API routes should use `safeErrorResponse(error, 500)` instead of `NextResponse.json({ error: error.message })`

**Migration path:** Existing routes currently forward raw `error.message`. Gradually migrate each route to use `safeErrorResponse()`. Priority routes: any publicly accessible or high-traffic endpoints.

---

## HIGH-1: Login Page Cached for 1 Year by CDN

**Risk:** Stale login pages served from CDN, potential session fixation.

**What was changed:**

| File | Change |
|------|--------|
| `gym-admin/next.config.mjs` | Added `headers()` config |

**Details:**
- `/login` and `/change-password` routes now return `Cache-Control: no-store, no-cache, must-revalidate, private`
- Prevents CDN proxies (Cloudflare, Vercel Edge) from caching auth pages

---

## HIGH-2: All Security Headers Missing

**Risk:** XSS, clickjacking, MIME sniffing, SSL downgrade attacks.

**What was changed:**

| File | Change |
|------|--------|
| `gym-admin/next.config.mjs` | Added security headers to all routes |

**Headers added:**
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy` with restrictive `default-src 'self'`, `frame-ancestors 'none'`

**Note:** CSP includes `'unsafe-inline'` and `'unsafe-eval'` for script-src to maintain Next.js compatibility. Tighten after testing with nonce-based CSP.

---

## MEDIUM-1: Framework Fingerprinting via `x-powered-by: Next.js`

**Risk:** Targeted CVE exploitation based on framework identification.

**What was changed:**

| File | Change |
|------|--------|
| `gym-admin/next.config.mjs` | `poweredByHeader: false` |

---

## MEDIUM-2: Login Error Response Enumeration Risk

**Risk:** Attackers can distinguish "user not found" from "wrong password" to enumerate valid accounts.

**What was changed:**

| File | Change |
|------|--------|
| `gym-admin/app/login/page.tsx` | Normalized error message |

**Details:**
- All Supabase Auth errors now show `"Invalid email or password."` regardless of the underlying cause
- Previously forwarded the raw `error.message` which could differ between invalid email and wrong password

---

## MEDIUM-3: No Rate Limiting on Auth Endpoint

**Risk:** Brute-force password attacks.

**What was changed:**

| File | Change |
|------|--------|
| `gym-admin/middleware.ts` | Added login rate limiter |

**Details:**
- In-memory sliding window rate limiter: 10 requests per minute per IP on POST to `/login`
- Returns HTTP 429 when exceeded
- Supabase Auth also has built-in rate limits (configured in dashboard under Auth > Rate Limits)

**Recommendations for production:**
1. Enable Supabase Auth rate limits in dashboard (5 sign-in attempts per 15 minutes per IP)
2. Consider adding hCaptcha or Cloudflare Turnstile to the login form
3. For multi-instance deployments, replace in-memory limiter with Redis-based (@upstash/ratelimit)

---

## Files Changed Summary

| File | Findings Addressed |
|------|-------------------|
| `supabase/migrations/security_rls_hardening.sql` | CRITICAL-1 |
| `gym-admin/lib/sanitize-error.ts` | CRITICAL-2 |
| `gym-admin/next.config.mjs` | HIGH-1, HIGH-2, MEDIUM-1 |
| `gym-admin/app/login/page.tsx` | MEDIUM-2 |
| `gym-admin/middleware.ts` | MEDIUM-3 |

---

## Remaining Recommendations

1. **Gradually migrate all API routes** to use `safeErrorResponse()` from `lib/sanitize-error.ts`
2. **Tighten CSP** — remove `'unsafe-eval'` from script-src after testing, implement nonce-based CSP
3. **Add Turnstile/hCaptcha** to login form for production
4. **Audit Supabase Auth settings** — ensure email confirmations, password strength requirements, and sign-in rate limits are configured
5. **Review RLS policies quarterly** — any new table must have gym-scoped policies before deployment
