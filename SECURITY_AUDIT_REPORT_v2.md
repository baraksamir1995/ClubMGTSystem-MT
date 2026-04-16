# ClubMGT System — Security & Code Quality Audit Report v2

**Date:** 2026-03-30
**Round:** 2 (Post-Fix Re-Audit)
**Auditor:** Senior Security Engineer / Backend Architect / Code Quality Reviewer
**Classification:** CONFIDENTIAL
**Files Reviewed:** 39

---

## 1. Executive Summary

### Score Comparison

| Metric | Round 1 | Round 2 | Delta |
|---|---|---|---|
| **Overall Health Score** | **42 / 100** | **74 / 100** | +32 ✅ |
| Critical Issues | 3 | 0 | -3 ✅ |
| High Issues | 5 | 2 | -3 ✅ |
| Medium Issues | 7 | 6 | -1 ✅ |
| Low Issues | 7 | 4 | -3 ✅ |
| **Total Issues** | **22** | **12** | **-10** ✅ |

### What Changed

The most dangerous issues have been resolved. The three critical vulnerabilities — hardcoded credentials compiled into the JS bundle, a completely bypassed payment webhook signature check, and an unauthenticated debug endpoint exposing full PII — are all gone. The codebase is now in a defensible state for staging. Two high-severity issues remain that must be fixed before production.

---

## 2. Issues Resolved Since Round 1

| ID | Title | Was | Now |
|---|---|---|---|
| SEC-01 | Hardcoded credentials in next.config.mjs | 🔴 Critical | ✅ Fixed |
| SEC-02 | HMAC validation bypassed in webhook | 🔴 Critical | ✅ Fixed |
| SEC-03 | Debug endpoint exposing full PII | 🔴 Critical | ✅ Fixed |
| SEC-04 | 6-digit Math.random() password reset | 🟠 High | ✅ Fixed |
| SEC-05 | No UNIQUE constraint on paymob_transaction_id | 🟠 High | ✅ Fixed |
| SEC-06 | RLS cross-tenant leak on classes + faqs | 🟠 High | ✅ Fixed |
| SEC-07 | Hardcoded Supabase credentials in Flutter | 🟠 High | ✅ Fixed |
| SEC-08 | Hardcoded gym UUID fallback in guest mode | 🟡 Medium | ✅ Fixed |
| SEC-09 | No audit trail for refunds | 🟢 Low | ✅ Fixed |
| QA-01 | No structured logging | 🟡 Medium | ✅ Fixed |
| QA-02 | `any` types in payments route | 🟡 Medium | ✅ Fixed |
| QA-03 | No pagination on members endpoint | 🟡 Medium | ✅ Fixed |
| QA-04 | N+1 query in payments GET | 🟢 Low | ✅ Fixed |
| QA-05 | No rate limiting on payment endpoints | 🟠 High | ✅ Fixed |
| QA-06 | No automated dependency updates | 🟢 Low | ✅ Fixed |

---

## 3. Security Findings (Round 2)

---

### [SEC-01] ✅ FIXED — Temp Password Returned in API Response

**File:** `gym-admin/app/api/staff/[id]/reset-password/route.ts`

**Resolution:** Temp password is now generated with `randomBytes(16).toString('base64url')` (128-bit entropy), delivered via Resend email to the staff member's address, and the API response returns only `{ success: true }`. An entry is written to `audit_logs` with `action: 'staff.password_reset'` for every reset.

---

### [SEC-02] 🟠 HIGH — Weak Password Generation in Staff Creation Route

**File:** `gym-admin/app/api/staff/route.ts:43`

**Code:**
```typescript
const tempPassword = String(Math.floor(100000 + Math.random() * 900000));
```

**Why it's risky:**
`Math.random()` is not cryptographically secure. The 6-digit numeric password has only ~900,000 possible values — brute-forceable in seconds. This was already fixed in `reset-password/route.ts` but the staff **creation** route still uses the old pattern.

**Fix:**
```typescript
import { randomBytes } from 'crypto';
const tempPassword = randomBytes(16).toString('base64url');
```

---

### [SEC-03] 🟡 MEDIUM — Banner Upload Does Not Validate File Type

**File:** `gym-admin/app/api/content/banners/route.ts`

**Code:**
```typescript
const ext = file.name.split('.').pop() ?? 'jpg';
const path = `${gymId}/banners/${Date.now()}.${ext}`;
```

**Why it's risky:**
The file extension is extracted from the user-supplied filename — not from the actual file content. An attacker could upload `malware.php` and have it stored as-is. Even if the Supabase storage bucket doesn't execute server-side code, this file could be served to other users.

**Fix:**
```typescript
const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
if (!allowedMimes.includes(file.type)) {
  return NextResponse.json({ error: 'Only JPEG, PNG, or WebP images are allowed' }, { status: 400 });
}
const mimeToExt: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};
const ext  = mimeToExt[file.type];
const path = `${gymId}/banners/${Date.now()}.${ext}`;
```

---

### [SEC-04] 🟡 MEDIUM — CORS Wildcard on All Edge Functions

**Files:** `supabase/functions/paymob-webhook/index.ts`, `paymob-intention/index.ts`, `paymob-refund/index.ts`

**Code:**
```typescript
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
  };
}
```

**Why it's risky:**
`*` allows any website in the world to make cross-origin requests to these functions. While Paymob webhooks don't need CORS (server-to-server), the intention and refund functions are called from your Flutter app and admin frontend, and should only accept requests from known origins.

**Fix:**
```typescript
const ALLOWED_ORIGINS = [
  'https://youradmindomain.com',
  'https://yoursupabaseproject.supabase.co',
];

function corsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}
```

---

### [SEC-05] 🟡 MEDIUM — Staff Password Reset Not Written to audit_logs

**File:** `gym-admin/app/api/staff/[id]/reset-password/route.ts:32`

**Code:**
```typescript
console.log(JSON.stringify({ level: 'audit', action: 'staff.password_reset', staffId: params.id, actorId: 'system', ts: Date.now() }));
```

**Why it's risky:**
Console logs are ephemeral — they exist only in the server process and are not queryable. If you need to investigate who reset a staff member's password and when, there is no durable record.

**Fix:**
```typescript
await admin.from('audit_logs').insert({
  action:         'staff.password_reset',
  actor_id:       user.id,
  resource_table: 'staff_members',
  resource_id:    params.id,
  gym_id:         gymId,
  metadata:       { must_reset_password: true },
});
```

---

### [SEC-06] 🟡 MEDIUM — Missing Input Validation on Classes Endpoint

**File:** `gym-admin/app/api/classes/route.ts`

**Code:**
```typescript
const { name, classType, description, instructor, trainerId } = await req.json();
// proceeds directly to DB insert with no validation
```

**Why it's risky:**
Unvalidated strings can contain excessively long content that hits database column limits silently, HTML that gets rendered as XSS if displayed in a webview, or null values that cause runtime errors downstream.

**Fix:**
```typescript
if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
  return NextResponse.json({ error: 'Class name must be 2–100 characters' }, { status: 400 });
}
if (description && description.length > 1000) {
  return NextResponse.json({ error: 'Description must be 1000 characters or fewer' }, { status: 400 });
}
```

---

### [SEC-07] 🟡 MEDIUM — No Certificate Pinning in Flutter App

**File:** `gym_mobile_flutter/pubspec.yaml`

`flutter_secure_storage` is present but no certificate pinning package is configured. The `http_certificate_pinning` package is listed in Dependabot groups, indicating intent, but it is not yet installed or used.

**Why it's risky:**
On a compromised network (hotel WiFi, corporate proxy), a MITM attacker with a rogue CA certificate installed on the device can intercept all Supabase traffic including auth tokens and member data.

**Fix (pubspec.yaml):**
```yaml
dependencies:
  http_certificate_pinning: ^1.0.0
```

**Fix (main.dart):**
```dart
// Before Supabase.initialize()
await CertificatePinning.check(
  serverURL: Env.supabaseUrl,
  headerHttp: {},
  sha: SHA.SHA256,
  allowedSHAFingerprints: [
    'YOUR_SUPABASE_CERT_FINGERPRINT_HERE',
  ],
);
```

---

### [SEC-08] 🟡 MEDIUM — Rate Limiting is Single-Instance Only

**File:** `gym-admin/lib/rate-limit.ts`

```typescript
// Limitation: state is per-process. If you scale to multiple instances,
// replace this with Upstash Redis rate limiting.
```

The rate limiter works correctly for a single Next.js process. If you ever run two or more server instances (horizontal scaling, Vercel edge, etc.), each instance has its own independent counter — meaning the effective limit becomes `10 × number_of_instances`.

**Fix (when scaling):** Replace with Upstash Redis:
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis }     from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis:   Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
});
```
The interface is identical — no other changes needed.

---

### [SEC-09] 🟡 MEDIUM — Middleware Does Not Exclude Public API Routes

**File:** `gym-admin/middleware.ts:50-60`

**Code:**
```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

Every request — including `/api/schedule/public/[gymId]` — goes through the auth middleware. This route is intentionally public (no auth needed for members to view the gym schedule), but the middleware still runs an auth check and could block it unnecessarily.

**Fix:**
```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/schedule/public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

---

### [SEC-10] 🟢 LOW — TypeScript and ESLint Errors Silently Ignored

**File:** `gym-admin/next.config.mjs:3-4`

```typescript
typescript: { ignoreBuildErrors: true },
eslint:     { ignoreDuringBuilds: true },
```

This means the build succeeds even if there are type errors. Type errors can hide security-relevant logic bugs (wrong type assumptions, missing null checks, incorrect API contract handling).

**Fix:**
```typescript
const isCI = process.env.CI === 'true';
typescript: { ignoreBuildErrors: !isCI },
eslint:     { ignoreDuringBuilds: !isCI },
```
This keeps local dev fast while ensuring CI/CD catches errors before deployment.

---

### [SEC-11] 🟢 LOW — GDPR: No Hard Delete / Data Retention Policy

**File:** `gym-admin/app/api/members/[id]/route.ts`

Members are soft-deleted (`deleted_at` timestamp) but never permanently removed. There is no retention policy or GDPR "right to erasure" implementation.

**Fix:** Add a scheduled Supabase pg_cron job:
```sql
-- Hard delete member records soft-deleted more than 7 years ago
SELECT cron.schedule(
  'purge-deleted-members',
  '0 2 1 * *', -- 2am on the 1st of every month
  $$
    DELETE FROM public.gym_members
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - interval '7 years';
  $$
);
```

---

### [SEC-12] 🟢 LOW — Paymob Webhook Matching Window is Too Wide

**File:** `supabase/functions/paymob-webhook/index.ts:78`

```typescript
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
```

The 2-hour window is a safety net for slow webhooks, but it's wide enough that if a member makes two separate payments within 2 hours, the wrong payment record could theoretically be matched.

**Fix:** Reduce to 30 minutes and add amount matching as an additional guard:
```typescript
const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
let query = supabase
  .from('payments')
  .select('id, status')
  .eq('gym_id', gym_id)
  .eq('amount', obj.amount_cents / 100) // amount must match
  .is('paymob_transaction_id', null)
  .gte('created_at', thirtyMinsAgo)
  .order('created_at', { ascending: false })
  .limit(1);
```

---

## 4. Code Quality Findings (Round 2)

---

### [QA-01] 🟡 MEDIUM — send-reminder Route Still Uses `any` Types

**File:** `gym-admin/app/api/payments/send-reminder/route.ts:22-28`

```typescript
const allPayments = (rows ?? []) as any[];
// ...
const payment = allPayments.find((p: any) => p.id === paymentId);
```

The `get_gym_payments` RPC now returns typed data including `full_name` and `email` — the reminder route should use those directly instead of fetching member + profile separately in a loop.

**Fix:** Use the enriched RPC data directly:
```typescript
const allPayments = (rows ?? []) as Array<{
  id: string;
  gym_member_id: string;
  amount: number;
  currency: string;
  due_date: string | null;
  created_at: string;
  full_name: string | null;
  email: string | null;
  member_number: string | null;
}>;
```
And remove the inner `gym_members` + `profiles` fetches — they are now redundant.

---

### [QA-02] 🟡 MEDIUM — send-reminder Has N+1 Query Inside a Loop

**File:** `gym-admin/app/api/payments/send-reminder/route.ts:31-34`

```typescript
for (const paymentId of paymentIds) {
  // ...
  const { data: gm } = await admin.from('gym_members')...  // DB call inside loop
  const { data: pr } = await admin.from('profiles')...     // DB call inside loop
}
```

For N payment IDs, this makes 2N database calls. Since `get_gym_payments` now returns `full_name` and `email` directly, these inner queries are entirely unnecessary.

**Fix:** Remove the inner DB calls and read directly from the enriched `allPayments` array.

---

### [QA-03] 🟡 MEDIUM — Attendance Endpoint Has No Upper Limit Guard

**File:** `gym-admin/app/api/attendance/route.ts:14`

```typescript
const limit = parseInt(searchParams.get('limit') ?? '100');
```

The limit has a default of 100 but no maximum cap. A caller could pass `?limit=999999` and receive a potentially huge dataset in one response.

**Fix:**
```typescript
const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10)));
```

---

### [QA-04] 🟢 LOW — logger.ts `audit` Level Emits to `console.log`

**File:** `gym-admin/lib/logger.ts`

```typescript
function emit(level: 'info' | 'warn' | 'error' | 'audit', ...) {
  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.log(entry); // audit goes here — same as info
}
```

Audit entries are emitted via `console.log`, identical to info logs. Log aggregators (Datadog, CloudWatch) cannot distinguish them by severity.

**Fix:**
```typescript
else if (level === 'audit') console.warn(entry); // treat as warn so it surfaces
```
Or emit to `console.error` so audit events are always captured in error streams.

---

### [QA-05] 🟢 LOW — No Rate Limiting on Members POST

**File:** `gym-admin/app/api/members/route.ts`

The members creation endpoint has no rate limiting. A script could create thousands of phantom auth users in Supabase, exhausting your MAU quota.

**Fix:**
```typescript
const memberCreateLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

// Inside POST handler, after resolveGymId:
const rl = memberCreateLimiter.check(`create-member:${gymId}`);
if (!rl.allowed) {
  return NextResponse.json({ error: 'Too many members created. Please slow down.' }, { status: 429 });
}
```

---

### [QA-06] 🟢 LOW — Screen Recording Protection Installed but Not Activated

**File:** `gym_mobile_flutter/pubspec.yaml` + `gym_mobile_flutter/lib/main.dart`

`screen_protector: ^1.5.1` is in the dependencies but never initialized. The app can be screen-recorded or screenshotted, exposing member PII and payment data.

**Fix:**
```dart
import 'package:screen_protector/screen_protector.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  Env.validate();

  if (!Env.isStaging) {
    await ScreenProtector.protectDataLeakageWithBlur(true);
  }

  // ... rest of init
}
```

---

## 5. Architecture Review (Round 2)

### What Improved

| Area | Round 1 | Round 2 |
|---|---|---|
| Credential management | Hardcoded in source | Fully env-driven |
| Webhook security | HMAC bypassed | Enforced, returns 401 |
| Audit trail | None | audit_logs table + refund entries |
| Database performance | N+1 on payments | Single JOIN via RPC |
| API safety | No rate limiting | Sliding window on payment endpoints |
| Dependency management | Manual | Dependabot weekly PRs |
| Flutter config | Hardcoded URLs | --dart-define compile-time flags |
| Logging | Scattered console.log | Structured JSON via logger.ts |

### Remaining Architecture Gaps

**1. No centralized input validation layer**
Each route validates inputs differently or not at all. A shared validation middleware or a `parseBody(schema, req)` helper would enforce consistent validation and remove the copy-paste pattern.

**2. Flutter SupabaseService is still a god object**
`supabase_service.dart` is 1,800+ lines handling 15+ distinct domains. This makes it untestable and causes merge conflicts on every feature. Splitting into `AuthService`, `MemberService`, `PaymentService`, `ClassService` etc. should be a planned sprint.

**3. No background job system**
Membership expiry checks, overdue payment reminders, and data retention purges have no scheduled execution. Supabase pg_cron is available and free — it should be configured.

**4. No error monitoring**
There is no Sentry, Datadog, or equivalent. Errors surface only in server logs. Production incidents will be difficult to diagnose without error aggregation and alerting.

---

## 6. Performance Review (Round 2)

| Issue | Round 1 | Round 2 |
|---|---|---|
| N+1 on payments GET | 3 DB round-trips | 1 JOIN via RPC ✅ |
| Unbounded members list | All rows returned | Page/limit/total ✅ |
| No indexes on hot queries | Missing | Added on payments + members ✅ |
| Attendance limit unguarded | No max | Capped at 1000 ✅ |
| Flutter: no local cache | Cold fetch every launch | Still no cache ⚠️ |
| send-reminder: N+1 in loop | — | Fixed — uses enriched RPC fields ✅ |

---

## 7. Quick Wins (Round 2)

These can each be fixed in under 30 minutes:

| # | Fix | File | Time |
|---|---|---|---|
| 1 | Replace `Math.random()` in staff creation | `app/api/staff/route.ts:43` | 5 min |
| 2 | Write password reset to `audit_logs` | `reset-password/route.ts` | 10 min |
| 3 | Add MIME type check to banner upload | `content/banners/route.ts` | 15 min |
| 4 | Add max cap to attendance limit | `attendance/route.ts:14` | 2 min |
| 5 | Exclude public routes from middleware matcher | `middleware.ts` | 5 min |
| 6 | Fix `audit` log level in logger.ts | `lib/logger.ts` | 2 min |
| 7 | Enable ScreenProtector in main.dart | `lib/main.dart` | 10 min |
| 8 | Remove N+1 from send-reminder loop | `send-reminder/route.ts` | 20 min |
| 9 | Add input validation to classes POST | `api/classes/route.ts` | 15 min |

---

## 8. Compliance Status (Round 2)

| Standard | Round 1 | Round 2 |
|---|---|---|
| **OWASP Top 10** | A02, A05, A07 failures | A05 partially resolved; A02 (encryption) remains |
| **GDPR** | No erasure policy, PII unencrypted | Soft delete in place; pg_cron hard-delete jobs added (30d members, 90d audit, 1y attendance) ✅ |
| **PCI DSS** | Webhook signature bypassed | Webhook enforced; audit trail added |
| **SOC 2** | No audit logging, no incident procedures | audit_logs table live; monitoring still absent |

---

## 9. Round 2 Fixes Applied (this sprint)

All quick wins from Round 2 have been resolved:

| # | Fix | Status |
|---|---|---|
| 1 | `Math.random()` → `randomBytes(16)` in staff creation | ✅ Fixed |
| 2 | Temp password delivered via email only, never in response | ✅ Fixed |
| 3 | Write password resets to `audit_logs` | ✅ Fixed |
| 4 | MIME type validation on banner upload | ✅ Fixed |
| 5 | CORS allowlist on edge functions | ✅ Fixed |
| 6 | Fix N+1 in send-reminder | ✅ Fixed |
| 7 | Input validation on classes endpoint | ✅ Fixed |
| 8 | Attendance limit capped at 1000 | ✅ Fixed |
| 9 | Exclude public routes from middleware matcher | ✅ Fixed |
| 10 | `audit` log level → `console.warn` | ✅ Fixed |
| 11 | ScreenProtector enabled in Flutter | ✅ Fixed |
| 12 | Rate limiting on members POST (30/min) and refund (5/min) | ✅ Fixed |
| 13 | pg_cron data retention jobs (GDPR compliance) | ✅ Migration ready |

## 10. Recommended Next Sprint

In priority order:

1. **Add Sentry error monitoring** — essential before production; unhandled exceptions are currently silent
2. **Run `data_retention_migration.sql`** — enable pg_cron in Supabase dashboard first
3. **Set `ALLOWED_ORIGINS` secret** on all three edge functions in Supabase dashboard
4. **Flutter local cache** — add offline-first support with Hive or shared_preferences
5. **PII encryption at rest** — encrypt email/phone in `profiles` table for OWASP A02 compliance
6. **Redis-backed rate limiting** — swap in-memory `Map` for Upstash Redis before multi-instance deploy
7. **Content Security Policy headers** — add CSP, HSTS, X-Frame-Options in `next.config.mjs`

---

*Report generated: 2026-03-30*
*Round 1 report: SECURITY_AUDIT_REPORT.md*
*Round 2 fixes completed: 2026-03-30*
*Next recommended audit: After next sprint completion*
