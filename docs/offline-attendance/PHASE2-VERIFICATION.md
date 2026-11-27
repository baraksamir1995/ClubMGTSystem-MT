# Offline Attendance — Phase 2 independent verification (2026-11-26)

**Scope:** `git diff 10a2fe1..HEAD`. Commits: docs `0f9f0b9`, API `faa9578`, dashboard `21f6116`, coach + package `9a142c7`.

**Specs checked against:** PHASE2-CONTRACT.md (binding), CONTRACT.md, SPEC §4/§9/§10/§11/§14, and the BACKEND-NOTES "Phase 2" deviations.

**Method:**
- All suites were run.
- A shared member-pass corpus of 47 cases was built from the PHP issuer and verifier and run through the JS (WebCrypto and noble) and Dart verifiers.
- Live API probes ran against :8082.
- The dashboard front desk was driven in headless Chrome against :3002, including Chrome's fake camera fed a real pass QR, offline-in-tab, and all 8 indicator states.
- The coach and package engines ran live against the API, plus a real sqlite3mc v1→v2 migration.
- Part of the work was done by two delegated verifier agents (coach/package and dashboard). Their results are folded in here with their evidence.

## Verdict

The pass crypto is sound. No forgery, tamper, signature reuse, kid confusion or cross-gym key was accepted by any of the three implementations.

Tenant isolation and permissions on the new endpoints hold. Exactly one official row per event held live on both clients.

There are no critical or high findings. Several medium issues should be fixed before Phase 2 is signed off, mainly:
- the "QR-verified" assurance on backdated events;
- the inspector showing no member;
- offline sign-out on a shared PC.

## Test counts

| Suite | Result |
|---|---|
| clby-api `php artisan test` | **272 passed** (1249 assertions) |
| gym-admin `npx vitest run` | **370 passed**, 6 skipped (env-gated live files) |
| gym-admin `tsc --noEmit` | clean |
| packages/clby_offline `flutter test` | **140 passed** (env-gated skipped) |
| coaches_mobile_flutter | 16 passed |
| gym_mobile_flutter | 14 passed |
| Live: gym-admin `offline-live` + `member-pass-live` | 6/6 passed |
| Live: package `integration_live_test.dart` (Phase 1 regression, after the coach-assignment reset) | 5/5 passed |
| Live: package `interop_php_pass_test.dart` | 1/1 (covers only one or two PHP passes plus one tamper) |
| Live: coach QR service_session (new `verify_coach_qr_live_test.dart`) | 1/1 |
| Corpus, 47 cases, through PHP / JS-WebCrypto / JS-noble / Dart | see the table below |

## Findings (ranked)

### MEDIUM-1 — A pass issued after the scan is accepted, so `source=qr` / `qr_meta` can be false assurance (live)

- **Where:** `clby-api/app/Services/MemberPassService.php` `verify()` step 5 (~L196-201). It checks `iat` against server *now* + skew, never against `$at` (`device_recorded_at`).
- **Evidence:**
  - Coach event `dcc8d854-6010-4b8a-a9c3-196f289b6c89` has `device_recorded_at` 12:43Z.
  - It carries barak's pass with `iat` 18:49Z, about 6 h later.
  - It was accepted with no flags, and `qr_meta` was stored.
- **Same path for `staff_qr`:** any event backdated up to 7 days can be labelled QR-verified using a pass minted afterwards. Expiry and retired-key grace are also judged at the client-chosen `device_recorded_at` (BACKEND-NOTES P2 §3).
- **Fix:** reject or flag `iat > device_recorded_at + future_skew`. Add this rule to contract step 5 and to all three verifiers.

### MEDIUM-2 — The dashboard inspector shows no member, actor or device for server rows (live)

- **Where:** `gym-admin/components/attendance/front-desk/failed-inspector.tsx:117-128` and `ReviewEvent` in `lib/offline/types.ts` (~283-299).
- **The mismatch:**
  - The UI reads flat `member_name`, `actor_name`, `device_label` and `attendance_method`.
  - The API returns nested `member{…full_name}`, `actor{…full_name}`, `device{…label}` and `method`.
- **Evidence:**
  - Event `16aac514` via the proxy has `member.full_name="test pay"`, `actor.full_name="Joe"`, `device.label="admin web 0.1.0"`.
  - The rendered row shows "—" as the member, with no "By" and no "Device" (screenshot `scratchpad/verify/p2/dash/19-inspector-row.png`).
- **What does match:** `{data, next_cursor}`, the result/code/message/flags/timestamp fields, paging (7 pages / 318 rows = DB) and the filters.
- **Fix:** use the real nested shape, and add a test with a captured API row.

### MEDIUM-3 — Offline sign-out on a shared front-desk PC leaves the session alive (live)

- **Where:** `gym-admin/lib/offline/sign-out.ts:86-90`.
- When `POST /api/auth/logout` fails (offline), the error is swallowed and the app navigates to /login, which fails offline.
- The httpOnly cookie and the Sanctum token both survive. After reconnecting, `/api/attendance/offline/events` returned 200 with the old cookie.
- The cache was wiped, but the next person is still signed in as the previous user.
- **Fix:** refuse sign-out while offline with a clear message, or persist a "logout pending" flag that forces logout on the next load. Never navigate as if signed out.

### MEDIUM-4 — Coach app enters offline mode on any API error, including 403 for revoked access (code reading)

- **Where:** `coaches_mobile_flutter/lib/screens/home_screen.dart` (hardError → `tryEnterOfflineMode`) and `coach_app_state.dart:49`.
- A 403 from the `coach` middleware (role removed, profile deactivated) still lands in `OfflineHome` if a token, last scope and cached data exist. The coach can record into the outbox; those events are only rejected at sync.
- Only 401 is safe, because it clears the token.
- **Fix:** enter offline mode only on network, timeout or 5xx errors, never on 4xx.

### MEDIUM-5 — A compromised signing key can't be revoked (code)

- Rotation only retires the active key, which stays valid for `retired_at + 30 d`.
- Grace is judged at the client-chosen `device_recorded_at`.
- Clients keep accepting it from their cached `pass_keys` until refresh.
- There is no `revoked` status, and no endpoint or artisan command for rotation (BACKEND-NOTES P2 §7).
- If the DB and APP_KEY leak, forged passes stay valid for weeks.
- **Fix:**
  - Add a `revoked` status that is dropped from `pass_keys` and rejected server-side regardless of time.
  - Add an artisan command for rotate and revoke.

### LOW-MEDIUM-6 — On reconnect the dashboard shows "Sync failed" for about 20 s instead of syncing at once (live)

- **Where:** `gym-admin/lib/offline/sync-engine.ts:779-791` (the online handler calls `syncNow()` without force) and `:442` (any `lastError` with pending rows shows as failed).
- **Measured:** Offline at +4 ms, "Sync failed" at +263 ms, Synchronizing at +19.7 s, then synced at +20.2 s. The delay grows with backoff.
- The contract says items sync "immediately when online".
- **Fix:** on `online`, retry with force after a short delay, and show network errors as Pending.

### LOW

1. **Parser strictness differs across the three implementations.** None of these is a forgery; each needs a validly signed pass. But a re-encoded pass passes offline (with staff confirmation) and is then rejected `qr_invalid` at sync.
   - JS accepts `iat`/`n`/`v` written as `X.0` or exponent form (`lib/offline/member-pass.ts` `isInt`).
   - Dart accepts `v:1.0`, `n` as a string, padded or standard-alphabet `sig`, a leading BOM (via `trim()`), and raw text over 2048 bytes (`packages/clby_offline/lib/src/pass/member_pass.dart:51-80`).
   - The server accepts non-canonical trailing base64 bits in `sig` (QR malleability: the same pass has several valid texts). Clients reject huge `n` (above 2^53) and are case-sensitive on `m`.
   - **Fix:** mirror PHP `parse()` exactly in both clients (int types, kid/uuid regexes, sig alphabet without padding, ≤2048, no BOM strip, `iat > exp` → `qr_invalid`). Use strict base64 decoding on the server.
2. **A foreign-gym pass shows "unknown key — refresh offline data"** on both clients, where the server says `qr_wrong_gym`. The client can't know the key, but the hint is misleading.
3. **`camera=(self)` is now site-wide** (`gym-admin/next.config.mjs:28-34`). Previously it was `camera=()`; it now appears on /login, /dashboard, /api/*. Scope it to the attendance routes, or document why it is site-wide.
4. **Proxy auth behaviour is inconsistent.** Unauthenticated `/api/members/{id}/member-pass` gets a 307 to /login (middleware) where `/api/attendance/offline/events` gets a JSON 401. The print button then parses HTML.
5. **Rejected passes still write `qr_meta`.** For a rejected pass, `attendance_events.qr_meta` stores the attacker-supplied `m`/`kid`/`iat`/`exp` unmarked (`AttendanceSyncService::checkPass`). Mark them unverified.
6. **Dashboard client messages:**
   - An expired cookie during permission revalidation shows "can't record attendance" instead of "Login required" (`lib/offline/front-desk.ts:57-66`).
   - Server English rejection text is shown in the Arabic UI (`device-records.tsx:12`).
   - Sign-out gives no feedback during its 5 s sync wait.
7. **The events proxy drops `result=error` and `limit`** (`app/api/attendance/offline/events/route.ts:6`), so retryable server errors can't be listed from the dashboard.
8. **The review endpoint exposes raw error text.** For `result=error` rows it returns `reason_message` = exception class + message (it can include SQL with bindings) to staff. There were no such rows live. Show a generic message.
9. **Coach `OfflineEntryBlock` is never shown to the user** (`coach_offline_controller.dart:122`). A blocked cold start shows the generic "can't reach" error.
10. **Policy-disabled staff QR is logged as `method:'manual'`** by the online fallback (`POST /attendance` via the proxy). This is a reporting nuance.
11. **Pre-existing, out of scope:** a member token (or a bogus cookie) renders `/dashboard/attendance` with the admin nav (`app/dashboard/layout.tsx` only restricts staff and trainer). The data shown was the member's own. The new front-desk page itself redirects members correctly.

## Cross-implementation corpus (47 cases, `scratchpad/verify/p2/corpus.json`)

**Agree everywhere:**
- Valid passes and `n=null`.
- Tamper of `m`/`n`/`exp`, and `n`→null.
- Signature reuse across members.
- Kid confusion (B-signed with A's kid).
- Expired; `iat` in the future.
- Member not in gym.
- Key order, whitespace, unicode escapes and duplicate keys (all last-wins).
- `v` or `n` as string (except Dart `n` string), `n` missing, truncated sig.
- Uppercase `g`, wrong `t`, `v2`, non-JSON, array wrapper, trailing garbage.
- Extra field.
- Retired key in grace.

**Expected differences** (client `qr_unknown_key` vs server `qr_invalid`): foreign key with kid B, retired past grace, kid containing `|`.

**Findings (LOW-1/2):**

| Case | Server | JS (WebCrypto = noble) | Dart |
|---|---|---|---|
| gymB pass scanned at A | qr_wrong_gym | qr_unknown_key | qr_unknown_key |
| iat > exp | qr_invalid | pass_expired | pass_expired |
| iat as float / exponent | qr_invalid | **ok** | qr_invalid |
| n as float | qr_invalid | **ok** | qr_invalid |
| v as float | qr_invalid | **ok** | **ok** |
| n as string | qr_invalid | qr_invalid | **ok** |
| sig padded / standard base64 | qr_invalid | qr_invalid | **ok** |
| leading BOM | qr_invalid | qr_invalid | **ok** |
| raw > 2048 | qr_invalid | qr_invalid | **ok** |
| sig non-canonical trailing bits | **ok** | ok | qr_invalid |
| m uppercase (signed uppercase) | ok | member_not_found | member_not_found |
| n = 2^60 | ok | qr_invalid | (n/a) |

WebCrypto and noble agreed on every case.

## Live API checks (server)

**`/me/member-pass`:**
- member → 200 `{qr, expires_at, kid}`.
- joe, coach, aya and another gym's admin (no gym_members row) → 404 `member_not_found`.

**`/members/{id}/member-pass`:**
- joe → 200.
- aya (sales only) and coach → 403 `required: members`.
- member → 403.
- Another gym's admin → 404.
- Another gym's member id (any case) → 404.
- Both endpoints return the same cached pass.

**`staff_qr` sync:**

| Case | Result |
|---|---|
| Real pass + matching member | accepted, `qr_meta` without sig |
| Real pass + other `member_id` | `qr_member_mismatch` |
| Tampered | `qr_invalid` |
| No QR / non-pass QR / float re-encoded | `qr_invalid` |
| Staff without attendance module | `permission_denied` |
| Another gym's admin with our pass | `qr_wrong_gym` |

The sig and raw pass were never stored (0 rows match).

**Coach QR (live):**
- Real pass → accepted with service log.
- Pass of another member → `qr_member_mismatch`.
- Tampered → `qr_invalid`.
- A member outside the coach's assignments → local `member_not_found`, no data shown.

**Review endpoint:**
- joe → 200; aya, coach, member → 403.
- Another gym's admin sees only its own 3 events.
- Full keyset paging 12 pages = 2250 = DB count, no duplicates.
- `result` / `needs_review` filters work.
- Bad `result` / `cursor` / `limit` and a SQL-ish cursor → 422.
- `gym_id` param ignored.
- A far-future forged cursor only pages within own gym.

**Key secrecy:**
- No secret in any response, in bootstrap `pass_keys`, in `storage/logs/laravel.log` (no pass or secret strings), or in `attendance_events`.
- `secret_key_enc` is Crypt ciphertext.

## Acceptance — PHASE2-CONTRACT + SPEC §14 Phase 2

| Item | Result | Evidence |
|---|---|---|
| Pass format, Ed25519 over the canonical string, per-gym key, lazy create | PASS | corpus + live |
| Private keys never leave server / never logged | PASS | probes, log grep |
| Rotation: retired accepted within grace | PASS (but MEDIUM-5: no revoke, no rotate command) | corpus |
| `/me/member-pass`, `/members/{id}/member-pass` authz + IDOR | PASS | live |
| `pass_keys` in bootstrap (admin + coach) + `/offline/me` | PASS | live (dashboard + coach) |
| Verification steps 1–6 identical on 3 implementations | **PARTIAL** — no forgery accepted anywhere; strictness differences (LOW-1/2) | corpus |
| Server re-verifies on sync, `qr_member_mismatch` | PASS | live |
| Step 5 time rule sound for offline events | **FAIL** (MEDIUM-1) | live event `dcc8d854` |
| Coach: scan → assignment → service_session with `metadata.source` | PASS | live |
| Review endpoint: tenant, permission, paging, shape | PASS (server) | live |
| Inspector consumes review endpoint | **FAIL** (MEDIUM-2) | live screenshot |
| Indicator: 8 states | PASS | dashboard live, all 8 triggered |
| Readiness panel: counts, as-of, refresh, sync now | PASS | live (3 members / 4 classes = DB) |
| Item states; local never shown as confirmed; no edit/delete | PASS | live |
| `policy.enabled=false` → existing online endpoints + note | PASS (code + unit tests; not live) | `front-desk.test.ts:30,60,78,197`; coach `offline_logic_test.dart` |
| One path when enabled; synced within seconds online | PASS online (~0.5 s); reconnect is ~20 s (LOW-MEDIUM-6) | live |
| Offline in loaded tab → reconnect → one official row each | PASS | live (dashboard 3 events; coach kill/recover) |
| Arabic + English, RTL | PASS (server reason text stays English, LOW-6) | screenshot `18-ar-rtl.png` |
| SPEC §14 P2: cached member lists + offline search | PASS | live |
| SPEC §14 P2: staff QR scanning | PASS | Chrome fake camera, BarcodeDetector, jsQR fallback |
| SPEC §14 P2: manual attendance | PASS | live |
| SPEC §14 P2: class attendance | PASS | live |
| SPEC §14 P2: pending-sync UI | PASS | live |
| SPEC §11: safe logout / shared device | **FAIL offline** (MEDIUM-3); online PASS | live |
| SPEC §11: revoked access | **FAIL coach** (MEDIUM-4) | code |
| Cached-permission max age (24 h) gate | PASS (client-side; the server checks every event) | live |
| Coach offline cold-start blocks (other user, missing key, empty store, changed API base) | PASS | code + `offline_entry_test.dart` |
| Drift v1→v2 on a real encrypted file | PASS | 3 pending rows kept, key byte-identical, triggers kept |
| Regression: Phase 1 live suites | PASS | 6/6 dashboard, 5/5 package |
| Regression: online endpoints | PASS | not touched by the Phase 2 diff; API suite green |
| Phase 1 HIGH fixes still in place | PASS for HIGH-1 (live) and HIGH-3 (code); HIGH-2 Android still unverified on a device | — |

## Could not verify

- `policy.enabled=false` live: the API couldn't be restarted, so this was checked by code and unit tests only.
- A real phone camera and on-device Android/iOS behaviour, including the Phase 1 HIGH-2 Android secure-storage fix.
- The coach 403 → offline-mode path live (it would need a role change on the shared DB).
- Real-network `online` events, as opposed to Playwright emulation.
- A trainer holding the attendance module (no such account exists).

## New files (uncommitted)

- `gym-admin/tests/integration/pass-corpus-verify.test.ts`: the JS corpus runner (`PASS_CORPUS=<corpus.json>`).
- `packages/clby_offline/test/verify_corpus_test.dart` (`CLBY_VERIFY_CORPUS`).
- `packages/clby_offline/test/verify_coach_qr_live_test.dart` (`CLBY_VERIFY_LIVE`).
- `packages/clby_offline/test/verify_open_v1_test.dart` (`V1DIR`).
- In `/private/tmp/claude-501/-Users-rtg/517074da-c3b8-48e0-b71d-36983cc4f6f3/scratchpad/verify/p2/`:
  - `gen_corpus.php` (PHP issuer/verifier; its DB writes are rolled back)
  - `corpus.json`, `js_verdicts.json`, `dart_verdicts.json`
  - `api2.py`
  - `coach/` and `dash/` (scripts, screenshots, captured JSON)

## DB changes in `clby_offline`

**Attendance / service events:**
- Live server probes: about 10 `staff_qr` events by joe, aya and the other gym's admin.
- Dashboard: 16 events from browser device `d28a63b6…`, each with exactly one `attendance_logs` row except one rejection.
- Coach agent:
  - Reset assignment `007bc602` and deleted 3 old test events + 3 service logs.
  - Ran the live suites: events `dcc8d854`, `0dc28597`, `de7d97b1`, plus 9 from the package suite.
  - Final state: `007bc602` at 8/10 used.
- Live suites: their own tagged rows.
- All rows are identifiable by `source_event_id` or `created_at` on 2026-11-26.

**`gym_signing_keys`:** a new active key `16c657926eb3` for gym `be92293b…` (minted to test a foreign-gym pass). Gym `f59a…`'s key `af512d252e32` is unchanged.

**`attendance_devices`:** joe's `revoked_at` was set, then reset to NULL. New device rows came from the tests.

**Tokens:**
- All `p2-verify` tokens (335–339) were deleted.
- `p2dash-signout` tokens: 340 was revoked by the sign-out test and 341 was deleted.

**Servers:** the Next dev server on :3002 was stopped. The :8082 API was left running as instructed, and :8081 was untouched.

## Re-verification after fixes (2026-11-27)
All MEDIUM findings fixed (65a7b85 API, 7520637 coach/package, efd8943 dashboard). Shared corpus v2 (66 cases): server, Dart and JS (WebCrypto + noble) agree on every case (client `qr_unknown_key` ≡ server `qr_invalid` by contract). Suites: API 279, dashboard 400 (+7 env-gated skipped), clby_offline 147 (+5 skipped), coach 21, member 14 — all green. Still device-only: real camera scanning, Android secure-storage check, coach 403 path live.
