# Audit — Member mobile app (`gym_mobile_flutter/`) for offline-first attendance

Auditor scope: member app only (plus the backend/admin code it directly talks to for QR check-in, read to know what the server actually validates). Branch `feat/offline-attendance` @ main. Read-only; `flutter analyze` not run. Paths are relative to `gym_mobile_flutter/lib/` unless prefixed.
Legend: **[confirmed]** read in code / local DB; **[unconfirmed]** inferred, needs verification (esp. prod).

---

## 0. Headline findings

1. **The member app does NOT display a member QR today.** `qr_flutter` and `screen_protector` are still in `pubspec.yaml` but unused. The static member QR `{"type":"member_checkin","member_id","gym_id"}` was removed in commit `03be2db` (2026-05-02, "Drops the static member-displayed QR … in favour of member-scans-gym"). No scanner anywhere (admin, coach app, API) consumes `member_checkin` **[confirmed by grep]**. So `staff_qr` (spec §4A) has no member-side credential at all; it must be (re)built. Upside: there is no deployed member-QR format to stay compatible with.
2. **Only one member attendance method exists: member scans branch QR** (`screens/qr_scanner_screen.dart`). Studio QR and specialist QR also exist but consume sessions/packages (server-decided) → keep online-only.
3. **The branch QR is static and unsigned**: `{"type":"gym_access","gym_id","branch_id","token":<uuid>}` (`gym-admin/components/attendance/gym-qr-modal.tsx:70-72`), `token` = `branches.qr_token` (uuid, regenerable by admin). It is a bearer secret; it cannot be verified offline (verification = DB lookup).
4. **Server-side entrance check-in validates almost nothing** — `log_gym_attendance_by_token(member, token)` (`clby-api/database/migrations/2026_05_07_120000_qr_attendance_rpcs.php:73-104`, identical in local `clby_offline` and `clby_dev` DBs; migration header says it mirrors prod as of 2026-05-07 — prod **[unconfirmed]**) only checks token exists + branch active, then inserts `attendance_logs` with **the branch's gym_id**. It does **not** check: membership active/frozen/gym-access/branch-allowed, member.status, that the branch's gym == the member's gym, or any duplicate window. Consequences:
   - **Cross-tenant write**: a member of gym A submitting gym B's token (crafted request, or crafted QR with `gym_id` = A to pass the client check) creates an `attendance_logs` row with `gym_id=B`, `gym_member_id=<A's member>`. `scopedMemberId` (`clby-api/app/Http/Controllers/Concerns/ResolvesMemberScope.php:62-78`) only pins the member to the caller.
   - All membership gating is client-side only (`qr_scanner_screen.dart:86-120`); comments at `qr_scanner_screen.dart:122-124` and `providers/member_provider.dart:332-334` ("2-min cooldown", "checks membership/branch access") are **false** for the current RPC. Reason codes `already_checked_in`, `no_active_membership`, `membership_frozen`, `branch_not_included` handled in `_showGymDenyResult` (`qr_scanner_screen.dart:502-552`) are never produced by the current RPC (only `invalid_qr_token`, `branch_inactive`).
   - → Escalate to clby-api auditor: the sync endpoint must not reuse this RPC as-is; this is also an online P0-ish gap independent of offline.
5. **The app is not offline-capable at all today**: no connectivity detection, no local DB, no persisted domain cache. Offline cold start with a stored token → `AuthProvider` stays "authenticated" but `profile`/`gym` are null, bootstrap skips, and scanning a branch QR shows **"Wrong gym"** (because `userGymId == null != qrGymId`, `qr_scanner_screen.dart:53,78`). A flaky network mid-scan returns a raw exception string as a "denied" reason with no idempotency (POST may have succeeded server-side).
6. **No app-version reporting or force-update mechanism** (no `X-App-Version` header, no `package_info_plus`, no min-version endpoint) **[confirmed by grep]**. Old builds can't be retired, so any new branch-QR format must be a strict superset of today's JSON.

---

## 1. Architecture

| Area | Facts (file:line) |
|---|---|
| Entry | `main.dart:21-46`: `Env.validate()` → `FreshInstallGuard.runOnFirstInstall()` → Firebase/notifications init → `runApp`. One `ApiService()` instance passed to `AuthProvider`/`MemberProvider` (`main.dart:52-59`); many screens/repos construct their own `ApiService()` (state is static). |
| Providers | `AuthProvider`, `MemberProvider`, `BannerProvider`, `BillingProvider`, `BranchProvider`, `PopupProvider`, `RatingReminderProvider`, `LocaleProvider` (`main.dart:51-77`). Sign-out fan-out: `AuthProvider.addSignOutCallback` wires `clear()` of member/banner/branch/popup/rating (`main.dart:105-120`, `providers/auth_provider.dart:29-47`). Offline layer must register here too. |
| Bootstrap | `services/app_bootstrap.dart:56-102`: waits for auth (10s), returns if not authed or `profile.gymId == null` (`:63-64`), then `loadMemberData` + banners + branches (8s timeout); total 12s cap. |
| Router | `router.dart:51` `_publicRoutes`; redirect `:59-70` purely on `authProvider.isAuthenticated` (= `userId != null`), so an offline restart still routes into the shell. Check-in tab `/checkin` → `AttendanceScreen` (`router.dart:605-611`); scanner is pushed with `Navigator`/`MaterialPageRoute` (`screens/attendance_screen.dart:220`), not a GoRoute. Splash → `/home` if authenticated (`features/splash/splash_screen.dart:155`). |
| HTTP | `services/api_service.dart`: single static `http.Client` (`:36`); headers = JSON + `Authorization: Bearer` only (`:124-131`) — **no app-version / device / flavor headers**. `_get` retries once on `SocketException`/`ClientException` (`:147-153, 207-217`); `_post/_put/_patch/_delete` no retry (`:155-197`); 15s timeout incl. keychain read (`:135, 199-200`). Errors: non-2xx → `ApiException(statusCode, message)` (`:219-228`, class `:1727-1734`; `toString()` = `"ApiException(403): msg"` — callers string-match on it, e.g. scanner `:292-345`). |
| 401 handling | `_handle401` (`:95-103`) clears credentials only if our token was sent AND body message == `Unauthenticated.`; then `ApiService.onSessionRevoked` → `AuthProvider._onSessionRevoked` (`auth_provider.dart:58-66`) runs fan-out. Sync engine must use the same predicate (a 401 must not wipe pending events). |
| Token storage | `flutter_secure_storage` keys `auth_token`, `user_id` (`api_service.dart:25-27`), in-memory `_memToken` + `_knownNoToken` guard against flaky iOS keychain reads (`:40-79`). Default `FlutterSecureStorage()` options everywhere (no `IOSOptions` accessibility → default `unlocked`; background access while locked will fail **[confirmed: no options passed]**). |
| Other secure-storage keys | `cached_gym_logo_url`, `cached_gym_name`, `cached_fcm_token` (`auth_provider.dart:12-15, 114-134`), onboarding flag, popup dismissals, rating reminders. **Not cleared on sign-out** (only token/user_id are, `api_service.dart:84-90`). |
| FreshInstallGuard | `services/fresh_install_guard.dart:18-30`: if SharedPreferences marker missing → `FlutterSecureStorage().deleteAll()`. Implication: any DB-encryption key / device id kept in Keychain is wiped on reinstall; the SQLite file itself is in the app sandbox and is deleted by uninstall anyway → consistent. Must run before the offline store opens (it already runs first in `main`). |
| Lifecycle | `AuthProvider.didChangeAppLifecycleState` refreshes gym on resume (`auth_provider.dart:220-233`); `HomeScreen` refreshes on resume (`screens/home_screen.dart:202-215`). No other lifecycle hooks. |
| Connectivity | None. No `connectivity_plus`. Offline detection is only `friendlyError` mapping `SocketException`/host lookup/timeout to text (`utils/error_utils.dart:7-10`). |
| Local caching | Only branding strings in secure storage + `LocaleProvider` in SharedPreferences. All domain state (member, membership, summary, attendance, branches) is in-memory in providers, lost on restart. `sqflite`, `uuid`, `crypto`, `path_provider` are present only as **transitive** deps (via cached_network_image etc.) — not direct. |
| Background work | iOS `UIBackgroundModes`: `remote-notification`, `fetch` (`ios/Runner/Info.plist:80-84`); no BGTaskScheduler/workmanager code. FCM is present (could carry a "sync now" data push later). |
| Platform targets | iOS Podfile 15.5 (`ios/Podfile:1`); Android minSdk = Flutter default (`android/app/build.gradle.kts:60`). |
| Tests | Only `test/widget_test.dart` (placeholder) and `test/contract_terms_format_test.dart`. No test infra for providers/services. |

### Flavors / white-label
- Brands (Android productFlavors / iOS xcconfigs): `clby` (marketplace, `GYM_ID=""`, version from pubspec `1.0.6+18`), `alfag` (iOS 1.0.1+4 / Android 1.0.1(4)), `shift` (iOS 1.0.2+4 / Android 1.0.0(1)), `theBarn` (iOS 1.0.2+4 / Android 1.0.2(3)), `fiveD` (1.0.0+1) — `android/app/build.gradle.kts:110-150`, `ios/*.xcconfig`. All flavors hit the same `API_URL=https://api.clbyapp.com` (`flavors/*.json`).
- `Env.gymId` set ⇒ white-label locked to one gym (`utils/env.dart:15,37`); login sends `gym_id` (`api_service.dart:238`).
- Implications: each flavor is a separate app sandbox → separate DB/keychain, no cross-brand leakage. The `clby` marketplace flavor can be used by members of any gym, so **every cached row and event must be keyed by `(user_id, gym_id)`**; white-label builds should additionally reject any branch QR whose signed `gym_id != Env.gymId`. Don't put brand-specific constants in the shared package; pass `apiBaseUrl`, `gymLock` (Env.gymId), app version, flavor name as config.

## 2. Attendance today

### Member QR display
None (see finding 1). The Attendance tab (`screens/attendance_screen.dart`) shows membership card + "Scan QR to check in" CTA (`_ScanCta`, `:460`) + history. Backend has an unused member-token generator `POST /api/qr-token/generate|verify` (`clby-api/routes/api.php:195-196`, `clby-api/app/Http/Controllers/QrTokenController.php`): HMAC-SHA256 with a **server secret**, `{sub: profile id, gym, exp: now+60}`. Not usable offline by staff devices (would require distributing the HMAC secret) — do not build on it; it can be retired or kept for online kiosks.

### Member scans branch/studio/specialist QR — `screens/qr_scanner_screen.dart`
- Package `mobile_scanner ^7.2.0`, controller started manually (`:22-32`), single-shot guard `_processing` (`:40-49`). After a result the sheet handles rescans.
- Pre-step: if `member == null` and `profile.gymId != null`, reload member data (`:55-60`) — needs network.
- Parsing (`:62-289`): `jsonDecode(code) as Map`; else legacy string.
  | Payload | Handling | Endpoint |
  |---|---|---|
  | `{"type":"gym_access","gym_id","branch_id","token"}` (current admin QR) | gym_id must equal `profile.gymId` (`:78-84`); client gates: frozen, transferred-only, `!hasGymAccess`, `!canAccessBranch(branch_id)` (`:86-120`); then `scanGymQrByToken` (`:126-131`) | `POST /api/attendance/qr {gym_member_id, token}` (`api_service.dart:916-931`) → `AttendanceController::logByQr` (`clby-api/app/Http/Controllers/AttendanceController.php:309-332`; Laravel rule `token: required|uuid`) → SQL RPC (finding 4) |
  | `gym_access` without `token` (QR printed before tokens existed / token fetch failed in modal — `gym-qr-modal.tsx:72` still emits it) | `scanGymQr` → `insertAttendanceLog` | `POST /api/attendance {gym_member_id, branch_id}` — route requires `permission:attendance,create` (`clby-api/routes/api.php:335`) → members almost certainly get 403 → shown as generic failure **[unconfirmed: depends on member role perms]** |
  | `{"type":"studio","studio_id"}` (`gym-admin/components/studios/studio-qr-modal.tsx:20-23`) | frozen check, member must be loaded (`:150-209`) | `POST /api/access/studio` → `validate_studio_access` (decrements session buckets) |
  | `{"type":"specialist_session","gym_id","trainer_id"}` | `:212-239` | `POST /api/specialists/scan` (decrements package) |
  | legacy `gym:<gymId>` string | `:249-283` → `scanGymQr` (same 403 path) | `POST /api/attendance` |
  | any other JSON `type` / non-JSON | "QR not recognized" (`:241-245, 284-289`) | — |
- Note `api_service.dart:904` `validateGymQrToken` (`POST /api/access/qr/validate`) exists but is unused by the scanner; it is a token oracle open to any authenticated user (`clby-api/app/Http/Controllers/AccessController.php:14-27`).
- Error UX: result bottom sheets `_ResultSheet` (`:815`); deny mapping `_showGymDenyResult` (`:502-552`: `not_a_member, no_active_membership, membership_frozen, gym_access_not_included, branch_not_included, already_checked_in, invalid_qr_token, default`), `_showStudioDenyResult` (`:356-426`), specialist (`:439-499`), exception-string matching for class flows (`:290-352`: `wrong_branch, no_session_today, already_attended, no_booking, sessions_exhausted, too_early:HH:mm, session_ended`). `checkinGymEntrance` swallows all exceptions into `{'status':'denied','reason': e.toString()}` (`api_service.dart:928-930`) → network failure shows "Check-in failed: ApiException…/SocketException…". Success sheet uses device `DateTime.now()` (`:145`), not server time.
- After success: `loadAttendance()` refetches last 10 (`providers/member_provider.dart:343-345`).

### Attendance history
`GET /api/attendance?gym_member_id&limit&offset&from&to&type` (`api_service.dart:867-890`), server auto-scopes members to self (`clby-api/routes/api.php:225-226`). Provider loads only `limit: 10` + monthly count (separate GET, `member_provider.dart:374-390`, `api_service.dart:1003-1027`). Model `models/attendance_model.dart` (id, gymId, memberId, checkedInAt, method, accessPoint, branch/studio/className). Screen merges attendance + transfers + grants into one timeline (`attendance_screen.dart:106-113`). No notion of pending/local rows.

### DB target (for event mapping)
`attendance_logs(id, gym_id, gym_member_id, check_in_at, method, access_point, class_session_id, studio_id, branch_id, specialist_name, check_out_at, created_at, updated_at)`; no unique constraints beyond PK; no dedupe trigger (local `clby_offline` `\d attendance_logs`). Entrance QR rows: `method='qr'`, `access_point=branch.name`, `check_in_at=NOW()` (server time — the offline design must insert `check_in_at = device_recorded_at` and keep `server_received_at` separately; coordinate with API auditor).

## 3. Membership data available in-app (candidates for offline cache)

- `GET /api/members?user_id=self` → `GymMember{id, gymId, userId, memberNumber, status, joinedAt}` (`api_service.dart:417-447`, `models/member_model.dart:56-85`). `status=='suspended'` matters.
- `GET /api/members/{id}` → `currentMembership` (`MemberMembership`: status, endDate, planType, freezeStatus, `allowedBranchIds` (null = all), `hasGymAccess`, `canAccessBranch`, `isActive` uses **device clock** `endDate.isAfter(DateTime.now())`) — `models/membership_model.dart:128-180`.
- `GET /api/me/membership-summary[?gym_id]` → `MembershipSummary{totalSessions, nextExpiryDate, original/transferredSessions, buckets[]}`; bucket: id, sourceType, planName, planType, sessionsTotal/Remaining/Used, isUnlimited, start/endDate, branchId, allowedBranchIds, freezeStatus, transferredFrom… (`models/membership_summary_model.dart`, `api_service.dart:455-470`). Returns null on any failure.
- Branches: `BranchRepository.fetchActiveBranches` (`features/branches/branch_repository.dart`) → `BranchModel{id, gymId, name, address, isActive, …}`.
- Profile (`GET /api/me`-style via `getMemberProfile`): id, fullName, email, phone, gymId, role, avatarUrl.

What to cache (display-only, always labelled "as of <synced_at>", never "Active"/"Valid"): member id/number/status, profile name + avatar URL (for member pass display), membership snapshot (plan name/type, end date, sessions remaining, frozen, allowed branches, gym-access flag), branch list (id/name/active) of own gym, last N attendance rows, verification keys + policy. Do **not** cache payments, invoices, phone/email beyond what the member pass needs.
Offline UX rule: membership card shows "Last confirmed <relative time>"; expiry computed against `server_time_at_sync + elapsed` where possible, else device clock with a "may be out of date" caveat.

## 4. Deployed-version compatibility

- Versions in the field (store builds — exact live builds **[unconfirmed]**, check App Store Connect / Play): clby ≤1.0.6+18, alfag 1.0.1+4, shift 1.0.2+4 (iOS) / 1.0.0(1) (Android), theBarn 1.0.2+4 / 1.0.2(3), fiveD 1.0.0+1. Scanner parsing logic for `gym_access` is unchanged since the fork (`git log` on `qr_scanner_screen.dart`: changes only l10n, studio, specialist, 401 handling), so **all deployed builds behave identically** for branch QRs:
  - Must be JSON object; `type` must be exactly `"gym_access"` (else "not recognized").
  - If `gym_id` present it must equal the member's gym (else "wrong gym").
  - If `token` present it's sent as-is to `/api/attendance/qr`, where Laravel requires a **UUID** → `token` must stay the plain branch `qr_token` uuid.
  - Unknown extra keys are ignored → **adding fields is safe**.
  - Payload size: admin renders `level="H"` at 220px (`gym-qr-modal.tsx:129-135`); adding ~200 chars of signature data pushes QR to ~v15 at H — still scannable printed but denser; consider `level="M"` for v2 **[to test on old phones]**.
- No version telemetry → we cannot know when old builds disappear. **Recommend Phase 1 adds `X-App-Version`, `X-App-Build`, `X-App-Flavor`, `X-Device-Id` headers in `_headers`** (`api_service.dart:124`) and the API logs them; a min-version/force-update gate (the Ippon fork has one to port) is a prerequisite before ever dropping the legacy `token` field.
- Member QR: no compatibility burden (none displayed since May 2026; pre-May builds, if any still installed, show an unsigned `member_checkin` QR that new staff scanners must reject).

## 5. Gaps vs spec (member app)

| Spec item | Today | Gap |
|---|---|---|
| Cached identity + membership summary | in-memory only | persistent, user+gym scoped, encrypted-at-rest snapshot with `synced_at`/server time; offline cold-start path (AuthProvider must not leave `profile` null when cache exists) |
| Offline member QR display (§10, needed by staff_qr §4A) | none | new signed "member pass" credential issued by server, cached; display offline; screenshot/replay resistance |
| Offline branch-QR scanning + local validation | online-only, unsigned static token | signed branch QR v2 + cached verification keys + branch list + membership snapshot; local checks |
| Local event creation | none | outbox table, UUID `event_id`, `actor_type=member`, `member_id=self`, device time/tz, device id |
| Pending status / sync feedback | none; success sheet uses device time; failures show raw exceptions | per-event status (pending/syncing/synced/rejected), timeline merge of pending + server rows, rejection reasons |
| Sync engine + triggers | none (no connectivity, no outbox) | shared engine; triggers: app start, resume (`AuthProvider` observer exists), connectivity regain, Attendance tab open, optional FCM data push |
| Idempotency online | `POST /api/attendance/qr` not idempotent; lost response ⇒ unknown state | route member check-in through event API (single-event batch) with `event_id` |
| Device identity | none | generated device UUID in secure storage, registered/bound server-side |
| Logout policy | `signOut` clears token + in-memory providers only | explicit pending-event policy (below) |
| Version gating | none | headers + min-version endpoint |
| Server validation of member check-in | token-only RPC (finding 4) | sync endpoint must revalidate membership, tenant, branch, duplicates |

## 6. Phase 1 member-app proposal (no UI)

### 6.1 Plug-in to the shared Flutter offline package (proposed by coach-app auditor)
The package should be app-agnostic; the member app supplies adapters:
- `OfflineTransport` — implemented by member app over `ApiService` (reuse token, `_handle401` semantics, 15s timeout). Package must not own auth.
- `OfflineScope{apiBase, userId (profile id), gymId, actorType}` — every table row carries `scope_key = hash(apiBase|userId|gymId)`; queries always filter by it.
- `OfflineConfig{appVersion, build, flavor, gymLock (Env.gymId or null), policy}`.
- Package provides: Drift DB (event outbox, sync metadata, generic typed cache tables or JSON blobs with `synced_at`, `server_time`, `scope_key`), sync engine (single-flight lock, ordered by `device_recorded_at`, batching, per-event result mapping, exponential backoff, never delete on timeout, resume after kill: rows stuck in `syncing` revert to `pending` on open), Ed25519 verifier + QR payload codecs (branch QR v2, member pass), device-id + DB-key management, clock-skew tracker (`server_time - device_time` from each response), connectivity monitor (adds `connectivity_plus` — treat as a hint only; real signal = request outcome).
- Member-app-specific module (`lib/features/offline/`): `MemberOfflineRepository` (refresh + read cached snapshot), `MemberCheckInService` (verify QR → local checks → create event), `MemberPassService` (later phase UI), registration with `AuthProvider` sign-out fan-out.

### 6.2 What the member app caches (one "offline bundle", fetched while online)
Recommend one authenticated endpoint, e.g. `GET /api/me/offline-bundle` (API auditor to confirm naming), returning:
- `server_time`, `bundle_version`, `valid_until` (= server_time + max offline data age)
- identity: `profile_id`, `gym_member_id`, `gym_id`, `full_name`, `member_number`, `status`, `photo_url`
- membership snapshot: the gym-access-relevant fields of current membership + summary buckets (plan type, end_date, frozen, allowed_branch_ids, gym_access flag, sessions remaining) — or better, a **server-computed** `entrance_eligibility{eligible, reason, allowed_branch_ids, valid_through}` so the app doesn't re-implement plan rules
- branches of own gym: `id, name, is_active`
- verification keys: `[{kid, alg:"Ed25519", public_key, not_before, not_after}]` for the member's gym (current + next)
- member pass (for staff_qr, phase 3 UI): server-signed credential (see 6.5)
- recent attendance (last ~10–20, for local duplicate check + history)
- policy: `offline_enabled, member_checkin_offline_allowed, max_offline_age, expired_membership_policy (block|allow_pending), duplicate_window_minutes (taken from existing server rule — currently none exists for entrance; API auditor to define), max_batch, retry`
Storage: Drift (sqlite) in app-support dir; snapshot JSON encrypted with AES-GCM using a key in secure storage (or SQLCipher if the shared package chooses it — **verify iOS coexistence with the transitive `sqflite` system-sqlite before choosing SQLCipher**). The key read must reuse the flaky-keychain retry pattern (`api_service.dart:57-79`) and **must never regenerate the key on a transient read failure** (would orphan pending events); regenerate only after FreshInstallGuard wipe (DB absent).

### 6.3 Member event model (subset of spec §5, member-specific invariants)
`event_id` (UUIDv4, generated once, never reused), `gym_id` (= cached `gym_id`; must equal signed QR `gym_id`; must equal `Env.gymId` on white-label), `branch_id` (from verified QR), `member_id` (= cached own `gym_member_id`; **never taken from the QR or user input**), `class_id=null`, `attendance_method='member_qr'`, `actor_type='member'`, `recorded_by=profile_id`, `device_id`, `device_recorded_at` (UTC) + `device_timezone` (IANA via `timezone` pkg already present) + `device_utc_offset`, `clock_offset_estimate_ms` + `last_server_time`, `sync_status`, `sync_attempts`, `last_sync_error`, `server_received_at`, `attendance_id`, `metadata{qr_raw or {v,kid,branch_token,jti,iat,exp,sig}, local_checks_result, cache_synced_at, app_version, flavor, offline:true/false}`.
Server must ignore client `member_id` for members and derive it from the token (as `scopedMemberId` already does), reject if it differs, and re-verify the QR evidence (signature + branch token currency + tenant) and membership at the event's time.
Local checks before creating (all advisory, result stored in metadata): signature valid; `gym_id` matches; branch in cached branches & active; branch allowed by snapshot; member not suspended/frozen; snapshot age ≤ `max_offline_age`; membership not expired per snapshot (policy decides block vs pending-with-warning); no pending/synced event for same member+branch within duplicate window; rapid-repeat guard (same QR within N seconds → no new event).

### 6.4 Branch/gym QR format recommendation (backward-compatible, signed)
**Format v2 = strict JSON superset of today's payload** (only safe option given no version gating):
```json
{"type":"gym_access","gym_id":"<uuid>","branch_id":"<uuid>","token":"<branch.qr_token uuid>",
 "v":2,"kid":"<key id>","iat":1764150000,"exp":1795686000,"jti":"<short random>","sig":"<base64url Ed25519>"}
```
- `sig` = Ed25519 over a canonical byte string, not over JSON text: `"clby-branch-qr:v2|" + gym_id|branch_id|token|kid|iat|exp|jti|mode`. Keys: `mode` = `static` | `rotating` (include in signed string).
- Old apps: see `type`/`gym_id`/`token` unchanged → online flow keeps working. New apps online: send QR evidence through the event API. New apps offline: verify locally with cached key.
- **Asymmetric only.** Ed25519 keypair per gym (private key server-side, encrypted at rest; public keys in the offline bundle with `kid`). HMAC (like `QrTokenController`) is ruled out — the secret would have to live on member phones. Pure-Dart verification via `cryptography`/`ed25519_edwards` (package choice for shared package).
- **Two modes**, gym policy picks which may be used offline:
  1. `static` (printed/downloaded, today's use): long `exp` (e.g. 6–12 months), rotation = admin "Regenerate" (already exists: `POST /api/access/qr/regenerate`, `clby-api/routes/api.php:338`) which changes `token` and re-signs. Replay protection offline is weak (a photo works anywhere until sync); mitigate with server revalidation (token must still be current or rotated after `device_recorded_at`), per-member duplicate window, max offline age (event `device_recorded_at` vs `server_received_at`), and flag `offline_static` in audit. Honest positioning: proves "had the code", not presence.
  2. `rotating` (dashboard/kiosk screen shows QR refreshing every 30–60s, `exp - iat` ≈ 60–120s): the display device does NOT hold the private key; it downloads a batch of **pre-signed slot tokens** (e.g. next 24h of 60s slots, ~1440 small payloads) while online, so it still works when the gym's internet is down. Member app accepts if `iat - skew ≤ device_now ≤ exp + skew` (skew tolerance from policy, using `clock_offset_estimate`); server re-checks `device_recorded_at` ∈ [iat−skew, exp+skew] and `server_received_at − device_recorded_at ≤ max_offline_age`. Replay: unique `(jti, member_id)` server-side + local; a photo-shared code dies within ~1 min.
  - Rotating mode on a screen still carries the static `token` for old apps; that leaks the static token to anyone photographing the screen — same exposure as today, acceptable until min-version lets us drop `token` (then `v:3` without `token`).
- Server must also (independent of offline) fix `log_gym_attendance_by_token`: require `branch.gym_id = member.gym_id`, membership/branch eligibility, duplicate window.
- Unsigned payloads (`gym_access` without `sig`, `gym:` legacy): online-only, never accepted offline (spec §4B "never trust arbitrary QR text").

### 6.5 Member pass (for staff_qr, display offline) — recommendation
Server-signed credential (same per-gym Ed25519 key family, different domain tag): `{"type":"clby_member_pass","v":1,"gym_id","member_id","kid","iat","exp","dpk":"<member device public key>","sig"}`; `exp` ≈ max offline age (e.g. 7 days), refreshed on every bundle sync. For screenshot resistance, the displayed QR = pass + `ts` + `dsig` where `dsig` = member device's Ed25519 signature over `pass_sig|ts` (device keypair generated in-app, private key in secure storage, public key registered with the server during bundle fetch and embedded in the pass). Staff device verifies server sig (cached gym public key) → verifies `dsig` with `dpk` → checks `ts` freshness (±60s). No shared secrets on staff devices; works fully offline on both sides. Simpler fallback (decide in Phase 1 plan): static signed pass + staff visual check against cached member photo. Display with `screen_protector` (already a dependency) on that screen only (see `main.dart:29-38` note about global use causing black screens).

### 6.6 Logout / revocation policy (member app)
- Before `signOut`: attempt sync; if pending events remain, confirm dialog ("N check-ins not yet confirmed"). Options: keep (default) — events stay in DB under `scope_key`, invisible to any other account, synced when the **same** user signs in again; or discard — only with explicit confirm, written as a local `discarded` audit status (not silently deleted).
- On 401 `Unauthenticated.` (revoked session): stop sync, keep events, show "sign in to confirm N check-ins". Never sync one user's events with another user's token (engine must compare token owner `user_id` to event scope).
- Cached snapshot (identity, membership, pass, keys) is wiped on logout/revocation; outbox is not. Prune kept-but-orphaned events after policy max (e.g. 30 days) with audit.
- Also clear the currently-leaked branding/FCM cache keys on logout (minor, pre-existing).

### 6.7 Phase 1 deliverables for the member app (no UI)
1. Add shared package dependency + adapters (`OfflineTransport` over `ApiService`, scope from `AuthProvider`), register `clear/lock` in sign-out fan-out (`main.dart:113-120`) and `onSessionRevoked`.
2. `X-App-Version/Build/Flavor/Device-Id` headers in `ApiService._headers` (needs `package_info_plus`), device id generation.
3. Cached models + `MemberOfflineRepository.refresh()` (bundle fetch, persist, record server time), wired to bootstrap/resume (no UI change).
4. `MemberCheckInService.recordFromQr(rawQr)` → returns typed outcome (`invalidQr | wrongGym | unsigned_needs_online | expiredCache | ineligible(reason) | duplicateLocal | created(eventId)`); pure Dart, unit-testable.
5. Codecs + verifier for branch QR v2 (both modes) and legacy detection.
6. Tests (in package + member app): QR parsing (legacy `gym:`, v1 token, v2 static/rotating, tampered field, wrong `kid`, expired, wrong gym, white-label gym lock, cross-tenant), invariants (`member_id == self`, scope isolation between two users on one device), outbox persistence across DB close/reopen, `syncing→pending` recovery, sync result mapping (synced / rejected / 5xx / timeout keeps pending / duplicate `event_id` returns original result), 401 doesn't delete events, logout keeps events scoped. Note: `flutter test` with Drift `NativeDatabase.memory()` needs host sqlite (fine on macOS).
Out of Phase 1: scanner UI changes, pending UI, member pass display, rotating kiosk display, screen protection.

## 7. Risks / open questions
1. **Server entrance RPC has no tenant/membership/duplicate checks** (finding 4) — must be fixed regardless; is prod identical? (verify with `pg_get_functiondef` on prod).
2. Duplicate window: spec forbids inventing one, but none exists for entrance today (only the UI string `qrAlreadyCheckedInRecently` and a false "2-min cooldown" comment). Product decision needed.
3. Static printed QR offline = weak replay protection. Does product accept `static` mode for offline at all, or require a rotating display (needs an always-on screen at the entrance)?
4. Key custody: per-gym Ed25519 private keys in Postgres (encrypted with APP_KEY) vs KMS. Rotation cadence and grace period; members offline longer than key overlap will fail verification → "needs online".
5. QR density with `level="H"` + signature on older Android cameras — test before rollout; maybe `level="M"`.
6. Old builds never update (no force-update): legacy `token` field must stay until a min-version gate exists; alfag/shift/theBarn/fiveD release cadence is independent (`CLAUDE.md` mobile build section).
7. Clock skew: member device clocks may be wrong; offline `exp` checks are advisory; server must bound with `server_received_at` and record skew.
8. Offline cold start currently leaves `AuthProvider.profile == null`; Phase 3 needs AuthProvider to hydrate from cached identity — touches app-wide behaviour (home, router), regression risk.
9. Keychain flakiness on iOS (documented in `api_service.dart:40-55`) + default `unlocked` accessibility: DB key / device key unreadable in background-locked state; decide accessibility (`first_unlock_this_device`) and migration of existing items.
10. SQLCipher vs field-level encryption: member app data is low-volume; coach/admin caches are not. Shared package must pick one approach that coexists with transitive `sqflite` on iOS.
11. Should the online member check-in switch to the event API immediately (one code path, idempotent) or keep `/api/attendance/qr` for online and only use events offline? Recommendation: one path (event API with single-event batch) once server parity is proven; keep `/attendance/qr` for old builds.
12. Member-scans-studio and specialist QR stay online-only (session/package decrements) — confirm with product.
