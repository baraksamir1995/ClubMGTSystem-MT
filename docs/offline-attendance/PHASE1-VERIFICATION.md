# Offline Attendance — Phase 1 independent verification (2026-11-26)

Scope: commits `0147a13` (API), `8c7f027` (Flutter package + apps), `80ef594` (dashboard) on `6a6eb2d`.
Method: all suites run; clients driven against a real clby-api (`:8082`, Postgres `clby_offline`, started with `ATTENDANCE_OFFLINE_ENABLED=true ATTENDANCE_OFFLINE_ALLOW_MEMBER_QR=true PHP_CLI_SERVER_WORKERS=6`); Next proxy exercised on `:3002`; code review of the diff. Confirmed classes load from this worktree (`ReflectionClass(AttendanceSyncService)` → `…-offline/clby-api/app/Services/…`).

## Verdict

The backend core holds up: idempotency, tenant isolation, per-event authorization, the advisory-lock concurrency and timeout-after-commit all behaved correctly under live load. Both client engines map results correctly against the real JSON.

Phase 1 should **not** be signed off as is: three high-severity integration defects were found. None is visible in any single stack's unit tests.

## Test counts

| Suite | Result |
|---|---|
| `clby-api php artisan test` | **254 passed** (1077 assertions) |
| `gym-admin npx vitest run` | **271 passed** (20 files) |
| `gym-admin npx tsc --noEmit -p .` | clean (exit 0) |
| `packages/clby_offline flutter test` | **96 passed** |
| `gym_mobile_flutter flutter test` | 14 passed |
| `coaches_mobile_flutter flutter test` | 2 passed |
| NEW live dashboard→API `gym-admin/tests/integration/offline-live.test.ts` | 5/5 passed (skipped unless `OFFLINE_LIVE_API` is set) |
| NEW live Flutter→API `packages/clby_offline/test/integration_live_test.dart` | 4/4 scenarios passed (skipped unless `CLBY_LIVE=1`) |

## Findings (ranked)

### HIGH-1 — Shared device id + first-user device binding: the second user on a browser or phone can never sync (verified live)

- **Where:** `gym-admin/lib/offline/db.ts:146-178`, `packages/clby_offline/lib/src/identity/device_identity.dart:33`, `clby-api/app/Http/Controllers/AttendanceOfflineController.php:63-99`.
- **The mismatch:**
  - The dashboard device id is deliberately **per browser, shared by users**. Its own test asserts this: `db.test.ts` "device id is per browser (shared by users)".
  - The Flutter device id is per install.
  - The server binds `attendance_devices.id` to the **first** (user, gym) that syncs. Any other user gets `403 device_mismatch`.
- **Repro (live):**
  - joe syncs with device D → 200.
  - aya (same gym, staff) with D → `403 {"code":"device_mismatch"}`.
  - barak with D → 403.
  - Dashboard engine: `stoppedBy: device_revoked` (the live test "shared reception browser"); events stay `pending` forever.
  - Flutter: the engine pauses `deviceRevoked`; `resumeAfterAuth()` gets the same 403. There is no recovery path and no rebind/revoke API.
  - `/offline/status` reports `registered:false, revoked:false`, so the client cannot tell why it is stuck.
- **Impact:**
  - Front-desk PCs are shared by several staff, the primary dashboard use case.
  - It also hits phone hand-overs, account switches, and gym switches (the binding includes `gym_id`).
- **Fix:** pick one model.
  - **Option A:** key the binding by (device_id, user_id): composite PK, or bind on the first sync per user.
  - **Option B:** derive the client device id per (gym, user) scope.
  - In either case, return a distinct pause reason for `device_mismatch` (the dashboard folds anything containing "device" into `device_revoked`; `sync-engine.ts:314-318`).
  - Add a live cross-stack test.

### HIGH-2 — Android: the package's secure storage options will clobber the apps' auth token (code reading of plugin source; not run on a device)

- **The two configurations:**
  - `packages/clby_offline/lib/src/security/key_store.dart:19-22` uses `AndroidOptions(encryptedSharedPreferences: true)`.
  - Both apps use the default `FlutterSecureStorage()` (plain). Examples: `gym_mobile_flutter/lib/providers/auth_provider.dart:12`, splash, popups, rating, and the coach app equivalents.
- **Why that breaks:** in flutter_secure_storage 9.2.4, a call with `encryptedSharedPreferences=true` runs `checkAndMigrateToEncrypted()` (`FlutterSecureStorage.java` ~219-235). That moves **every** plain entry into EncryptedSharedPreferences, removes it from plain prefs, and removes the cipher markers.
- **Trigger:** `DeviceIdentity.load()` → `SecureKeyStore.read` runs in `main()` before auth restore.
- **Expected effect:** logout on every Android cold start, plus loss of branding, onboarding and rating state.
- **Fix:**
  - Use the same (default) AndroidOptions as the apps, or a separate `sharedPreferencesName`.
  - Verify on an Android device before any release.

### HIGH-3 — The member_qr sync path ignores policy and widens the static-QR hole: backdated self check-ins up to 7 days (code + live)

- **Where:** `AttendanceSyncService.php:347-392`, `config/attendance_offline.php` (`allow_member_qr_offline=false`, `enabled=false` by default). BACKEND-NOTES deviation 3.
- **Online path today:** `POST /attendance/qr` records `now()`.
- **Sync path:** `POST /attendance/sync` is live on deploy regardless of `enabled` / `allow_member_qr_offline`. It accepts any member holding a v1 branch token (a static poster UUID that anyone can photograph) with `device_recorded_at` anywhere in the past 7 days. Validity is checked as of current values.
- **Effect:** a member can fabricate gym entries for days they never came, from home, without any client change, even though the policy says member QR offline is disabled.
- Staff `manual` backdating already exists online (`check_in_at`), but members and coaches gain a new backdating capability:
  - `service_session` accepts backdated PT sessions, with the 30-min guard relative to the claimed time.
- **Fix:**
  - When `allow_member_qr_offline=false`, reject new `member_qr` events with `offline_disabled`. Keep D9's "don't strand data" for events recorded before a policy change, e.g. compare against a `policy_changed_at`.
  - Or cap member_qr backdating (e.g. ≤ max_data_age).
  - Rate-limit member_qr per member per day.
  - **Recommendation:** do not deploy the route with member_qr enabled server-side until Phase 3 (signed QR).

### MEDIUM-1 — Dashboard proxy turns any `/api/me` failure (5xx, 429, timeout) into 401 → engine pauses `auth_required`

- **Where:** `gym-admin/lib/api-gym-id.ts:35-38` (`fetchMe` returns null for any non-OK), used by `lib/attendance-offline-proxy.ts:42`.
- **Effect:**
  - A backend blip or the global 300/min limiter makes the engine pause as if logged out (`sync-engine.ts:570-575`).
  - It stays paused until `resume()` or a reload, during an outage window, which is exactly when offline matters.
- **Fix:** distinguish 401 from other statuses in `fetchMe` (return 503 for 5xx/429/network) for the offline proxies at least.

### MEDIUM-2 — Flutter recorder accepts events the server will always reject on clock skew (verified live)

- **Where:** `packages/clby_offline/lib/src/recorder/offline_event_recorder.dart` `record()`.
- With the device clock at +1 h or −8 d, `record()` saves the event; the server rejects it (`clock_in_future` / `event_too_old`) permanently.
- The stored `clock_offset_ms` is never used. A phone running >5 min fast loses every visit.
- The dashboard recorder has the same gap (`recorder.ts`).
- **Fix:** warn or refuse at record time using the server offset, or stamp the server-corrected time as evidence alongside.

### MEDIUM-3 — Flutter anti-double-tap drops a valid member QR scanned right after a bad one (verified live)

- A garbage QR was recorded, then a valid branch token 3 s later → `RecordDuplicate(doubleTap)`.
- The garbage scan is later rejected `qr_invalid`, so the member has no record.
- **Cause:** the double-tap identity (`offline_event_recorder.dart` ~L330) ignores `qr_raw`, and member_qr rows have no `branch_id`.
- **Fix:** include `qr_raw` or the parsed branch in the identity.

### MEDIUM-4 — Flutter D9 check-then-send race on account switch (code reading)

- **Where:** `sync_engine.dart:225` checks `transport.authenticatedUserId` once per pass, then sends up to 200 batches. `ApiService._headers` reads the *current* token at send time.
- If A logs out and B logs in during A's pass, A's remaining batches go out with B's token.
- For member_qr the server forces self, so A's visits are recorded as B's.
- **Fix:** re-check per batch, and bind the token to the transport instance per scope.

### MEDIUM-5 — Conflicting event ids leave no audit trail (BACKEND-NOTES deviation 2)

- `event_id_conflict` and `event_id_reused` are returned but not persisted anywhere. SPEC §7 requires "keep audit trail of conflicting events".
- A replay attack or client bug is invisible server-side.
- **Fix:** write a `staff_activity_logs` row, or an `attendance_event_conflicts` table: actor, device, hash, time.

### LOW

1. **Bucket and assignment dates are emitted as UTC instants of local midnight.**
   - Example: `end_date "2027-07-25T21:00:00.000Z"` for `2027-07-26 00:00+03`. Source: `AttendanceOfflineController.php:426-427` via `isoOrNull`.
   - Clients store the raw strings. Any future UI doing `substring(0,10)` shows the end date one day early.
   - Fix: emit `YYYY-MM-DD` in gym tz, or specify this in CONTRACT.
2. **`device_recorded_at` = `2026-02-30T10:00:00Z` passes the regex and Carbon overflows it to 2 Mar.**
   - It is rejected as `event_too_old` instead of `invalid_payload` (live). Same root for any impossible date within the window → silently shifted.
   - Fix: strict `DateTime::createFromFormat` / `date` validation.
3. **Rate limiter key includes the client-chosen `device_id`.**
   - Rotating ids bypasses the 30/min limit (live: 32/32 = 200 with rotating ids vs 30 + 2×429 with a fixed id).
   - Each new id also inserts an `attendance_devices` row (unbounded).
   - Still capped by the global 300/min. Fix: key by user, or cap devices per user.
4. **422 envelope (and proxy 413) is treated as transient by both engines.**
   - The batch retries with backoff forever (`sync-engine.ts:585-600`, Flutter `SyncRequestError`). Never terminal or visible.
   - Low likelihood with generated UUIDs.
5. **Flutter `SyncState.lastError` becomes null after a 403 pause.**
   - `_runPass` finally overwrites `sync_engine.dart:340`.
   - No app calls `resumeAfterAuth()`, so a 401 pause lasts until re-login or restart.
   - Offline errors are only logged in debug builds.
6. **Coach-variant error message "This assignment belongs to a different coach."** confirms another trainer's assignment id exists (IDOR oracle; low because ids are UUIDs).
7. **Member check-in with no subscription and no transfer is allowed** (`gymEntryDenialForBranch` returns null).
   - Pre-existing parity with online `logByQr`, but BACKEND-NOTES describes the rule as "active, paid … subscription", which it is not.
8. **Admin bootstrap repeats `recent_attendance` (up to 10,000 rows) and `class_sessions` on every page.**
   - The coach bootstrap aggregates `MAX(delivered_at)` over the entire `service_session_logs` table per request. Performance only.
9. **Dashboard proxy `MAX_SYNC_BODY_BYTES` compares `raw.length` (UTF-16 units), not bytes.** Trivial.
10. **The dashboard offline lib is not wired anywhere** (no UI, no `logoutOffline` on logout). This is consistent with Phase 1 scope.
    - Phase 2 must call `logoutOffline` before the logout proxy clears the cookie, or cached member data persists in IndexedDB.
    - IndexedDB is readable by any user of the same browser profile via devtools; this is accepted in PHASE1-PLAN, restated here.
11. **Flutter build: `hooks.user_defines.sqlite3.source: sqlite3mc` downloads binaries at build time** (needs network); sqlite3/drift sit beside sqflite. Not built/verified. Run `flutter clean` before `flutter build ipa`.
12. **`attendance_events` FK `ON DELETE SET NULL` → a hard-deleted attendance row replays as `event_replayed` with `attendance_id: null`.** Acceptable, but worth documenting.

## BACKEND-NOTES deviations — judgement

| # | Deviation | Verdict |
|---|---|---|
| 1 | Replay of stored non-accepted result unchanged | Acceptable (client mapping identical). |
| 2 | `event_id_conflict` / `event_id_reused` not stored | **Not acceptable as is**: needs some audit (MEDIUM-5). |
| 3a | `not_self` never emitted (member forced to self) | Acceptable. |
| 3b | `offline_disabled` never emitted; `allow_*` / `enabled` client-only | **Not acceptable for member_qr** (HIGH-3); acceptable for staff manual. |
| 4 | Extra columns | Acceptable. |
| D2 | Current status/freeze/payment, not historical | Acceptable and documented. |
| Online paths without member advisory lock | Pre-existing race | Acceptable for Phase 1; note it for Phase 5. |

## Security review summary (what held)

- **Tenant isolation:**
  - `tenant_mismatch` for a foreign gym_id.
  - The other gym's admin claiming their own gym but sending our member → `member_not_found`, no leak.
  - Other gym's QR token → `qr_wrong_gym`.
  - Branch, class_session and studio are all gym-scoped.
- **Per-event authz (live):**
  - Staff without the attendance module → `permission_denied`.
  - Coach / member sending manual → denied.
  - Admin sending member_qr / service_session → denied.
  - Member sending service_session → denied.
  - Coach with another trainer's assignment → denied.
- **Bootstrap authz:**
  - member → 403.
  - Staff without the attendance module → 403.
  - Trainer without an active profile → 403.
  - The coach variant lists only the trainer's own assignments.
  - The Next proxy forces `X-App: admin` and drops `app=`.
- **`event_id_conflict`:** returns no ids or timestamps of the original. Event ids are v4 UUIDs, so they cannot be enumerated.
- **No injection or mass assignment:** no raw SQL with user input (advisory-lock keys are bound parameters); explicit column maps, so no mass assignment.
- **Advisory locks:** xact-scoped (PgBouncer-safe), taken in a consistent order (event → member).
- **`middleware.ts` carve-out:**
  - It only changes redirect → JSON 401 when *no* cookie is present, on exact paths.
  - Live: `/api/attendance` still → 307 /login; `../` and `%2e%2e` traversal → 307 /login.
  - An invalid cookie → 401 from `resolveGymId`.
  - It cannot reach anything unauthenticated.
- **Proxy header forwarding:** allowlisted, length-capped; the token never reaches the browser.
- **Flutter scoping and keys:**
  - The DB file and key are per sha256(api|gym|user).
  - A wrong or missing key never regenerates or wipes the file (verified on a real sqlite3mc file).
  - Logout keeps the outbox.
  - X-* headers go only to the own API.
- **Online regression:**
  - `store()` was diffed against `6a6eb2d`. The rules, order, messages and status codes are identical. The only changes are GREATEST→CASE (same integer result) and a null 8th `logActivity` arg (the parameter's default).
  - `CoachController::decrement` was moved verbatim and responds `{data: …}` with the same keys.
  - `logByQr` is only refactored into the service.
  - Covered by `AttendanceStoreRegressionTest`, `CoachDecrementRegressionTest`, and the full suite (254 green).

## Live cross-stack results

**Dashboard engine → API**, using `lib/offline/*` with fetch transport and bearer:

- **Bootstrap (limit=2, forced paging):** member count = DB count (3).
- **Record and sync:** manual events for every cached member, plus a staff_qr class event → all resolved (synced with UUID `official_id` = `attendance_logs.id` for `source_event_id`, or rejected `no_active_subscription` for the member whose plan lapsed).
- **Resend after forced pending:** `event_replayed`, same ids, still 1 row each.
- **Transport loses the response after commit:** row `pending`, server 1 row. Forced `syncing` then recover → `event_replayed`, 1 row.
- **Bad token:** paused `auth_required`, row untouched (attempts 0).
- **Shared device:** paused, stuck (HIGH-1).
- **500 events:** 10 batches × 50, 500 synced, 500 rows, 1 each.

**Raw API (python):**

- Clock rules:
  - +290 s accepted, +1 h `clock_in_future`.
  - −6 d accepted, −8 d `event_too_old`.
  - Missing offset → `invalid_payload`.
  - Same id with a different payload → `event_id_reused`.
- 8 parallel identical requests → 1 created + 7 replayed, 1 row.
- 8 parallel distinct events for the same member and class from 8 devices → 1 created + 7 `already_checked_in` (same existing id), 1 row, `sessions_remaining` 13→12 (one decrement).
- Socket closed right after sending → server committed 1 row; retry → `event_replayed`, same id.
- 1 ms client timeout → retry → `event_replayed`, 1 row.

**Next proxy (`:3002`, cookie auth):**

- No cookie → JSON 401 `auth_required` (sync + bootstrap).
- Member cookie → 403.
- Admin: status, bootstrap and sync all 200 with verbatim results.
- Bad JSON → 422 `invalid_envelope`.
- Bad envelope → Laravel 422 passed through.

**Flutter package → API:** see the HIGH-1 / HIGH-2 and MEDIUM-2/3/4 sections; the 4/4 scenarios themselves passed.

- **Coach:** bootstrap, then service_session accepted with `official_id` = `service_session_logs.id`; replay → same id; IDOR → rejected.
- **Member:** `/me`, then member_qr JSON form and bare token accepted (1 row each); foreign → `qr_wrong_gym`; garbage → `qr_invalid`.
- **Recovery:** kill mid-sync / lost response → recovered, same ids.
- **Auth:** 401 → paused, untouched.
- **Contract conformance:** status, bootstrap (admin + coach), me and sync all match CONTRACT §2–3 field by field. Timestamps are UTC ms `Z`. The only mismatches:
  - `member_number` is an int (both clients coerce).
  - `full_name` / class `name` can be null while the TS types say `string`.
  - Date fields (LOW-1).

## Acceptance (PHASE1-PLAN §3.4)

| Item | Result | Evidence |
|---|---|---|
| All new tests green | PASS | 96 package, dashboard offline tests within 271, new API Attendance tests within 254 |
| Full existing API suite green | PASS | 254/254 |
| `store()` responses unchanged | PASS | diff review vs `6a6eb2d` + regression tests |
| One event → one row under replay | PASS | live, both clients + raw API |
| One event → one row under concurrent duplicate | PASS | live 8× parallel identical; 8 distinct same class → 1 row |
| One event → one row under timeout-after-commit | PASS | live socket drop, 1 ms timeout, lossy transports (both stacks) |
| Cross-tenant events rejected | PASS | live `tenant_mismatch`, `member_not_found`, `qr_wrong_gym` |
| Pending events survive DB reopen (dashboard) | PASS | `db.test.ts` "survive closing and reopening" |
| Pending events survive DB reopen (Flutter) | PASS | `database_test.dart` persist across reopen (encrypted file) + live kill-mid-sync |
| *(implicit)* Clients can actually sync in realistic multi-user use | **FAIL** | HIGH-1 |
| *(implicit)* App auth unaffected by the package on Android | **UNVERIFIED / likely FAIL** | HIGH-2 |

## Could not verify

- **Android and iOS devices:** HIGH-2, keychain accessibility, sqlite3mc in release builds, real connectivity / timezone plugins.
- **Prod Postgres specifics:**
  - PgBouncer transaction mode.
  - Index build time of `uq_attendance_logs_source_event_id` on the prod `attendance_logs` size (non-concurrent `CREATE UNIQUE INDEX` takes a write lock during migrate-on-boot).
  - Whether `attendance_logs.id` is a PK on prod (needed for the new FK).
- **D2 exhausted paths (`sessions_exhausted` / `pack_exhausted`):** only via the sqlite tests, not live.
- **Dashboard in a real browser:** Web Locks and BroadcastChannel; lease fallback used under node.
- **MEDIUM-4:** code reading only.

## New files (uncommitted)

- `gym-admin/tests/integration/offline-live.test.ts`: live dashboard→API test, skipped without `OFFLINE_LIVE_API`.
- `packages/clby_offline/test/integration_live_test.dart`: live Flutter→API test, skipped without `CLBY_LIVE=1`.
- Scratch: `/private/tmp/claude-501/-Users-rtg/517074da-c3b8-48e0-b71d-36983cc4f6f3/scratchpad/verify/` (`api.py`, logs, `flutter/live_*.json`).

## DB rows created in `clby_offline` (by this verification)

**Totals:**

| Table | Before | After |
|---|---|---|
| `attendance_events` | 21 | 1150 |
| `attendance_devices` | 4 | 104 |
| `attendance_logs` with `source_event_id` | 9 | 860 |
| `service_session_logs` with `source_event_id` | — | 3 (2 from this run) |

**`attendance_events` by actor, since 16:30 UTC:**

| Actor | Rows |
|---|---|
| joe@swap.com | 1050 |
| aya@qa.test | 65 |
| barak@swap.com | 6 |
| coach.pt@swap.com | 6 |
| 360@360.com | 2 |

**Side effects on fixtures:**

- Assignment `007bc602` went from 6/10 to 8/10 used. Service logs `ecd0b3e9-…`, `d069af42-…`.
- barak's bucket `d42073c6` went from 13/3 to 12/4 (one class decrement).
- `staff_activity_logs` rows were added per sync request and per accepted check-in.

**Cleanup query:** every row is identifiable by `source_event_id` / `attendance_events.created_at > '2026-11-26 16:30Z'`.

**Tokens:** the three minted tokens (ids 324–326, name `phase1-verify`) were deleted.

## Re-verification after fixes (2026-11-26)

All HIGH and MEDIUM findings fixed (commits c07d09e, cba1c63, 727ecff, 675b5c5, and the Flutter clock commit). Live runs against the amended API on :8082 (offline enabled):
- Dashboard live suite 5/5 — incl. two accounts on one shared browser device both syncing.
- Flutter live suite 5/5 — coach service_session + replay + IDOR + clock skew after a later clock change; member QR forms, lost response (exactly one row per event), wrong gym, garbage QR, valid QR after garbage; kill mid-sync recovery; 401 pause; second user on a bound device syncs.
- Found during re-verification and fixed: skew detection missed clock changes made after the offset was measured (now anchored to a monotonic clock on both stacks).

Suites: clby-api 260 passed; gym-admin 306 passed (+5 live skipped); clby_offline 120 passed (+1 live skipped); member app 14, coach app 2.

Still open (not Phase 1 blockers): on-device Android check of the secure-storage fix (HIGH-2); `device_mismatch` for a gym switch only covered by fake-transport tests; clock changes made while the app/tab is closed are caught only after the next server response; live suites need the documented data reset between runs.
