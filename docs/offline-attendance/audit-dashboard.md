# Offline Attendance — Dashboard (gym-admin) Audit

Scope: `gym-admin/` on branch `feat/offline-attendance` (worktree `/Users/rtg/Desktop/ClubMGTSystem-MT-offline`). Read-only audit, 2026-11-26. Paths are relative to `gym-admin/` unless prefixed. Anything I did not confirm is marked **[unconfirmed]**.

---

## 1. Framework, routing, auth

| Item | Finding |
|---|---|
| Framework | Next **14.2.5** App Router, React 18, Tailwind 3, next-intl 4 (cookie locale, no URL prefix), Sentry (prod only), vitest 4 + happy-dom (`package.json`) |
| Build/serve | `Dockerfile.build` = node:20-alpine multi-stage, `npm ci --include=dev`, `npm run build`, runtime is **`npm start` (not standalone output)**, copies `public/`, `.next/`, full `node_modules`. Built on GitHub Actions (`.github/workflows/build-gym-admin.yml`), pushed to GHCR; `Dockerfile` is a one-line `FROM ghcr.io/...:<sha>` that Coolify pulls. Static assets are served by `next start` itself behind Traefik (no CDN). |
| Token storage | `auth_token` **httpOnly** cookie, `sameSite=lax`, `secure` in prod, 30-day maxAge, path `/` (`app/api/auth/login/route.ts:38-44`). Sanctum tokens never expire server-side unless `SANCTUM_EXPIRATION` is set (`clby-api/config/sanctum.php:53`) **[prod env value unconfirmed]**. |
| Token leak note | Login proxy returns the full Laravel body, **including `token`**, to the browser (`app/api/auth/login/route.ts:37` `NextResponse.json(data)`). The login page ignores it, but JS does see it once. Not a dependency for offline; should be stripped regardless (security follow-up). |
| Logout | `app/api/auth/logout/route.ts`: revokes token at Laravel, clears cookie. `components/sign-out-button.tsx` just POSTs and `router.push('/login')`. **No client-side cleanup hook exists** — needed for offline (see §6). |
| middleware.ts | Redirects any request without `auth_token` to `/login` (`middleware.ts:20-23`), **including `/api/*` routes** (only `api/auth` and `api/webhooks` excluded by the matcher, `middleware.ts:40-42`). So an unauthenticated `fetch('/api/...')` gets a 307 → `/login` HTML **200**, not a 401. Also sets `x-pathname` header for the layout guard. Matcher excludes images/favicon but **not `.js`/`.webmanifest`** → a future `/sw.js` or `/manifest.webmanifest` would be redirected to `/login` for logged-out users. |
| `resolveGymId()` | `lib/api-gym-id.ts:65-97`: reads cookie, calls Laravel `/api/me` (5 s in-memory cache keyed by last 16 token chars), requires role ∈ {gym_admin, trainer, staff} and a `gym_id`; returns `{user, gymId, token}` or a 401/403/503 response. `laravelApi()` (`:102`) forwards `Authorization: Bearer`. gym_id is never client-supplied. |
| Server components | Pages read the cookie and call `${BACKEND_URL}/api/...` directly with a local `fetchApi` helper (duplicated in many pages, e.g. `app/dashboard/attendance/page.tsx:43-55`). All dashboard pages are `force-dynamic`. |
| Client components | Call same-origin Next proxies (`fetch('/api/...')`) — the browser attaches the httpOnly cookie automatically. No client component calls Laravel directly (`NEXT_PUBLIC_API_URL` is referenced only in comments in `lib/api-client*.ts`). |
| Permissions | `lib/get-permissions.ts`: `getMe` / `getStaffPermissions` (React `cache`), gym_admin → `null` (all), staff/trainer → `Permission[]` from `/staff` + `/staff/roles`, fail-closed `[]`. `can()` is **module-level** (any grant on a module = all actions, `:90-93`), mirrors Laravel `CheckPermission`. |
| Layout guard | `app/dashboard/layout.tsx:61-163`: `ALL_NAV` maps routes → modules (`/dashboard/attendance` → `attendance`, `/dashboard/sessions` → `attendance`); staff/trainer redirected to first allowed href. Requires server render (cookie + `/me` + `/staff`), i.e. **online-only**. Layout also fetches `/settings`, `/offers` on every nav, and sets gym timezone (`:233`, default `Africa/Cairo`). |

## 2. Attendance UI inventory

| UI | File | Calls (Next proxy → clby-api) |
|---|---|---|
| Attendance route (server) | `app/dashboard/attendance/page.tsx:57-157` | Direct to Laravel: `GET /attendance?limit=20`, `GET /branches`, `GET /members?per_page=1000&status=active`, `GET /sessions?date=<UTC today>` (`:68-73`). Maps members to `{id, member_number, full_name, plan_type}` (`:95-104`), sessions → `SessionOption` (`:136-144`). This is effectively today's "member cache" — 1000-row cap, no pagination, member `per_page` is uncapped server-side (`clby-api/.../MemberController.php:80`). Uses **UTC** date for "today" (`:72`) — off-by-one near local midnight in Cairo. |
| Attendance page (client) | `components/attendance/attendance-page.tsx` | Tabs `live / logs / services` via `?view=`. Live feed `GET /api/attendance?limit&page` (`:109`), polled every 60 s while visible (`:129-150`). Logs tab `GET /api/attendance?from&to&member_id&access_point&page` (`:161`). Manual button gated by `can(permissions,'attendance','create')` (`:204`); Gym-QR button **not** permission-gated (`:201`). |
| Manual check-in modal | `components/attendance/manual-log-modal.tsx` | Member search is **already fully client-side** over the preloaded `members` prop (`:105-112`) — good base for offline search. Fetches `GET /api/sessions?date=` for non-today dates (`:58`). Client-side plan_type gating of gym vs class options (`:117-119`). Save → `POST /api/attendance` with `{memberId, checkInAt, accessPoint, branchId, classSessionId, specialistName}` (`:125-136`) → proxy `app/api/attendance/route.ts:26-48` → `POST /api/attendance` (`permission:attendance,create`, `clby-api/routes/api.php:335`) with `method:'manual'`. User-chosen `check_in_at` (backdating already possible). Optimistic row inserted via `onSaved` only after server success. |
| Gym QR modal | `components/attendance/gym-qr-modal.tsx` | **Displays** (does not scan) the branch QR via `qrcode.react` `QRCodeSVG`. Payload = `JSON.stringify({type:'gym_access', gym_id, branch_id, token})` (`:70-72`), `token` = static per-branch UUID from `GET /api/branches/{id}/qr-token`, regenerate via `POST` (`:36,54`) → Laravel `GET /branches/{id}/qr-token` (`permission:settings|attendance,view`, `api.php:417`). Unsigned, no expiry → relevant to member_qr (other auditor). |
| Services attendance tab | `components/attendance/services-attendance-tab.tsx` | PT/physio/nutrition session logs: `/api/service-attendance*` (`:151-540`), reverse via `POST /api/service-attendance/{id}/reverse`. Separate domain (service_session_logs) — **out of scope** for offline unless product says otherwise. |
| Member detail → Attendance tab | `app/dashboard/members/[id]/page.tsx:62,71`, `components/members/attendance-tab.tsx`, `member-profile-tabs.tsx` | Read-only; logs eager-loaded in `GET /members/{id}` as `member.attendance_logs` (type `lib/types/attendance-log.ts`). |
| Sessions tracker | `app/dashboard/sessions/page.tsx` | Session balances (`/sessions/members`), not check-in. |
| Dead proxies | `app/api/sessions/[id]/checkin/route.ts`, `app/api/classes/[id]/checkin/route.ts` | **No UI calls them** (grep). Note `/sessions/{id}/checkin` is a *second* backend write path (`SessionController::checkin`, `permission:classes|attendance,edit`, `api.php:302`) — backend auditor should reconcile with `AttendanceController::store`. |

**QR scanning: none.** The dashboard has no camera/scanner code and no scan library (`qrcode.react` is generate-only). `staff_qr` on the dashboard is a net-new feature. Camera is currently **blocked by policy**: `Permissions-Policy: camera=(), microphone=(), geolocation=()` (`next.config.mjs:29`) — `getUserMedia` will fail on every page until this becomes `camera=(self)` (at least for the attendance route).

Backend behaviour the dashboard relies on (`clby-api/app/Http/Controllers/AttendanceController.php:129-300`, details are the backend auditor's): membership validated against **`now()`**, not `check_in_at` (matters for late offline sync); duplicate rule = **only** same member + same `class_session_id`; gym-entry has **no duplicate window**; `branch_id` validated only as `uuid` (no gym ownership check) — must be fixed for sync.

## 3. Branches and permission gating

- **No branch scoping for staff exists anywhere.** `BranchController::index` returns all branches of the gym (`clby-api/.../BranchController.php:12-17`); no staff↔branch table/migration found. Dashboard has **no global branch selector**; branch is a per-form dropdown (manual modal `:41`, QR modal `:22`). So "authorized branches" for the dashboard = all gym branches today. Spec §3/§11 branch restriction therefore has nothing to enforce yet on the dashboard; the cache model should still carry `branch_id` so scoping can be added later **[product decision]**.
- Gating: route guard (layout, module `attendance`), button gate (`can(...,'attendance','create')`), and the real enforcement on Laravel (`permission:attendance,create`). The Next proxies for attendance do **not** call `denyUnlessPermitted` — they rely on Laravel. Fine, but the sync proxy should follow the same pattern (Laravel is the authority).

## 4. PWA readiness

| Item | Status |
|---|---|
| manifest / service worker / next-pwa / workbox / serwist / offline page | **None.** `public/` only has `app-preview/*.webp`. App icon is generated by `app/icon.tsx`. |
| CSP (`next.config.mjs:31-52`) | `default-src 'self'` → `worker-src`/`manifest-src` fall back to `'self'`: a same-origin `/sw.js` is allowed. `connect-src 'self'` + Sentry: sync to same-origin proxy is fine; direct calls to `api.clbyapp.com` would be **blocked** (another reason to sync through the Next proxy). IndexedDB is not governed by CSP. Camera blocked by Permissions-Policy (above). |
| SW scope / headers | A SW at `/sw.js` (from `public/`) gets root scope. Must add `Cache-Control: no-cache` for `/sw.js` in `headers()` and exclude `sw.js`/`manifest.webmanifest`/offline assets from the middleware matcher. |
| Offline renderability | Every dashboard page is `force-dynamic` RSC with server-side data fetches + server permission guard → **cannot render offline**. An offline attendance screen must be a client-rendered shell (static route or SW-cached shell) that reads everything from IndexedDB. i18n messages come from the server (`app/layout.tsx` `getMessages()`), so the shell also needs messages available offline (bundle the `attendance` namespace or cache it). |
| Existing browser storage | `localStorage`: `gym_info` (login page), theme, What's-New, memberships table + financial overview filters; `sessionStorage` for table filters. **No IndexedDB, no `navigator.onLine`, no BroadcastChannel / Web Locks, no `crypto.randomUUID` usage** anywhere in `app/ components/ lib/`. |
| Data-fetching libs | **None** (no SWR / react-query). Plain `fetch` + `useState`; cross-component refresh via `window` event `data-mutated` → `router.refresh()` (`components/mutation-listener.tsx`) and `lib/use-refresh.ts`. |

## 5. Constraints and dependencies

- **`gym-admin/node_modules` in this worktree is a symlink** to `/Users/rtg/Desktop/ClubMGTSystem-MT/gym-admin/node_modules` (the other in-progress worktree). Any `npm install` here mutates the other worktree's deps. Before adding deps: replace the symlink with a real install (`npm ci`) in this worktree.
- **npm 10 lockfile** (lockfileVersion 3): CI runs `npm ci` under node:20 / npm 10. After adding deps, regenerate with `npx npm@10 install --package-lock-only` (memory: `feedback_clby_gymadmin_npm_lock_npm10`).
- **Build network:** the image now builds on GitHub runners (internet available), but no build step may fetch at build time (no `next/font/google`; Sentry wrapper is offline-safe). SW tooling that precaches at build is fine; anything downloading at build is not.
- `typescript.ignoreBuildErrors` is only on for Coolify; GH runner type-checks → new code must type-check.

Dependencies:

| Need | Already present? | Candidate |
|---|---|---|
| IndexedDB wrapper | No | `idb` (~1 KB, promise wrapper) — recommended over Dexie for size; or hand-rolled. |
| IndexedDB in tests | No (happy-dom has no IndexedDB) | `fake-indexeddb` (devDep) |
| UUID v4 | `uuid` exists only transitively (firebase-admin) — do not rely on it | `crypto.randomUUID()` (secure contexts; prod is HTTPS, localhost is secure) — no dep needed |
| Cross-tab lock | No | `navigator.locks` (Chromium/Firefox/Safari 15.4+) with a BroadcastChannel/IDB-lease fallback; no dep |
| Service worker | No | Phase 4: `@serwist/next` (supports Next 14 webpack) or a hand-written `public/sw.js` (simplest given standalone-less `next start`) **[pick in Phase 4]** |
| QR scanning | No | Phase 2/4: native `BarcodeDetector` where available (Chrome/Android; **not Safari/Firefox desktop**) + fallback `jsqr` (pure JS, small) or `@zxing/browser`. `html5-qrcode` is heavier/unmaintained-ish. |

## 6. Gaps vs spec (dashboard)

1. **App shell offline** (Phase 4): manifest, SW precaching `_next/static` + an offline attendance shell route; middleware matcher + Permissions-Policy + `sw.js` cache headers.
2. **IndexedDB stores** (Phase 1): members (+ QR validation key), memberships summary (plan_type, status, end_date, sessions_remaining, freeze, `as_of`), branches, today's+N sessions/classes, recent attendance (dup checks), pending events (outbox), sync metadata / data-age, and a session/identity record. None exist.
3. **Cache download API**: today's data comes from 4 heterogeneous endpoints and a 1000-member cap. A dedicated snapshot endpoint (e.g. `GET /api/attendance/offline-snapshot` with cursor/`updated_since`) is needed **[backend dependency]**. Must not include PII beyond what the check-in UI needs (name, member number, photo URL?).
4. **Sync engine**: nothing. Today, a failed manual POST is simply lost (toast error, modal stays open).
5. **Connection indicator / per-record status / sync summary / failed-event inspector**: nothing; attendance rows have no status concept.
6. **Staff QR scanner**: nothing; plus camera policy.
7. **Auth for offline + sync** — the core problem:
   - The browser **cannot read** the token (httpOnly), and should not. But it doesn't need to: a same-origin `fetch('/api/attendance/sync', {credentials:'same-origin'})` — from a page **or a service worker** — carries the cookie. A Next proxy (`resolveGymId()` → `laravelApi`) forwards it as Bearer. **Recommend: keep the token httpOnly; sync only through a Next proxy.** Background Sync from the SW works with the same cookie.
   - Must detect auth failure correctly: middleware turns a missing cookie into a **redirect to /login (200 HTML)**. The sync client must use `redirect: 'manual'` (or check `res.redirected` / `content-type`) and treat that as `auth_required`, never as success, never deleting events. Better: exclude `/api/attendance/sync` from the middleware redirect so it returns a clean 401.
   - Expired/revoked token (logout elsewhere, staff removed, role change) → 401/403 → events stay `pending` with `last_sync_error='auth'`, engine pauses until a fresh login by the **same user**.
   - **Per-user scoping**: there is no client-readable user identity today except `GET /api/me` (returns `id`, `gym_id`, role). Use a **per-user database name** `clby-offline:{gym_id}:{user_id}` so another account on the same browser opens a different DB and can't read pending events through the app. (Anyone with devtools on the machine can still read IndexedDB — browser storage is not a security boundary; encryption-at-rest with a non-extractable WebCrypto key in IDB only stops casual inspection, not a local attacker. **Decide** whether to encrypt PII fields.)
   - **Logout policy**: today logout just clears the cookie. Needed: before logout, attempt a sync; if pending events remain, warn ("N attendance records not yet synced") and either block or keep them in the user's DB (inaccessible to others, synced on that user's next login). Purge cached member data (not pending events) on logout and on `403`/gym change. Revoked access (403 on snapshot) → purge cache, keep outbox, surface as rejected/blocked.
   - Offline the layout guard can't run: the offline shell must use the last-known permissions snapshot stored in the user's DB, with a max age (spec §12), and re-validate online. Server remains authority (sync endpoint enforces `permission:attendance,create`).

## Phase 1 dashboard proposal (architecture + data foundation)

Goal: pure TS modules + tests, no UI, no SW. All under `gym-admin/lib/offline/` (name TBD), tests under `tests/lib/offline/` (matches `vitest.config.ts` include).

**0. Prereqs:** un-symlink `node_modules` in this worktree; add `idb` (dep) and `fake-indexeddb` (devDep); regenerate lock with npm 10.

**1. Event / outbox model — `lib/offline/types.ts`** (must match the shared contract the backend/Flutter auditors agree on; one JSON shape across platforms):
```ts
type AttendanceMethod = 'staff_qr' | 'member_qr' | 'manual';
type SyncStatus = 'pending' | 'syncing' | 'synced' | 'rejected';
interface AttendanceEvent {
  event_id: string;            // crypto.randomUUID(), idempotency key, immutable
  gym_id: string; branch_id: string | null; member_id: string /* gym_members.id */;
  class_id: string | null;     // = class_session_id in today's API — naming to settle with backend
  attendance_method: AttendanceMethod;
  recorded_by: string;         // profile id of the logged-in user
  actor_type: 'gym_admin' | 'staff' | 'trainer';
  device_id: string;           // per-browser-install UUID stored in IDB meta (not a secret)
  device_recorded_at: string;  // ISO with offset, never overwritten
  device_timezone: string;     // Intl.DateTimeFormat().resolvedOptions().timeZone
  server_received_at: string | null;
  sync_status: SyncStatus; sync_attempts: number; last_sync_error: string | null;
  next_attempt_at: number | null;  // backoff schedule (local only)
  official_attendance_id: string | null; rejection_code: string | null;
  metadata: { access_point?: string; specialist_name?: string; qr_raw_hash?: string; client_version: string };
}
```
Factory `createAttendanceEvent(input, ctx)` validates required fields; event_id/device_recorded_at are frozen at creation.

**2. IndexedDB schema — `lib/offline/db.ts`** (`idb`, DB name `clby-offline:{gym_id}:{user_id}`, versioned upgrades):
- `meta` (key) — device_id, schema version, identity `{user_id, gym_id, role, permissions, fetched_at}`, `last_successful_sync_at`, `snapshot_at`, config (max data age, batch size).
- `members` (key `id`; idx `member_number`, `name_lc`, `qr_key`) — minimal fields only.
- `memberships` (key `id`; idx `member_id`) — plan_type, status, end_date, sessions_remaining, freeze_status, `as_of`.
- `branches` (key `id`), `sessions` (key `id`; idx `date`, `branch_id`).
- `recent_attendance` (key `id`; idx `[member_id, class_id]`, `member_id+day`) — for local dup checks.
- `outbox` (key `event_id`; idx `sync_status`, `[sync_status, device_recorded_at]`, `member_id`) — **events are never deleted by the engine**; synced events kept for a retention window, then pruned by an explicit job.
Data-access module exposes typed functions (`putEvent`, `listDue`, `markSyncing`, `applyResult`, `searchMembers`, `replaceSnapshot`) — UI never touches IDB directly. Snapshot replacement is a single transaction (all-or-nothing).

**3. Sync engine core — `lib/offline/sync-engine.ts`** (transport + lock + clock injected for testing):
- `syncOnce()`: acquire lock → load `pending` (+ `syncing` older than lease = crash recovery) where `next_attempt_at <= now` → order by `device_recorded_at` → batches of N (default 50) → mark `syncing` + `sync_attempts++` → POST → apply **per-event** results: `created|duplicate` → `synced` (+ `official_attendance_id`, `server_received_at`), `rejected` → `rejected` + reason (terminal, visible), anything else stays `pending`.
- Transport errors (offline, timeout, 5xx, 429, redirect-to-login, 401/403): **no event state changes except** back to `pending`, `last_sync_error` set, exponential backoff with jitter (e.g. 2s→5min cap). Auth errors pause the engine (`auth_required`) instead of backing off. Timeout never deletes — retry relies on server idempotency returning the original result.
- Single-flight: in-tab promise memo + cross-tab `navigator.locks.request('clby-attendance-sync', {ifAvailable:true})`; fallback: IDB lease record with expiry. Recovery: `syncing` rows whose lease expired revert to `pending` on start.
- Emits state (`online|offline|syncing|pending|failed|expired`) via a small subscribable store + BroadcastChannel so Phase 2 UI and other tabs stay consistent.
- Triggers are wired in Phase 2 (online event, visibilitychange, screen open, interval); Phase 1 exposes `syncOnce()` and `start()/stop()`.

**4. Client auth to the sync endpoint:** new proxy `app/api/attendance/sync/route.ts` → `resolveGymId()` → `laravelApi('/attendance/sync', token, {method:'POST'})`, passes the body through and returns per-event results unchanged; strips any client `gym_id` override (Laravel derives/validates it). Exclude this route from the middleware redirect (return 401 JSON). Same pattern for `GET /api/attendance/offline-snapshot`. Token stays httpOnly; no token in IDB/localStorage.

**5. Tests (vitest + fake-indexeddb):** event factory (required fields, immutable id/time); DB upgrade + per-user DB isolation; outbox ordering; batch splitting; partial batch results; timeout/5xx → still pending + backoff; redirect/401 → paused, not lost; duplicate result → synced with original id; crash mid-sync (syncing → pending on restart); two engines concurrently → one request (lock); proxy route test in the style of `tests/api/auth.test.ts` (cookie mocked, 401 without cookie, body forwarded).

**What Phase 1 must lay down for later phases:** stable module boundary (`lib/offline/*`) importable from both React and a future SW (no React/Next imports in the core, no `window`-only APIs without guards); device_id + identity in `meta`; status store for the indicator; outbox retention/inspection queries for the failed-events UI; snapshot endpoint contract; the `camera=(self)` and middleware matcher changes noted (can ship in Phase 2/4).

## Risks / open questions

1. **Backend contract** (shared with backend auditor): sync request/response shape, `class_id` vs `class_session_id`, result codes (`created|duplicate|rejected`), and whether a replayed event returns the original `attendance_id`. Dashboard engine depends on it.
2. **Validity time**: backend checks membership at `now()`; an event recorded offline yesterday and synced today may be wrongly rejected/accepted. Need product rule (validate at `device_recorded_at` within bounds?).
3. **Gym-entry duplicate window**: none exists today. Spec forbids inventing one silently → product decision (local Level-1 "rapid repeat" guard only?).
4. **Staff branch scoping** doesn't exist; "authorized branches" = all gym branches. Confirm acceptable.
5. **Member QR payload for staff_qr** (what the member app displays) is not defined on the dashboard side — needs the member-app auditor's finding; offline validation needs a verifiable key in the snapshot.
6. **Snapshot size/PII**: 1000+ members per gym in the browser; decide fields, photo caching (probably not offline), and whether to encrypt at rest.
7. **Offline shell vs RSC**: decide on a dedicated client route (e.g. `/dashboard/attendance/offline` or `/offline/attendance`) outside the server layout guard, with cached permissions + max age.
8. **Safari**: `BarcodeDetector` absent on Safari/desktop Firefox; Background Sync absent on Safari/Firefox → foreground triggers are mandatory (spec already says never rely on background).
9. **Shared node_modules symlink** with the other worktree; dependency changes must not leak across.
10. Security follow-ups found in passing: login proxy echoes the token to the browser (`login/route.ts:37`); `branch_id` not ownership-checked in `AttendanceController::store`; unused `/checkin` proxies.
