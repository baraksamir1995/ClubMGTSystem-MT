# Audit — Coach mobile app (`coaches_mobile_flutter/`) + shared Flutter offline core

Auditor scope: coach app (deep), member-app pubspec (compatibility only), coach API surface in clby-api (read-only).
Worktree: `ClubMGTSystem-MT-offline` @ `feat/offline-attendance`. Date: 2026-11-26.
Legend: **[confirmed]** read in code / ran a command · **[unconfirmed]** inferred, verify in Phase 1.

---

## 0. Headline findings

1. **The coach app is no longer a login-only scaffold** (README/CLAUDE.md/memory are stale). It has 5 real screens wired to `/api/coach/*` (~6.3k Dart LOC). But it does **not** do gym attendance at all: what it calls "attendance" is **PT/physio/nutrition session-pack consumption** (`member_service_assignments` → `service_session_logs`), not `attendance_logs` check-ins or class attendance.
2. **The coach app has no camera/QR scanner.** The flow is inverted from the spec's `staff_qr`: the coach *displays* a static QR (`{type:'specialist_session', gym_id, trainer_id}`) and the *member* scans it (`POST /api/specialists/scan`). There's no `mobile_scanner` dependency and no `NSCameraUsageDescription`. `ScanOverlay` (505 LOC) is dead code left over from the prototype.
3. **No local persistence at all for operational data.** Everything is held in memory (`CoachAppState`). No connectivity detection, no lifecycle observer, no background work. **Offline cold start currently blocks the entire app** behind a "CAN'T REACH THE GYM" screen.
4. **Server-side coach scoping = gym + trainer ownership only.** There's no branch scoping and no class/session access. `trainer_profiles.branch_id` and `trainer_branches` exist in the DB, but no coach endpoint reads them. `classes.trainer_id` exists; `class_sessions` has only a free-text `instructor`.
5. **Coach decrement is not idempotent and uses server time.** `POST /api/coach/sessions/decrement` has no client key, stamps `delivered_at = now()`, and applies a 30-minute guard against server `now()`. It also writes `service_session_logs` directly, bypassing the newer `service_attendance` source-event table that the admin path uses. That's a blocker for replaying offline events.
6. **Drift is viable, and encryption is now built into `package:sqlite3` 3.x** (hook `user_defines: source: sqlite3mc|sqlcipher`). `sqlcipher_flutter_libs` is EOL (0.7.0+eol). Verified by resolving drift 2.35.4 / sqlite3 3.5.2 / drift_flutter 0.3.1 against Flutter 3.44.7 / Dart 3.12.
7. **Biggest open product decision:** what does "attendance" mean in the coach app? See §6, Q1.

---

## 1. Architecture [confirmed]

| Concern | Implementation | Ref |
|---|---|---|
| Entry / bootstrap | `Env.validate()` → Firebase + Crashlytics → `initializeDateFormatting('en_GB')` → `runApp` | `lib/main.dart:17-44` |
| State mgmt | `provider` 6.1. Root `MultiProvider`: `ApiService` (plain), `BrandingProvider`, `AuthProvider`, `CoachAppState` (all `ChangeNotifier`) | `lib/main.dart:50-77` |
| Routing | `go_router` 14.8. One router for the app's lifetime. `_publicRoutes={/splash,/login}`. Redirect is based on `AuthProvider.isAuthenticated`. Routes: `/splash /login /home /manual-log /assignment/:id`. Tabs inside `/home` use an `int _index`, not routes | `lib/router.dart:12-86`, `lib/screens/home_screen.dart:88-99` |
| API client | Hand-written `ApiService` (335 LOC) on `package:http`. One static `http.Client`. 15 s timeout. One retry on `SocketException`/`ClientException`, but **only for GETs**. Errors come back as `ApiException{statusCode,message,code,extra}` | `lib/services/api_service.dart:19-160` |
| 401 handling | `_parse` **deletes the token + user_id from secure storage on any 401** | `api_service.dart:129-135` |
| Auth / token | Sanctum bearer token + `user_id` in `flutter_secure_storage` 9.2.4 with **default options** (no `IOSOptions`/`AndroidOptions`). Login is `POST /api/auth/login` (`username`, which is an email or numeric username); profile comes from `GET /api/me` | `api_service.dart:10-12,168-198`, `providers/auth_provider.dart` |
| Session restore | `AuthProvider._init`: if a token exists → `_loadProfile()` (network). A non-401 failure leaves `userId` set and `profile=null` → app proceeds to `/home` → `CoachAppState.load()` fails → `_ShellError` full-screen "CAN'T REACH THE GYM" | `auth_provider.dart:32-73`, `home_screen.dart:46-62,120-191` |
| Logout | `AuthProvider.signOut` (best-effort `POST /api/auth/logout`, delete token) + `CoachAppState.clear()` | `home_screen.dart:80-86`, `api_service.dart:189-198` |
| Fresh-install guard | **Absent** (the member app has `FreshInstallGuard`, which wipes the iOS Keychain on first install) | `gym_mobile_flutter/lib/services/fresh_install_guard.dart` |
| Lifecycle hooks | **None** (no `WidgetsBindingObserver` / `AppLifecycleListener`) | grep |
| Connectivity | **None** (no `connectivity_plus`). The only offline signal is the error copy | grep |
| Background work | **None** (no workmanager/background_fetch). No FCM messaging in the coach app (Crashlytics only) | pubspec |
| Local storage | `flutter_secure_storage`: `auth_token`, `user_id`, `gym_branding` (JSON). `shared_preferences` is declared but **unused**. No SQLite/Hive/Isar | `api_service.dart:10-12`, `providers/branding_provider.dart:8` |
| Flavors / env | `--dart-define-from-file=flavors/coaches.json` (`API_URL`, `GYM_ID` (optional single-tenant lock, unused in logic), `IS_STAGING`, `BRAND_NAME`). No Android/iOS flavors (unlike the member app) | `lib/utils/env.dart`, `flavors/coaches.json` |
| Platform | iOS 15.0 deployment target. iOS plugins via **SwiftPM** (`FlutterGeneratedPluginSwiftPackage`, commit aee9b6c). Android uses the Flutter defaults for min/compile SDK. Bundle id `com.clbyapp.coachesapp` | `ios/Podfile:2`, `project.pbxproj:21,476` |
| Permissions | No `NSCameraUsageDescription` (iOS). Release `AndroidManifest` declares no `INTERNET`; it's presumably merged from Firebase AARs **[unconfirmed]** | `ios/Runner/Info.plist`, `android/app/src/main/AndroidManifest.xml` |
| Tests | 1 file, 2 unit tests (`CoachProfile.fromJson`) | `test/widget_test.dart` |
| Analyzer | `flutter analyze`: 0 issues in `lib/`. The only 2 hits are in a stray `build/ios/SourcePackages` copy | ran |

---

## 2. Current "attendance" behaviour and API [confirmed]

### Screens (bottom nav: Scan · Members · Log)
| Screen | LOC | What it does | API |
|---|---|---|---|
| `QrScreen` (home tab) | 193 | Shows the coach's static QR `jsonEncode({type:'specialist_session', gym_id, trainer_id})` (`qr_screen.dart:72-78`) plus a link to Manual log | `/api/coach/me` |
| `MembersScreen` | 510 | Roster of assignments (active/low/inactive). **Client-side** text search over the in-memory roster (`members_screen.dart:42`) | `/api/coach/roster` |
| `AttendanceScreen` ("Log") | 705 | Today's delivered sessions, plus per-assignment history picker | `/api/coach/today`, `/api/coach/assignments/{id}/history` |
| `ManualLogScreen` | 299 | Pick an assignment → Confirm → `CoachAppState.confirmSession` → decrement. Handles `recently_logged` 409 | `POST /api/coach/sessions/decrement` |
| `MemberDetailScreen` | 812 | Package card + session history grouped by month. Inline note edit | history, `PATCH /api/coach/sessions/{logId}` |
| `widgets/scan_overlay.dart` | 505 | **Unused** (not referenced anywhere). Prototype sheet with idle/scanning/confirm/blocked/success states, useful as Phase 2 UX scaffolding | — |
| `widgets/qr_pattern.dart` | 130 | **Unused** decorative QR | — |

`CoachAppState.confirmSession` does an optimistic decrement and rolls back on `ApiException`. It's purely online; nothing is queued (`coach_app_state.dart:95-153`).

### Server: `clby-api/routes/api.php:245-252`
Middleware stack: `auth:sanctum` → `RequireGymId` → `coach` (`RequireCoachRole`) → `LogActivityMiddleware`.
- `RequireCoachRole` (`app/Http/Middleware/RequireCoachRole.php:23-55`) requires `role === 'trainer'`, `is_active`, not deleted, and an active `trainer_profiles` row with `profile_id = user.id` and `gym_id = user.gym_id`. It stashes `{id,name,trainer_type,gym_id}` as `request->get('coach')`. gym_admin/staff are explicitly excluded.
- Endpoints (`app/Http/Controllers/CoachController.php`): `me` (:45), `roster` (:73, `a.gym_id = user.gym_id AND a.trainer_id = coach.id`), `decrement` (:163), `today` (:~290, `Carbon::today()` in app TZ=UTC, not gym-local), `assignmentHistory` (limit 50), `updateNote`.
- **`decrement` semantics** (:163-284): row-locks the assignment. Checks ownership (`trainer_id`), `status='active'`, not exhausted, not expired. **30-minute guard against server `now()`**. Inserts `service_session_logs` with `delivered_at = now()`, increments `sessions_used`, and flips the assignment to `completed` when exhausted. **No idempotency key.** A retry after a lost response is only stopped by the 30-min guard, which returns a 409 `recently_logged`, not the original result.
- The member-side counterpart is `POST /api/specialists/scan` (`routes/api.php:207`, `SpecialistScanController`), throttled at 60/min. The member scans the coach QR, and the server derives gym from `user.gym_id`.
- The admin path uses `service_attendance` (migration `2026_08_22_120000`): source event table, statuses attended/absent/cancelled, `recorded_by`, reversal columns, and a partial unique index `(assignment_id, attended_at) WHERE status='attended' AND reversed_at IS NULL`. Only `attended` rows create a `service_session_logs` row. **Coach `decrement` does not write `service_attendance`.** That's an inconsistency the backend auditor should weigh in on.

### What a coach can see
Only their own assignments: member id/name/photo/member_number/joined_at, package, balance, expiry, last session. No membership (gym-access) status, no branches, no classes, no gym-wide member list. The coach also can't see `attendance_logs`.

### Coach → branch / class scoping (server, today)
- `trainer_profiles.branch_id` (nullable FK) and `trainer_branches(trainer_id, branch_id)` exist (checked on the local `clby_dev` DB, which is **stale** vs migrations; for example `service_session_logs` is missing there). **No coach endpoint uses either.**
- `classes.trainer_id → trainer_profiles` exists. `class_sessions` has `branch_id`, `studio_id`, and a free-text `instructor`, but no `trainer_id`. `attendance_logs` has `branch_id` and `class_session_id`, and is written by DB functions (`validate_studio_access` etc.).
- So for the spec's "coaches only access assigned branches/classes", **neither the authorization model nor the endpoints exist yet.**

### Member QR (relevant to any future coach `staff_qr`)
`QrTokenController::generate` signs `{sub,gym,exp}` with **HMAC-SHA256 using one global server secret**, TTL 60 s (`QrTokenController.php:10,15-40`). A device cannot verify it offline without holding the secret, and shipping the secret is unacceptable. Offline staff-QR validation therefore needs an **asymmetric** (e.g. Ed25519) signed member credential with a public key cached on the device. That's a backend/member-app decision; flagged here because it gates coach Phase 2.

---

## 3. Maturity (quantified) [confirmed]

- 34 Dart files, 6,279 LOC. Feature code: 5 screens (2,519 LOC), state+models (446), widgets (~1,500 incl. 635 unused).
- Exists and reusable for Phase 2: auth/session, branding, roster list + client-side search UI, manual-log picker/confirm UI, history UI, design system (`AppColors`/`AppText`/`CButton`), and the unused scan-sheet state machine.
- Must be built from scratch: QR scanner (camera + permission strings), any class/session attendance UI, a gym-membership-aware member cache, connectivity/sync status UI, a pending/rejected queue UI, a sync summary screen, an offline-capable session restore, and **all** local persistence and sync.
- Backend for the coach app is missing: branch/class-scoped coach endpoints, an offline-data snapshot endpoint, an idempotent event ingestion endpoint, and device registration.

---

## 4. Local storage decision

| Option | Restart-safe | Queryable search | Outbox w/ states | Encryption | Verdict |
|---|---|---|---|---|---|
| `shared_preferences` / secure storage JSON | yes | no (load-all) | fragile, no txns | secure storage only (small values) | ✗ |
| Hive / Isar | yes | limited / yes | no SQL txns across tables (Hive). Isar maintenance uncertain | Hive AES box | ✗ for new work |
| sqflite (+ sqflite_sqlcipher) | yes | SQL | yes | separate plugin | workable, but no typed schema/migrations/streams |
| **Drift (SQLite) on `package:sqlite3` 3.x** | yes | SQL + FTS5 available | yes, typed, transactions, reactive `watch()` streams for status UI | built-in via hook `source: sqlite3mc` (SQLite3MultipleCiphers) or `sqlcipher` | **✓ recommended** |

Verification [confirmed via `flutter pub get` in a scratch project, Flutter 3.44.7 / Dart 3.12]: `drift 2.35.4`, `drift_dev 2.35.3`, `drift_flutter 0.3.1`, `sqlite3 3.5.2`, `build_runner 2.15.1`, `connectivity_plus 7.3.2`, `uuid 4.6.0` all resolve alongside `flutter_secure_storage ^9.2.4`. drift/drift_flutter need SDK ≥3.10, and both apps declare `sdk: ^3.11.1`, so they're compatible.

Facts from the `sqlite3-3.5.2/doc/hook.md` docs:
- `sqlite3` 3.x bundles SQLite through **Dart build hooks (native assets)**. It downloads hash-pinned prebuilt binaries from GitHub releases **at build time** (so the build machine needs network access).
- Encryption is selected with `hooks: user_defines: sqlite3: source: sqlite3mc` (or `sqlcipher`). **`user_defines` are read from the app / workspace-root pubspec, not from a dependency's pubspec.** Each app must declare it, or the repo adopts a pub workspace.
- `sqlcipher_flutter_libs` / `sqlite3_flutter_libs` are EOL no-ops. Do not add them.
- Recommend **`sqlite3mc`** (default build, MIT-style licence, current SQLite version, supports the `PRAGMA key`). SQLCipher links OpenSSL on Android and may lag SQLite versions.

Build implications:
- iOS: native-assets frameworks are embedded. **The known gotcha applies** (memory `feedback_flutter_native_assets_simulator_leak`): run `flutter clean` before `flutter build ipa` after a simulator run, or Apple rejects the build with ITMS-90000 409. Add this to both release checklists. SwiftPM migration is unaffected (hooks don't use CocoaPods/SwiftPM) **[unconfirmed: test an archive in Phase 1]**.
- Android: the hook ships `.so` files per ABI, adding roughly 1–2 MB per ABI **[unconfirmed]**.
- Codegen: `drift_dev` + `build_runner` (dev-deps, inside the shared package only). Commit the generated `*.g.dart` so app builds never need codegen.
- Host unit tests: `NativeDatabase.memory()` on macOS through the same hook **[unconfirmed that `flutter test` runs the hook in a path package; verify first thing in Phase 1]**.

Key management: generate a random 32-byte key with `Random.secure()`, store it base64 in `flutter_secure_storage` (`IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device)`, `AndroidOptions(encryptedSharedPreferences: true)`), and apply it with `PRAGMA key` in Drift's `setup` callback (`drift_flutter` `DriftNativeOptions.setup` confirmed in `drift_flutter-0.3.1/lib/src/native.dart:133`).
- iOS Keychain survives uninstall but the DB file doesn't → harmless. Pair it with `FreshInstallGuard` in the coach app.
- Android: Keystore keys aren't restorable from backup, so a restored DB would be undecryptable. Disable or exclude the DB and secure prefs from Auto Backup (`android:allowBackup="false"` or `dataExtractionRules`). Neither manifest sets this today.
- If the key is missing but the DB exists → treat as corrupted. Quarantine-rename the file (never silently delete if `pending_events` might exist), show a "local data unreadable" notice, and re-bootstrap.

---

## 5. Gaps vs spec (coach app)

| Spec item | Status |
|---|---|
| Cached assigned classes | ✗ No class concept in coach app or coach API |
| Cached authorized member lists | ✗ in-memory only. Roster = PT clients, not gym members |
| Offline QR scanning (`staff_qr`) | ✗ no scanner. Member QR is HMAC with a global secret → not verifiable offline |
| Manual attendance offline | ✗ online-only decrement. The UI exists |
| Offline history | ✗ fetched live, never cached |
| Pending status / sync UI / indicator | ✗ |
| Auto-sync triggers (start/resume/connectivity) | ✗ no lifecycle, no connectivity |
| Offline app start | ✗ blocked by `_ShellError` and by `AuthProvider` needing `/api/me` |
| Branch scoping for coaches | ✗ server ignores `trainer_branches` / `trainer_profiles.branch_id` |
| Idempotent server ingestion | ✗ decrement has no event_id. Server-time guard |
| device_id / device binding | ✗ |
| Encrypted local data | partial (token in secure storage, default options). No DB |
| Logout policy for pending events | ✗ (logout clears everything in memory, but there's nothing persisted to protect) |
| 401 handling compatible with sync | ✗ `_parse` wipes the token on any 401, so a sync 401 would silently log out. It must not touch the outbox |
| Camera permission strings | ✗ iOS `NSCameraUsageDescription` missing |
| Tests | 2 trivial unit tests |

---

## 6. Open questions / risks

1. **(Blocking for Phase 2 scope) What does coach "attendance" mean?** (a) PT/service sessions only: offline-ify the existing decrement via `service_attendance`, with a new `attendance_method` on that path. (b) Class attendance for classes where `classes.trainer_id = coach`: needs a new authz model plus endpoints. (c) Gym check-in (`attendance_logs`) by coaches: today only staff/admin do this. The spec's event model (`class_id`, `branch_id`) fits (b)/(c). The existing app fits (a). **Recommendation:** make the shared event model polymorphic with `event_type` (`gym_checkin | class_attendance | service_session`) plus a nullable `assignment_id`, so Phase 1 doesn't paint us into a corner. The PO decides which types the coach can create.
2. **Balance-consuming events offline** (service sessions decrement a finite pack). Offline, two devices or a stale cache can overdraw. The server must be allowed to reject (`exhausted`/`expired`), and the client must show "Rejected — not accepted by server". **The 30-min guard must be evaluated against `device_recorded_at`, not server `now()`,** or late-arriving events are wrongly blocked or wrongly allowed. Backend decision.
3. **Coach branch authorization source of truth:** `trainer_branches` vs `trainer_profiles.branch_id` (null = all branches?). Unconfirmed semantics.
4. **Offline staff-QR needs an asymmetric member credential** (see §2). Until then a coach can only do "manual" offline, or accept QR offline as `unverified` (the spec forbids accepting unverified identity).
5. **Firebase major-version split** between apps (coach `firebase_core 4.9.0`, member `3.15.2`). The shared package must **not** depend on Firebase, Provider, GoRouter or `http` versions that conflict. Keep its deps minimal (`drift`, `sqlite3`, `flutter_secure_storage ^9.2.4` (identical in both), `connectivity_plus`, `uuid`, and an injected HTTP transport).
6. Build-time network dependency of `sqlite3` hooks (GitHub release download). Mobile builds are local, so this is acceptable. Pin through the lockfile.
7. Local `clby_dev` DB is stale vs migrations, so backend Phase 1 tests must migrate a fresh DB.
8. `today()` uses a UTC day, not the gym-local day (minor; affects "today" history consistency with the offline cache).

---

## 7. Phase 1 Flutter shared-core proposal

### 7.1 Package layout and wiring
```
packages/clby_offline/                 # pure-Flutter package, no UI, no provider/go_router
  pubspec.yaml                         # sdk ^3.11.1; deps: drift ^2.35, drift_flutter ^0.3,
                                       #   sqlite3 ^3.5, flutter_secure_storage ^9.2.4,
                                       #   connectivity_plus ^7, uuid ^4, meta, clock
                                       # dev: drift_dev, build_runner, test, fake_async
  lib/clby_offline.dart                # public API barrel
  lib/src/db/  offline_database.dart (+ .g.dart committed), tables/*.dart, daos/*.dart, migrations/
  lib/src/crypto/  db_key_store.dart   # key gen + secure storage
  lib/src/identity/ device_id.dart
  lib/src/model/   attendance_event.dart, enums.dart, sync_result.dart, offline_policy.dart
  lib/src/sync/    sync_engine.dart, sync_transport.dart (abstract), backoff.dart, triggers.dart
  lib/src/cache/   snapshot_importer.dart, readiness.dart
  lib/src/session/ offline_session.dart  # open/close per (user_id, gym_id) scope; logout policy
  test/            ...
```
- Each app adds `clby_offline: {path: ../packages/clby_offline}` plus, in **its own pubspec**, `hooks: user_defines: sqlite3: source: sqlite3mc`. An alternative is converting the repo to a pub workspace (root `pubspec.yaml` with `workspace:`), but both apps would need `resolution: workspace` and a shared lock, which collides with the Firebase 3 vs 4 split. **Recommendation: path dependency, not a workspace.**
- Each app implements `SyncTransport` with its existing `ApiService` (token, base URL, error mapping), so the package never owns auth. The package exposes `Stream`s; each app wraps them in its own `ChangeNotifier`.
- Only one copy of DB/sync logic exists. Phase 4's web dashboard gets a TS port of the same state machine and contracts (same enums and JSON).

### 7.2 Drift schema (v1)
All tables carry `owner_user_id` + `gym_id` (scope). Timestamps are stored as UTC ISO-8601 text (or int ms) plus a separate tz name.

**`pending_events`** (outbox, never hard-deleted while unsynced)
| column | type | notes |
|---|---|---|
| event_id | TEXT PK | UUID v4, client-generated idempotency key |
| event_type | TEXT | `gym_checkin \| class_attendance \| service_session` (see Q1) |
| owner_user_id | TEXT | recorded_by (profile id). Scope key |
| actor_type | TEXT | `staff \| coach \| member \| admin` |
| gym_id, branch_id | TEXT, TEXT? | |
| member_id | TEXT | gym_members.id |
| class_id / class_session_id | TEXT? | |
| assignment_id | TEXT? | service_session path |
| attendance_method | TEXT | `staff_qr \| member_qr \| manual` (CHECK) |
| device_id | TEXT | |
| device_recorded_at | TEXT/INT | immutable once inserted (enforced by DAO plus a trigger `BEFORE UPDATE OF device_recorded_at → RAISE`) |
| device_timezone | TEXT | IANA (`DateTime.now().timeZoneName` is not IANA → use `flutter_timezone` or offset+name **[decide]**) |
| monotonic_seq | INT | local autoincrement ordering tiebreaker |
| sync_status | TEXT | `pending \| syncing \| synced \| rejected` (CHECK). Plus local-only `blocked_auth` |
| sync_attempts | INT | |
| last_sync_error | TEXT? | |
| last_attempt_at, next_attempt_at | INT? | backoff schedule |
| server_received_at | TEXT? | from server |
| server_attendance_id | TEXT? | official record id |
| rejection_code | TEXT? | stable server code |
| metadata | TEXT (JSON) | qr payload hash (never raw token), note, app version |
| created_at | INT | |
Indexes: `(owner_user_id, gym_id, sync_status, device_recorded_at)`, `(member_id, device_recorded_at)`.

**Cache tables** (replaced wholesale per snapshot, inside one transaction):
- `cached_members(member_id PK, gym_id, branch_id?, display_name, name_search (normalized lowercase/diacritics-stripped), member_number, photo_url?, qr_public_ref?, updated_at)`. Optional FTS5 virtual table for search. No phone/email/DOB unless required.
- `cached_memberships(id PK, member_id, gym_id, plan_type, status, start_date, end_date, sessions_remaining?, last_known_at)`. **`last_known_at` is displayed. Never shown as live.**
- `cached_service_assignments(assignment_id PK, member_id, trainer_id, sessions_total, sessions_used, expires_at, status, last_known_at)` (the coach's current data).
- `cached_branches(branch_id PK, gym_id, name, qr_verify_key?)`.
- `cached_classes(class_session_id PK, class_id, gym_id, branch_id, starts_at, ends_at, name, trainer_id?)`.
- `recent_attendance(id PK, member_id, gym_id, branch_id?, class_session_id?, assignment_id?, occurred_at, source ('server'|'local'), event_id?)`. Feeds the Level-1 duplicate check, and the window comes from the server policy.
- `sync_meta(scope_key PK = '$userId:$gymId', last_snapshot_at, last_successful_sync_at, snapshot_version, policy_json, cached_member_count, cached_class_count)`.
- `kv(key PK, value)` (schema bookkeeping only. Not for secrets).

### 7.3 Encryption and key management
One DB file per install (`clby_offline.db` in app support dir) encrypted with sqlite3mc using a 256-bit key stored in secure storage (`clby_offline_db_key_v1`). The key is never logged or sent. Before writing the DB, verify that `PRAGMA cipher`/`key` is applied, and fail closed if the build isn't sqlite3mc (`SELECT sqlite3mc_version()` check). Add `FreshInstallGuard` to the coach app and exclude the DB from Android backup. Also set the secure-storage options for the token in both apps.

### 7.4 Per-user / per-gym scoping and logout policy
- Every query in DAOs requires a `Scope(userId, gymId)` and adds a `WHERE owner_user_id=? AND gym_id=?` filter. There's no unscoped read API.
- **Login as a different user:** a different scope, so the cache of the previous scope is **purged** (caches are cheap to re-download). Pending events of the previous scope remain but are invisible and unsyncable under the new token; the server would reject them anyway because the actor ≠ token.
- **Logout:** (1) if online, attempt a final sync flush (bounded, e.g. 10 s); (2) if pending/rejected events remain, show a blocking dialog: "N attendance records not yet synced. Sign out anyway? They'll sync next time *this account* signs in on this device." (3) purge cache tables for the scope; **keep** `pending_events`; (4) delete the token. There's no "discard" option without an explicit, audited admin action (Phase 5).
- **401 during sync:** set events back to `pending`, pause the engine (`blocked_auth`), and surface "Sign in to sync". Change `ApiService._parse` so the sync transport can see a 401 without the outbox being touched. Wiping the token is acceptable; wiping events is not.
- **403 / revoked access / gym change:** mark per-event `rejected` with a code, purge the cache for that scope, and keep the events for audit display.

### 7.5 Sync engine API
```dart
abstract class SyncTransport {            // implemented per app over ApiService
  Future<SyncBatchResponse> postBatch(SyncBatchRequest req);  // POST /api/attendance/sync
  Future<OfflineSnapshot> fetchSnapshot(Scope s, {String? sinceVersion});
}
class SyncEngine {
  SyncEngine(OfflineDatabase db, SyncTransport t, {required Scope scope, OfflinePolicy policy, Clock clock});
  Stream<SyncStatus> get status;          // online/offline/syncing/pending(n)/failed/expired
  Future<SyncRunResult> syncNow({SyncTrigger trigger});   // single-flight
  Future<void> refreshSnapshot();
  void attachTriggers(Connectivity c, AppLifecycleListener l); // start, resume, regained, screen-open
  Future<void> dispose();
}
class AttendanceRecorder {               // UI-facing write API
  Future<RecordOutcome> record(NewAttendance a); // L1 dup check (recent_attendance + pending) → insert pending → kick sync
}
```
Rules:
- **Single-flight**: one in-flight `Future`. Concurrent calls await the same run. Also take a DB-level lease (`sync_meta.lock_until`) so a background isolate can't double-run.
- **Crash recovery** on open: `UPDATE pending_events SET sync_status='pending' WHERE sync_status='syncing'`. Safe because the server is idempotent by `event_id`.
- **Selection**: `pending` events in scope with `next_attempt_at <= now`, `ORDER BY device_recorded_at, monotonic_seq`, `LIMIT policy.maxBatch` (default 50; server caps too). Mark them `syncing` and increment `sync_attempts` in one transaction *before* the request.
- **Per-event result**: `accepted`/`duplicate` (same event_id seen; server returns original `attendance_id` + `server_received_at`) → `synced`. `rejected` (permanent code) → `rejected` + `rejection_code`, kept visible. `retryable` → `pending` + backoff. Any event missing from the response → `pending` (treat as transient).
- **Transport failure** (timeout/socket/5xx/429): the whole batch goes back to `pending`. Exponential backoff `min(base·2^n, cap)` with full jitter (base 5 s, cap 15 min; honour `Retry-After`). **Never delete on timeout.**
- Event rows are never deleted by the engine. A retention job prunes `synced` events older than N days (default 30) only.
- **Triggers**: app start (if scope exists), `AppLifecycleState.resumed`, `connectivity_plus` transition to non-`none` (debounced 2 s, then actual reachability is proven by the request), attendance screen open, after each local record, periodic timer while foregrounded (e.g. 60 s while pending > 0). Background (workmanager / BGTaskScheduler) is **not in Phase 1**; best-effort only in a later phase.

### 7.6 device_id
UUID v4 generated once, stored in secure storage `clby_device_id_v1` (first_unlock_this_device), and sent on every sync batch (and ideally registered server-side and bound to the user on login, which is a backend decision). With `FreshInstallGuard` it regenerates on reinstall. That's acceptable, and the server should treat it as evidence, not authorization.

### 7.7 Offline policy (client side)
The `OfflinePolicy` value object is delivered in the snapshot (server-authoritative), with compiled-in conservative defaults: `enabled`, `maxDataAge` (default 24 h → "Offline data expired" state, blocks new offline records or flags them, depending on PO), `maxOfflinePeriod`, `allowManual`, `allowStaffQr`, `allowMemberQr`, `expiredMembershipBehavior (block|record_flagged)`, `maxBatch`, `retry{base,cap}`, `localDuplicateWindow` (**from server's existing rules**: the service path has a 30-min guard; check-in rules come from the backend auditor).

### 7.8 Phase 1 unit tests (package, `NativeDatabase.memory()` + fake transport + `fake_async`/`clock`)
1. Event creation persists all spec fields. `device_recorded_at` is immutable (the update attempt throws).
2. Persistence across "restart": close and reopen a file-backed encrypted DB with the same key → events intact. Wrong key → open fails (fail-closed).
3. Ordering: the batch is ordered by `device_recorded_at`, then `monotonic_seq`, and respects `maxBatch`.
4. Single-flight: two concurrent `syncNow` calls produce exactly one transport call.
5. Per-event results: mixed accepted/duplicate/rejected/missing → correct statuses. The duplicate stores the original `attendance_id`.
6. Timeout after the server processed: the first call throws → events stay `pending`. The retry returns `duplicate` with the original id → `synced`, and the event isn't lost or duplicated locally.
7. Crash mid-sync: rows left `syncing` → reset to `pending` on open.
8. Backoff: attempts schedule `next_attempt_at` correctly, and `Retry-After` is honoured. Rejected events aren't retried.
9. 401 → events stay intact, engine `blocked_auth`. 403/revoked → rejected with code, cache purged, events retained.
10. Scope isolation: user B can't read user A's cache or events. Logout keeps pending events and purges cache.
11. Level-1 duplicate check: a second record for the same member inside the window → `RecordOutcome.duplicateLocal` (pending + recent_attendance).
12. Snapshot import is atomic (a failure mid-import leaves the previous snapshot intact) and updates counts/readiness. Staleness → `expired` status.
13. Clock skew: a device time far in the future/past is still stored verbatim. Ordering stays deterministic via `monotonic_seq`.
14. Large queue: 5,000 events drain in batches without starving the UI; a query plan check on the index.
Plus a contract test (golden JSON) for `SyncBatchRequest`/`Response`, shared with the backend auditor's Laravel feature tests.

### 7.9 Phase 1 coach-app touch points (minimal, non-UI)
Add the path dep + `hooks.user_defines`. Add `FreshInstallGuard`. Secure-storage options. Let the transport observe a 401 without the outbox being wiped. Change `AuthProvider` restore so a network failure with a cached profile doesn't block (cache the `CoachIdentity` + profile in the DB or secure storage). Open/close `OfflineSession` on login/logout. Leave the attendance UI for Phase 2.
