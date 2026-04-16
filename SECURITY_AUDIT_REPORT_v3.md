# Security & Code Quality Audit — Round 3
**Project:** ClubMGT System
**Date:** 2026-03-30
**Scope:** Full codebase — gym-admin API, edge functions, Flutter mobile app, SQL migrations
**Auditor:** Claude Sonnet 4.6

---

## Round-by-Round Progress Summary

| Area | Round 1 Findings | Round 2 Findings | Round 3 Findings |
|---|---|---|---|
| Hardcoded credentials | 🔴 CRITICAL | ✅ Fixed | — |
| Webhook HMAC bypass | 🔴 CRITICAL | ✅ Fixed | — |
| Weak password generation | 🔴 HIGH | ✅ Fixed (reset-password) | 🔴 HIGH — staff creation still exposes tempPassword in response |
| Debug endpoint | 🔴 HIGH | ✅ Fixed (deleted) | — |
| Public class/FAQ data leak | 🟠 HIGH | ✅ Fixed (RLS) | — |
| N+1 payments GET | 🟠 HIGH | ✅ Fixed (RPC JOIN) | — |
| N+1 send-reminder | — | 🟠 HIGH | ✅ Fixed |
| Missing rate limiting | 🟠 HIGH | ✅ Fixed (send-link, send-reminder, members, refund) | — |
| CORS wildcard edge functions | 🟠 MEDIUM | ✅ Fixed | — |
| MIME type validation (banners) | 🟠 MEDIUM | ✅ Fixed | — |
| Audit log level | 🟡 MEDIUM | ✅ Fixed (console.warn) | — |
| Attendance limit unguarded | 🟡 MEDIUM | ✅ Fixed (cap 1000) | — |
| Middleware public route bypass | 🟡 MEDIUM | ✅ Fixed | — |
| ScreenProtector disabled | 🟡 MEDIUM | ✅ Fixed | — |
| `any` types — payments/members | 🟡 MEDIUM | ✅ Fixed | — |
| `any` types — staff/sessions/trainers | — | — | 🟡 MEDIUM — newly catalogued |
| Broken audit log in staff creation | — | — | 🔴 HIGH — Promise assigned to actor_id |
| pg_cron data retention | 🟡 LOW | ✅ Migration written | ⚠️ Needs manual deploy |
| In-process rate limiter scalability | — | 🟡 LOW (noted) | 🟡 LOW — still present |

---

## 1. CRITICAL Findings

*None in Round 3.*

---

## 2. HIGH Findings

### [R3-01] 🔴 HIGH — `tempPassword` Still Returned in Staff Creation Response

**File:** `gym-admin/app/api/staff/route.ts:110`

**Code:**
```typescript
// TODO: send tempPassword via email (Resend) so it never travels in an API response.
// Until email is wired, return it so the admin can share it manually.
return NextResponse.json({ ...member, tempPassword }, { status: 201 });
```

**Context:** The `reset-password` route (R2-02) was correctly fixed — it now delivers the password via email and returns only `{ success: true }`. However the staff *creation* route (`staff/route.ts`) was not fully fixed — the password generation was upgraded to `randomBytes(16)` but the credential is still sent in the HTTP response body.

**Why it matters:** The temp password travels in the API response where it can be captured by browser devtools, proxy logs, monitoring tools, and network observers. The Resend integration is already present in the codebase (`reset-password` route) — this is a one-route fix.

**Fix:** Mirror the pattern from `reset-password/route.ts`:
```typescript
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

// After staff creation:
await resend.emails.send({
  from: 'noreply@yourdomain.com',
  to: email.trim(),
  subject: 'Your gym staff account has been created',
  html: `<p>Hi ${full_name},</p>
         <p>Your temporary password is: <strong>${tempPassword}</strong></p>
         <p>You will be required to change it on first login.</p>`,
});

return NextResponse.json({ ...member }, { status: 201 }); // no tempPassword
```

---

### [R3-02] 🔴 HIGH — Broken `actor_id` in Staff Creation Audit Log

**File:** `gym-admin/app/api/staff/route.ts:103`

**Code:**
```typescript
await admin.from('audit_logs').insert({
  action:         'staff.created',
  actor_id:       (await (await import('@/lib/supabase/server')).createClient()).auth.getUser().then(r => r.data.user?.id),
  // ↑ This is a Promise, not a resolved value — actor_id will be [object Promise]
  resource_table: 'staff_members',
  resource_id:    member.id,
  gym_id:         gymId,
  metadata:       { email, full_name },
}).catch(() => {}); // silently swallowed — audit failures are invisible
```

**Two problems:**
1. `.then(...)` inside a non-async `.insert()` call — `actor_id` stores `[object Promise]` instead of a UUID
2. `.catch(() => {})` silently swallows failures — broken audit writes are invisible

**Fix:**
```typescript
// resolveGymId() already returns the authenticated user — use it
const { user, gymId } = resolved;

await admin.from('audit_logs').insert({
  action:         'staff.created',
  actor_id:       user.id,          // already resolved
  resource_table: 'staff_members',
  resource_id:    member.id,
  gym_id:         gymId,
  metadata:       { email, full_name },
});
// If this fails, log it — don't swallow silently
```

---

## 3. MEDIUM Findings

### [R3-03] 🟡 MEDIUM — `any` Types in Staff GET, Sessions, Trainers, Schedule Routes

**Affected files and lines:**

| File | Lines | Pattern |
|---|---|---|
| `app/api/staff/route.ts` | 21, 28, 33 | `(s: any)`, `(mr: any)` on Supabase query results |
| `app/api/trainers/route.ts` | 19, 22, 30, 37 | `any[]`, `(t: any)` |
| `app/api/sessions/logs/route.ts` | 37, 44, 54 | `as any[]`, `(p: any)`, `(c: any)` |
| `app/api/sessions/members/route.ts` | 48, 60, 63 | `(m: any)`, `(p: any)`, `as any[]` |
| `app/api/sessions/[id]/cancel/route.ts` | 30, 35, 38, 43, 44 | Multiple `(b: any)`, `(m: any)`, `(p: any)` |
| `app/api/sessions/[id]/bookings/route.ts` | 12, 33, 48 | `(b: any)` |
| `app/api/sessions/[id]/bookings/[bookingId]/route.ts` | 33 | `(b: any)` |
| `app/api/sessions/[id]/checkin/route.ts` | 46 | `(b: any)` |
| `app/api/memberships/[id]/route.ts` | 31–34 | `(membership as any)` |
| `app/api/classes/[id]/route.ts` | 14, 48 | `(c: any)`, `Record<string, any>` |
| `app/api/classes/[id]/checkin/route.ts` | 43 | `(b: any)` |
| `app/api/schedule/publish/route.ts` | 31 | `(c: any)` |
| `app/api/schedule/slots/route.ts` | 26 | `(s: any)` |
| `app/api/schedule/slots/[id]/route.ts` | 27 | `(s: any)` |
| `app/api/payments/[id]/send-invoice/route.ts` | 28 | `(p: any)` |
| `app/api/members/list/route.ts` | 16 | `(m: any)` |
| `app/api/settings/route.ts` | 25 | `Record<string, any>` |
| `app/api/content/announcements/[id]/route.ts` | 10 | `Record<string, any>` |
| `app/api/content/faqs/[id]/route.ts` | 10 | `Record<string, any>` |
| `app/api/content/photos/[id]/route.ts` | 10 | `Record<string, any>` |

**Impact:** Missing types mean TypeScript cannot catch type errors, incorrect field accesses, or schema drift at compile time. Each `(x: any)` is a potential runtime crash.

**Fix pattern — define interfaces per Supabase table:**
```typescript
interface StaffMember {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
}

interface StaffMemberRole {
  staff_id: string;
  role_id: string;
  staff_roles: { id: string; name: string } | null;
}
```

---

### [R3-04] 🟡 MEDIUM — `send-reminder` Loads All Gym Payments Then Filters in JS

**File:** `gym-admin/app/api/payments/send-reminder/route.ts:46`

**Code:**
```typescript
const { data: rows } = await admin.rpc('get_gym_payments', { p_gym_id: gymId });
const allPayments = (rows ?? []) as PaymentRow[];

for (const paymentId of paymentIds) {
  const payment = allPayments.find(p => p.id === paymentId); // JS filter, not DB filter
```

**What was fixed in R2-05:** The inner-loop DB calls (`gym_members` + `profiles`) were eliminated — good.
**What remains:** The entire gym's payment history is fetched, then filtered in JavaScript. A gym with 5,000 payment records transfers all 5,000 to the API server just to match 10–50 IDs.

**Better fix — filter at the DB level:**
```typescript
const { data: rows } = await admin
  .from('payments')
  .select('id, amount, currency, due_date, created_at, full_name, email, member_number')
  .eq('gym_id', gymId)
  .in('id', paymentIds);   // only fetch what we need
```

---

## 4. LOW Findings

### [R3-05] 🔵 LOW — In-Process Rate Limiter Will Not Scale Horizontally

**File:** `gym-admin/lib/rate-limit.ts`

**Code:**
```typescript
const store = new Map<string, WindowEntry>();
```

State is stored per-process. On Vercel (serverless) each invocation may be a fresh process. On multiple container instances, limits are per-instance, not per-gym globally. A determined user can exhaust the limit `N × limit` times by routing to different instances.

**When it matters:** Not a concern on single-instance deploys. Becomes a real bypass on scaled deployments.

**Fix:** Swap the Map for Upstash Redis (`@upstash/ratelimit`) — the interface is identical, requires only env vars `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

---

### [R3-06] 🔵 LOW — Attendance Limit Still High (1000)

**File:** `gym-admin/app/api/attendance/route.ts:14`

**Code:**
```typescript
const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 1000);
```

R2-07 added the cap — that's an improvement. However 1,000 rows per request is still high for an attendance list. No pagination offset is offered, so callers cannot page through results. Suggest reducing default to 50, max to 200, and adding `offset` support.

---

### [R3-07] 🔵 LOW — `audit_logs` Insert Uses Runtime Dynamic Import

**File:** `gym-admin/app/api/staff/route.ts:103`

```typescript
actor_id: (await (await import('@/lib/supabase/server')).createClient()).auth.getUser().then(...)
```

Dynamic imports inside request handlers delay module resolution and create unnecessary overhead. `resolveGymId()` already returns the authenticated `user` object — there is no need to re-fetch it.

---

## 5. Confirmed Fixed — Round 2 Items Verified in Code

| Finding | Verified Location | Evidence |
|---|---|---|
| `randomBytes(16)` in reset-password | `reset-password/route.ts:26` | ✅ `randomBytes(16).toString('base64url')` |
| Email delivery on reset | `reset-password/route.ts:47` | ✅ Resend call present |
| No tempPassword in reset response | `reset-password/route.ts:66` | ✅ `return NextResponse.json({ success: true })` |
| MIME validation banners | `content/banners/route.ts:38–45` | ✅ `allowedMimes` map + check |
| CORS allowlist edge functions | `paymob-*.ts` | ✅ `ALLOWED_ORIGINS` env var |
| N+1 removed from send-reminder | `send-reminder/route.ts:33–56` | ✅ `PaymentRow` interface, no inner DB calls |
| Classes input validation | `classes/route.ts:11–27` | ✅ Name length, classType, color hex, URL |
| Audit log level | `logger.ts:21` | ✅ `console.warn` for audit+warn |
| Attendance limit cap | `attendance/route.ts:14` | ✅ `Math.min(..., 1000)` |
| Middleware public routes | `middleware.ts:59` | ✅ `api/webhooks` excluded |
| ScreenProtector | `main.dart:33–34` | ✅ `preventScreenshotOn()` + `protectDataLeakageWithColor` |
| Rate limit members POST | `members/route.ts:8,73` | ✅ `memberCreateLimiter` (30/min) |
| Rate limit refund | `refund/route.ts:7,14` | ✅ `refundLimiter` (5/min) |
| pg_cron migration written | `data_retention_migration.sql` | ✅ 3 cron jobs (90d/1y/30d) |

---

## 6. Security Scorecard — All Three Rounds

| Category | Round 1 | Round 2 | Round 3 |
|---|---|---|---|
| **Authentication** | 🟡 Partial | ✅ Strong | ✅ Strong |
| **Secrets management** | 🔴 Hardcoded creds | ✅ Env vars only | ✅ No change |
| **Webhook security** | 🔴 HMAC bypassed | ✅ Enforced | ✅ No change |
| **Credential exposure** | 🔴 Math.random + in response | 🟡 Entropy fixed; creation route still leaks | 🔴 Still leaks in creation |
| **Rate limiting** | 🔴 None | ✅ 5 endpoints protected | ✅ No change |
| **Input validation** | 🟡 Partial | 🟡 Payments + members + classes | 🟡 Sessions/trainers uncovered |
| **CORS** | 🟡 Wildcard | ✅ Allowlisted | ✅ No change |
| **Audit logging** | 🔴 None | 🟡 Table exists; broken actor_id | 🔴 actor_id stores Promise |
| **Data retention** | 🔴 None | ✅ Migration written | ⚠️ Not deployed yet |
| **Type safety** | 🔴 Many `any` | 🟡 Core routes cleaned | 🟡 Sessions/staff/trainers remain |
| **Mobile security** | 🟡 Hardcoded keys | ✅ dart-define + ScreenProtector | ✅ No change |
| **Payment security** | 🟡 Partial | ✅ Full audit trail + HMAC | ✅ Strong |
| **Scalability** | 🔴 Unbounded queries | 🟡 Paginated; rate limiting in-process | 🟡 Rate limiter still in-process |

---

## 7. Round 3 Fix Plan (Priority Order)

| # | Severity | Fix | File | Effort |
|---|---|---|---|---|
| R3-01 | 🔴 HIGH | Send staff temp password via email; remove from response | `staff/route.ts` | 20 min |
| R3-02 | 🔴 HIGH | Fix broken `actor_id` in staff creation audit log; remove `.catch(() => {})` | `staff/route.ts` | 10 min |
| R3-04 | 🟡 MEDIUM | Filter send-reminder payments at DB level with `.in('id', paymentIds)` | `send-reminder/route.ts` | 15 min |
| R3-03 | 🟡 MEDIUM | Define interfaces for staff, session, trainer Supabase responses | Multiple routes | 60 min |
| R3-05 | 🔵 LOW | Replace in-process rate limiter with Upstash Redis before multi-instance deploy | `rate-limit.ts` | 30 min |
| R3-06 | 🔵 LOW | Reduce attendance max to 200, add offset pagination | `attendance/route.ts` | 10 min |
| —  | ⚠️ Manual | Deploy `data_retention_migration.sql` (enable pg_cron in Supabase dashboard) | Supabase dashboard | 5 min |
| —  | ⚠️ Manual | Set `ALLOWED_ORIGINS` secret on all 3 edge functions in Supabase dashboard | Supabase dashboard | 5 min |

---

## 8. Recommended Next Steps Beyond Round 3

These are forward-looking — not regressions, but production-readiness gaps:

1. **Sentry error monitoring** — unhandled exceptions are currently silent in production
2. **CSP / HSTS headers** — add `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options` in `next.config.mjs`
3. **Redis rate limiting** — required before horizontal scaling (Upstash Redis)
4. **Flutter offline cache** — cold fetch on every launch; Hive or `shared_preferences` for member profile
5. **TypeScript strict mode** — enable `"strict": true` in `tsconfig.json` to catch remaining type gaps at compile time

---

*Report generated: 2026-03-30*
*Previous reports: SECURITY_AUDIT_REPORT.md (Round 1), SECURITY_AUDIT_REPORT_v2.md (Round 2)*
*Next audit: After Round 3 fixes are applied*
