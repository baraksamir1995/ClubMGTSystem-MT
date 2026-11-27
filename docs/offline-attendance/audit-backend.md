# Offline attendance: backend audit (clby-api)

Worktree `ClubMGTSystem-MT-offline`, branch `feat/offline-attendance` (based on `main` 82ed424). Read-only audit, 2026-11-26.
Paths are relative to `clby-api/` unless stated. "DB" means local `clby_offline` (psql `\d` / `pg_get_functiondef`).

> **Local DB drift.** `clby_offline.migrations` contains `2026_11_26_100000_add_app_layout_to_gyms` and `2026_11_26_110000_create_store_and_events`. Neither exists in this worktree; they come from the other in-progress branch. The DB already has an **`events` table** (gym events/registrations). **Do not name any new table `events`.** Use `attendance_events`.

---

## 1. Attendance schema (confirmed in DB)

### `attendance_logs` is the single official attendance record
The table is legacy Supabase. No Laravel migration creates it.

| column | type | notes |
|---|---|---|
| id | uuid PK, default `uuid_generate_v4()` | |
| gym_id | uuid NOT NULL, FK gyms | |
| gym_member_id | uuid NOT NULL, FK gym_members | |
| check_in_at | timestamptz NOT NULL, default now() | `store()` accepts a client-supplied value, so backdating already exists |
| method | text | values seen: `qr` (2705), `manual` (1), `admin` (1). Mobile/admin also send `manual`. No CHECK constraint |
| access_point | text | free text (branch name / class name / "Gym Access") |
| class_session_id | uuid FK class_sessions | NULL means gym-floor entry |
| studio_id | uuid FK studios | |
| branch_id | uuid FK branches | nullable; `store()` leaves it NULL unless the client sends it |
| specialist_name | text | |
| check_out_at | timestamptz | unused by the API |
| created_at / updated_at | timestamptz | trigger `trg_attendance_logs_updated_at` |

Indexes: pkey; `idx_attendance_logs_branch_id`; `_checkin (check_in_at)`; `_class_session_id` partial (NOT NULL); `_gym`; `_gym_date (gym_id, check_in_at DESC)`; `_member`; `_member_checkin (gym_member_id, check_in_at DESC)`; `_studio_id`.
- **There is no unique constraint of any kind**, not even on (member, class_session). All duplicate prevention lives in application code or SQL functions, and every check is a racy check-then-insert.
- RLS policies exist but are inert: Laravel connects as the owner and RLS is not forced.
- **Rows get hard-deleted:** `MemberController.php:724`, `SuperAdminController.php:121` (member/gym deletion), `SessionController.php:381` (stop recurring), `BookingController.php:243` (revert of `method='admin'` rows). Any FK from a new table to `attendance_logs` must use `ON DELETE SET NULL`.
- Consumers: `AttendanceController::index` (:18), `SessionController::sessionLogs` (:494), `AnalyticsController.php:90,108`, `MembershipController.php:209`, `MemberController::show` (last 20). None of them filter on `method`, so new method values are safe for reports. This was confirmed by grep. The SQL `get_gym_dashboard_stats` was not inspected.

### Related tables
- `session_bookings`: UNIQUE `(session_id, gym_member_id)` plus partial unique `WHERE status <> 'cancelled'`. `status` takes confirmed/booked/attended/absent/... values.
- `class_sessions`: gym_id, class_id, branch_id, studio_id, session_date, start_time, end_time, capacity, booked_count, status, `walk_in_allowed`, is_published.
- `member_memberships`: status, payment_status (`paid`|`pending`), start_date, end_date, sessions_total/used/remaining, freeze_status, source_type (`subscription`|`transfer`), transferred_from, branch_id, `allowed_branch_ids text[]`. UNIQUE partial `idx_one_active_subscription_per_member`.
- `membership_plans`: plan_type (`sessions`|`duration`|`duration_session`), `access_scope` (all 25 rows are `all_branches`), `allowed_branch_ids`.
- `check_ins`: legacy and **unused** (0 rows, no code references). Ignore it.
- `service_attendance` + `service_session_logs` + `member_service_assignments`: PT/physio "services" attendance. This is a separate system and not gym or class attendance (see section 2).

### SQL functions that touch attendance (current definitions, from `pg_get_functiondef`)
| function | migration | behaviour |
|---|---|---|
| `log_gym_attendance_by_token(member, token uuid)` | `2026_05_07_120000_qr_attendance_rpcs.php:73` | Finds the branch by `qr_token` and denies if not found or inactive, then **INSERTs an attendance_logs row unconditionally**. It sets gym_id to the *branch's* gym and checks no membership, no payment, no allowed_branch_ids, no duplicates and no gym match. Not SECURITY DEFINER. |
| `validate_gym_qr_token(token)` | same:26 | Read-only. Returns `{valid, branch_id}`. |
| `regenerate_branch_qr_token(branch, gym)` | same:51 | Sets a new `gen_random_uuid()` token. |
| `validate_studio_access(studio, user)` | latest `2026_06_03_120000_studio_access_requires_session_plan.php:45` (earlier: 04_24, 04_25, 05_01, 05_13) | Full class check-in for a member scanning a **studio QR**. Uses gym tz. Needs a paid, active, non-frozen, session-capable bucket in allowed_branch_ids with remaining sessions. The session must be "now" (start-15 min to end, :161). Booking `attended` gives `already_attended`. No booking and no walk-in gives `no_booking`. Walk-in with an existing log gives `already_attended` (:179-186). Sets booking to attended, INSERTs the log (method `qr`), and decrements the bucket. |
| `validate_branch_access(member, branch)` | `2026_04_25_100000_exclude_transferred_from_gym_access.php:13` | Read-only. **Latent bug:** it compares `p_branch_id (uuid) = ANY(allowed_branch_ids text[])`. Postgres raises `operator does not exist: uuid = text`, which I reproduced with an equivalent literal, so the function errors whenever `allowed_branch_ids` is non-null. No client calls `/access/branch` today. |
| `checkin_member(session, member)` | none (legacy) | Upserts `session_bookings` to `attended`. **Writes no attendance_logs row and no decrement.** |
| `consume_class_session(member)` | none (legacy) | Increments `sessions_used` on an arbitrary active sessions bucket (no ORDER BY). |
| `add_attendance_log(...)` | none (legacy) | Unused by the API. |

---

## 2. Attendance creation paths

Route groups in `routes/api.php`:
- **M** (members+admins, :139) = `auth:sanctum, RequireGymId, verified_member, LogActivityMiddleware`. `verified_member` lets admin-class roles through.
- **A** (:255) = `auth:sanctum, RequireGymId, RequireAdminRole(gym_admin|staff|trainer|super_admin), LogActivityMiddleware`.
- **C** (:245) = `auth:sanctum, RequireGymId, coach(role=trainer + active trainer_profiles row)`.
- Global `throttleApi('300,1')` (`bootstrap/app.php`).

| # | Endpoint | Grp / perm | Code | Writes | Validation |
|---|---|---|---|---|---|
| P1 | `POST /attendance` (:335) | A, `permission:attendance,create` | `AttendanceController::store` :129-307 | attendance_logs (method default `manual`); decrement for class entries; `logActivity('checkin')` | Member in gym and not deleted (:152). Active bucket with `end_date >= today (UTC)` (:170). **Does not check `payment_status='paid'` or `gym_members.status`.** Plan capability matrix (:207-249). Class entry: usable non-frozen bucket with remaining sessions (:215). **Does not validate that `branch_id`, `studio_id` or `class_session_id` belong to the caller's gym (FK only), or allowed_branch_ids, session time, booking or capacity.** Client `check_in_at` accepted as is. Decrement at :275 sets used+1 and remaining-1 (GREATEST). |
| P2 | `POST /attendance/qr` (:200) | M | `logByQr` :309 → `log_gym_attendance_by_token` | attendance_logs (`qr`, branch name) | Member resolved via `scopedMemberId` (member: self; admin: any in gym). Everything else per the table above. **Cross-tenant write possible:** a member of gym A who submits gym B's branch token gets a row with `gym_id=B` and `gym_member_id` from A. No membership check, so expired or unpaid members check in successfully. |
| P3 | `POST /access/studio` (:199) | M | `AccessController::validateStudio` :95 → `validate_studio_access` | booking to attended, attendance_logs (`qr`), decrement | See the SQL row above. Studio must be in the caller's gym (:122). |
| P4 | `PUT /bookings/{id}/status` (:310) | A, `classes\|attendance,edit` | `BookingController::updateStatus` :137 | to attended: `sessions_used+1` (**not** sessions_remaining, which is inconsistent with P1/P3), log (`admin`); revert: −1 and delete `admin` log | Booking session in gym. Locked picker `start_date DESC FOR UPDATE`. Only acts on a transition (old≠attended). |
| P5 | `POST /sessions/{id}/checkin` (:302) | A, `classes\|attendance,edit` | `SessionController::checkin` :276 → `checkin_member` | booking only (no log, no decrement) | **No gym scoping of the session or the member** (cross-tenant booking write). Used by admin `app/api/classes/[id]/checkin` and mobile `markSessionAttended`. |
| P6 | `POST /sessions/checkin` (:155) | M | `checkinGeneric` :294 | booking only | Member/class scoped to the gym. Picks the next scheduled session of the class. |
| P7 | `POST /sessions/consume` (:154) | M | `consume` :463 | sessions_used | Member scoping only. |
| P8 | `POST /coach/sessions/decrement` (:248), `POST /specialists/scan` (:207), `POST /service-attendance` (:402) | C / M / A | Coach, SpecialistScan, ServiceAttendance controllers | `service_session_logs` / `service_attendance` | PT-package sessions, **not attendance_logs**. |

**Side effects:** no push/FCM, notification, or queued job on any check-in (grep: `PushService` is used only by announcements, session cancel and test push). Member-app Firebase Analytics `logCheckIn` runs client-side (`api_service.dart:900,921`). `member_number` is not touched. Audit rows go to `staff_activity_logs` through `LogActivityMiddleware` (every successful write by any gym user, members included) and `LogsActivity::logActivity` (P1, service attendance).

**Coach app:** it does **no gym or class attendance today.** It only displays its own static specialist QR (`coaches_mobile_flutter/.../qr_screen.dart:74`, `{type:'specialist_session', trainer_id}`) and logs PT sessions (P8). It has no scanner dependency (`mobile_scanner` is absent from its pubspec). A trainer *could* call P1 if their staff role has the `attendance` module.

### Endpoints each client calls for attendance/QR (API-side view; the other auditors should confirm)
- **gym-admin:** `GET/POST /attendance` (proxy `app/api/attendance/route.ts`, POST sends `method:'manual'` plus class_session_id etc.); `GET /branches/{id}/qr-token`, `POST /access/qr/regenerate` (`gym-qr-modal.tsx`); `POST /sessions/{id}/checkin` (`app/api/classes/[id]/checkin`); `PUT /bookings/{id}/status`. **There is no member-QR scanner in gym-admin** (no scanner library in `package.json`).
- **gym_mobile_flutter** (`lib/services/api_service.dart`): `POST /attendance/qr` (:918, JSON gym QR with token); `POST /attendance` (:897, `scanGymQr`: legacy `gym:<id>` string and token-less JSON). **That route is admin-only, so these paths should return 403 for members** (inferred from routes, not run). `POST /access/qr/validate` (:906), `POST /access/studio` (:937), `POST /specialists/scan` (:961), `POST /sessions/checkin` (:987), `POST /sessions/{id}/checkin` (:997, admin-only, so 403 for members), `GET /attendance`. Comments at `member_provider.dart:333` and `qr_scanner_screen.dart:123` claim a "2-min cooldown" and an "atomic `checkin_gym_entrance` RPC". **Neither exists in the current backend.**
- **coaches_mobile_flutter:** `/coach/me|roster|today|sessions/decrement|assignments/{id}/history|sessions/{logId}`.

---

## 3. Existing duplicate-prevention rules (exhaustive)

| Path | Rule | Where |
|---|---|---|
| P1 class entry | Reject `422 "Already checked in for this session"` if any attendance_logs row exists for (gym_member_id, class_session_id). **Not atomic** (no lock, no unique index). | `AttendanceController.php:229-237` |
| P1 gym entry | **None.** Unlimited gym entries per member, per day, at any time. | :238-249 |
| P2 gym QR | **None.** | `log_gym_attendance_by_token` |
| P3 studio QR | Booking already `attended` gives `already_attended`. Walk-in with an existing log for the session gives `already_attended`. Only the session currently running (start-15 min to end, gym tz) is eligible. | `2026_06_03_…:155-186` |
| P4 booking | Acts only on a transition into or out of `attended`. Session cap enforced under `FOR UPDATE`. | `BookingController.php:150-188` |
| P5/P6 | Upsert on the booking unique key (idempotent). | `checkin_member` |
| P8 services | **30-minute guard** per assignment (`SCAN_GUARD_MINUTES = 30`). Service attendance is also idempotent on an exact `(assignment_id, attended_at)` match plus a partial unique index. | `CoachController.php:27,201`; `SpecialistScanController.php:36,140`; `ServiceAttendanceController.php:136-198,308` |

**Conclusion:** the only gym/class attendance rule is **one attendance per (member, class_session)**. There is no time window, same-day rule, or cooldown for gym-floor entry. The 30-min guard applies to PT services only. Under the spec ("do not invent a window"), gym entries should dedupe **only by event_id** unless product chooses a rule (decision D1).
- Local DB has 0 duplicate (member, class_session) pairs out of 10 class rows. **Prod was not checked.** Duplicates are possible today: P4 revert deletes only `admin` rows, and P1 and P3 race.

---

## 4. QR

| QR | Payload | Generated | Validated | Expiry / replay |
|---|---|---|---|---|
| Gym/branch entrance | JSON `{type:'gym_access', gym_id, branch_id, token}`. `token` = `branches.qr_token` (uuid). Legacy variants: same JSON without token, or `gym:<gym_id>` | gym-admin `components/attendance/gym-qr-modal.tsx:71`, printed and static. Token from `GET /branches/{id}/qr-token` (`BranchController.php:42`, `settings\|attendance,view`) | P2 (insert) or `validate_gym_qr_token` | **None.** The token is a static bearer secret until manually regenerated (`/access/qr/regenerate`, `settings,edit`). A photo of the poster allows remote check-in. Not signed. |
| Studio | JSON `{type:'studio', studio_id, …}` (`gym-admin/components/studios/studio-qr-modal.tsx:20`) | static | P3 (studio must be in the caller's gym) | None, but time-boxed by the "session running now" rule. |
| Specialist | `{type:'specialist_session', trainer_id}` | coach app / admin | P8 | 30-min guard |
| **Member QR** | **Does not exist in any client.** `QrTokenController` (:15 generate, :45 verify) issues HMAC-SHA256 `base64url(json{sub,gym,exp}).sig`, TTL 60 s, with secret `QR_TOKEN_SECRET` (`config/services.php:51`). Routes M :195-196. **No client calls it** (grep in all 3 apps). `qr_flutter` is in the member pubspec but has no `QrImageView` usage in `lib/`. `verify` is open to any authenticated gym user and does not check that `gym` equals the caller's gym. | | | 60 s exp, no nonce/jti, not usable offline |

**Can the current formats support offline validation?**
- Gym QR: a device can only "validate" it by caching `branches.qr_token`. Shipping that token to members leaks the secret that *is* the check-in credential. It is also not cryptographically bound to the gym (the cross-tenant bug in P2). **Not safe as is.**
- Member QR: the existing HMAC token can't be verified offline without distributing the server secret. It isn't used anyway, so a new format causes **no back-compat break**.

**Backward-compatible signed-format migration (proposal):**
1. **Gym QR v2:** keep the same JSON and **add** fields: `{type:'gym_access', gym_id, branch_id, token, v:2, kid, iat, sig}`. `sig` = Ed25519 (libsodium is built into the php:8.4 image and present locally) over a canonical string `gym_access|v2|gym_id|branch_id|token|iat|kid`. Deployed apps read only `type/gym_id/branch_id/token` (`qr_scanner_screen.dart:71-74`), so extra keys are ignored and the old flow keeps working. New apps verify `sig` offline against cached public keys (bootstrap `qr_keys[{kid, alg, public_key, not_before, not_after}]`) and check that `gym_id` equals the cached gym. The server re-verifies on sync. Replay: a static poster can't prevent replay offline. Mitigations are server-side (dedupe and per-member rules), plus an optional rotating variant shown on an online or pre-provisioned kiosk, where the server pre-issues signed `{iat, exp}` slots. Rotating keys means reprinting posters (`kid`). **Product decision D3.**
2. **Member QR (new):** an Ed25519-signed credential `{v:1, typ:'member', gym_id, gm_id, iat, exp}`, issued online to the member app and cached. Staff/coach devices verify it offline with the same public keys. A screenshot can be replayed until `exp`. Options: short `exp` (hours) plus refresh, or a device-bound key (member app keypair registered with the server; the QR carries a server-certified pubkey plus a fresh TOTP-style signature). **Decision D4.**
3. Fix P2 first, independently of offline work: require branch gym = caller gym and a membership check (see risks).

---

## 5. Branches, roles, tenant isolation

- `branches(id, gym_id, name, is_active, qr_token uuid NOT NULL unique-by-convention (no unique index!), …)`. `gyms.timezone`, `gyms.max_branches`.
- **Member to branch:** `member_memberships.allowed_branch_ids text[]` (NULL means all) and `.branch_id`, copied from `membership_plans.allowed_branch_ids/access_scope`. Enforced only in `validate_studio_access` (and the broken `validate_branch_access`). **Not enforced by P1 or P2.**
- **Staff to branch:** `staff_members.branch_id` and `manager_branch_ids json` exist but are **used only by the sales module** (`app/Services/Sales/SalesAccess.php`). Attendance has no staff branch scoping: any staff with the `attendance` module sees and acts on the whole gym. `GET /attendance` and `GET /members` have no branch filter. **`GET /members` (:213, group M) has no `permission:members,view`.** Any admin-class role, including trainers, lists every member, and `per_page` is unbounded.
- **Coach:** `trainer_profiles(id, profile_id→profiles, gym_id, branch_id, trainer_type, is_active)` + `trainer_branches(trainer_id, branch_id)`. Classes reference `classes.trainer_id`. `class_sessions.instructor` is free text, so there is no reliable coach-to-session link beyond `classes.trainer_id`.
- **Permissions** (`Middleware/CheckPermission.php:28-75`): module-level only (the action segment is ignored). gym_admin bypasses. Staff/trainer need an active `staff_members` row, then `staff_member_roles`, then `staff_roles` (same gym), then `staff_role_permissions.module`. `super_admin` reaching group A has no `gym_id` unless set (RequireGymId).
- **Tenant isolation:** always `$request->user()->gym_id` (single gym per profile). `ResolvesMemberScope` (`Controllers/Concerns/ResolvesMemberScope.php:62`) gives members self only and admins any member in their gym. Gaps: P2 cross-tenant insert, P5 unscoped, P1 foreign `branch_id/studio_id/class_session_id` not checked.

---

## 6. Device identity
- No device table. `profiles.fcm_token` is a single column (last device wins), set via `PUT /me` (`Auth/AuthController.php:472`).
- Sanctum tokens: every login is `createToken('auth-token')` (:172, :430) with no device name. Expiry is `SANCTUM_EXPIRATION` (default null, so tokens never expire). Logout deletes the current token. Password change revokes the others.
- Mobile headers send only Content-Type, Accept and Authorization (`api_service.dart:124-131`). No app-version or device header. No min-version gate in clby-api (that exists only in the Ippon fork).

## 7. Infrastructure
- Queue: `QUEUE_CONNECTION=database`, supervisord `queue:work --tries=3` (`docker/supervisor/supervisord.conf:42`). Jobs: `SendGymAnnouncementPush`, `SendGymRequestEmail`. Tests use `sync`.
- DB access goes through **PgBouncer in transaction mode** (`docker/pgbouncer`). Use `pg_advisory_xact_lock` (transaction-scoped), not session locks or LISTEN/NOTIFY.
- Rate limits: global `throttleApi('300,1')`. Named limiters `auth` 5/min/IP, `contact`, `gym-requests` (`Providers/AppServiceProvider.php:25-48`). Ad-hoc `throttle:60,1` / `120,1` on some routes.
- Audit: `staff_activity_logs(id, gym_id, staff_id→profiles, action, action_type, module, description, entity, entity_id uuid, details jsonb, ip_address, created_at)`. Written by `LogActivityMiddleware` (generic, one row per successful write request) and `Traits/LogsActivity` (explicit, failures swallowed).
- Timezones: `app.timezone=UTC`. The Postgres session tz is Africa/Cairo per `CoachController` comments (unconfirmed). P1 compares end_date to the **UTC** date, while P3 uses `gyms.timezone`.
- Sentry on exceptions. JSON error envelope varies (`{error}` vs `{message}`).

## 8. Gaps vs the spec

| Need | Exists / reusable | Missing |
|---|---|---|
| Idempotency key | Pattern in `ServiceAttendanceController` (lock, check, partial unique index, return original with `duplicate:true`) | No event_id anywhere; `attendance_logs` has no unique key |
| Batch sync endpoint | none | `POST /attendance/sync` |
| Event/outbox table | none (`events` name taken locally) | `attendance_events` |
| Device vs server timestamps | `store()` accepts `check_in_at` | device_recorded_at / tz / server_received_at storage; skew policy |
| Partial success / per-event results | none | per-event transaction plus result codes |
| Rate/batch limits | global 300/min | named `attendance-sync` limiter, max batch |
| Audit of rejected/conflicting events | staff_activity_logs (success only, middleware skips ≥400) | persisted rejected events |
| Device registration | none | `attendance_devices` bound to user + gym |
| Signed QR + replay | HMAC member token (unused), static branch token | Ed25519 keys, kid, v2 payload |
| Bootstrap/readiness | `/members` (paged, unscoped by branch), `/memberships`, `/sessions`, `/branches`, `/me/membership-summary`, `/coach/roster` | one scoped, versioned snapshot endpoint |
| Reusable check-in logic | `AttendanceController::store` (PHP, sqlite-testable apart from `GREATEST`), `validate_studio_access` (plpgsql, **not sqlite-testable**) | extraction into a service |
| Offline policy config | none (`gyms.app_layout/branding_config` jsonb exist) | `config/attendance_offline.php` |

## 9. Test infrastructure
- `phpunit.xml`: sqlite `:memory:`, `QUEUE_CONNECTION=sync`, `CACHE_STORE=array`. Runner: `vendor/bin/phpunit` (no Pest).
- The core schema has no migrations, so feature tests hand-build minimal tables in `setUp` with `Schema::create` and then `require` and `->up()` the real feature migration. Template: `tests/Feature/Sales/SalesTestCase.php` (gyms, branches, profiles, staff_members, staff_roles, staff_member_roles, staff_role_permissions, staff_activity_logs, membership_plans, gym_members, plus factories `makeGym/makeBranch/makeAdmin/makeSalesStaff`, `Sanctum::actingAs`). Same style in `Billing/SettlementWorkflowTest.php`, `ContractTerms/ContractTermsTest.php`, `Auth/RegistrationFlowTest.php`.
- Constraints for Phase 1 tests: new migrations must be **sqlite-portable** (Schema builder; guard pg-only SQL such as partial indexes, `GREATEST` and advisory locks with `DB::getDriverName()==='pgsql'`). plpgsql paths (P2, P3) **cannot run in sqlite**. The sync service must implement its rules in PHP, or those paths are covered by pgsql-only tests (none exist today). `AttendanceController::store` uses `GREATEST` (:280), so sqlite raises "no such function" for class decrements. The extracted service needs a portable expression (`CASE WHEN … THEN … END` or `max(0,…)` guarded by driver).
- `tests/Unit/AttendanceValidationTest.php` re-implements the plan matrix locally and does not exercise the controller.

---

## 10. Phase 1 backend proposal

### 10.1 Migrations (sqlite-portable; pg-only extras guarded by driver)
**A. `attendance_devices`**
`id uuid PK` (client-generated, persisted on device) · `gym_id uuid` · `user_id uuid` (→profiles) · `app varchar(16)` (`admin|coach|member`) · `platform varchar(16)` · `app_version varchar(32)` · `label` · `first_seen_at` · `last_seen_at` · `last_sync_at` · `revoked_at` nullable · timestamps. Index `(gym_id, user_id)`. Binding: a device id belongs to exactly one (user_id, gym_id). Any other user presenting it is rejected with `device_mismatch`.

**B. `attendance_events`** (server-side record of every synced event, accepted or not)
`event_id uuid PK` (client idempotency key) · `gym_id uuid NOT NULL` (server-derived) · `branch_id uuid NULL` · `gym_member_id uuid NULL` (NULL if unresolvable) · `class_session_id uuid NULL` · `studio_id uuid NULL` · `method varchar(16)` (`staff_qr|member_qr|manual`) · `actor_user_id uuid NOT NULL` · `actor_type varchar(16)` (`gym_admin|staff|trainer|member`) · `device_id uuid NULL` · `device_recorded_at timestamptz NOT NULL` · `device_timezone varchar(64)` · `server_received_at timestamptz NOT NULL` · `processed_at timestamptz NULL` · `result varchar(24)` (`accepted|duplicate_attendance|rejected|error`) · `reason_code varchar(64) NULL` · `reason_message text NULL` · `attendance_log_id uuid NULL` (FK attendance_logs **ON DELETE SET NULL**) · `payload_hash char(64)` (sha256 of canonical client payload) · `qr_meta jsonb NULL` (kid/v/iat, never the raw secret) · `metadata jsonb NULL` · `attempts int default 1` · timestamps.
Indexes: `(gym_id, server_received_at DESC)`, `(gym_id, result)`, `(gym_member_id, device_recorded_at)`, `(device_id)`, `(attendance_log_id)`.

**C. `attendance_logs` additive columns** (nullable, so online paths are untouched)
`source_event_id uuid NULL` + **UNIQUE** index (pg: partial `WHERE source_event_id IS NOT NULL`; sqlite: plain unique, which allows multiple NULLs). This is the DB-level guarantee that one event yields at most one official row. Optional `recorded_by uuid NULL` (actor). Official `check_in_at = device_recorded_at`, which keeps reports on original time. Receipt time lives in `attendance_events.server_received_at`.
- **Do not** add a unique `(gym_member_id, class_session_id)` index in Phase 1. Prod duplicates are unverified, and migrate-on-boot aborts the container on failure (see memory note on unique-index deploys). Use an advisory lock (below) and defer the index until prod has been de-duplicated (Phase 5).

### 10.2 `POST /api/attendance/sync`
Group: `auth:sanctum, RequireGymId, verified_member, LogActivityMiddleware` + `throttle:attendance-sync` (new named limiter, e.g. 30/min keyed by `user_id|device_id`). Permission is checked **per event**, not by route middleware, because members and staff share the endpoint.

Request:
```json
{ "device_id":"uuid", "app":"admin|coach|member", "app_version":"1.0.7",
  "events":[{ "event_id":"uuid", "gym_id":"uuid", "branch_id":"uuid|null",
    "member_id":"uuid", "class_session_id":"uuid|null", "studio_id":"uuid|null",
    "attendance_method":"staff_qr|member_qr|manual",
    "device_recorded_at":"2026-11-26T08:01:02.123+02:00", "device_timezone":"Africa/Cairo",
    "qr": { "raw":"<scanned payload>" } | null, "metadata":{} }] }
```
Envelope validation (422 for the whole request): device_id uuid, `events` array of 1 to `max_batch` (default 50), each `event_id` a distinct uuid. Field-level problems inside one event produce a per-event `rejected/invalid_payload`. They never fail the batch.

Response `200` (always, even if every event is rejected; 401/403/422/429 only for envelope or auth):
```json
{ "server_time":"…", "results":[{ "event_id":"…",
   "status":"accepted|duplicate|rejected|error",
   "code":"created|event_replayed|already_checked_in|member_not_found|…",
   "message":"…", "attendance_id":"uuid|null",
   "server_received_at":"…", "processed_at":"…", "retryable":false }] }
```
Client mapping: `accepted` and `duplicate` become **synced** (with `attendance_id`). `rejected` becomes **rejected** and stays visible. `error`/`retryable:true` stays **pending** with backoff.

Per-event algorithm. Each event gets its **own DB transaction**, so a failing event never rolls back others:
1. **Idempotency:** look up `attendance_events` by `event_id`.
   - Found, with the same `actor_user_id`, gym and `payload_hash`: return the **stored** result unchanged (`duplicate/event_replayed`, or the original rejection) and bump `attempts`.
   - Found, different actor/gym: `rejected/event_id_conflict` with no details (no cross-tenant leak).
   - Same actor but different hash: `rejected/event_id_reused`.
   - Insert races are handled by catching `UniqueConstraintViolationException` on the PK and re-reading.
2. **Device:** upsert `attendance_devices`. Reject `device_revoked` / `device_mismatch`.
3. **Authorization, all server-derived:**
   - `gym_id` = `user.gym_id`. A client `gym_id` mismatch gives `rejected/tenant_mismatch`.
   - Member must be in the gym and not deleted.
   - `branch_id`, `class_session_id` and `studio_id` must belong to the gym. This closes the P1 gap for the new path.
   - Method/actor matrix:
     - `manual`/`staff_qr`: role in admin-class **and** the `attendance` module, reusing the CheckPermission query extracted into a small `StaffPermission::has($user,'attendance')` service.
     - `member_qr`: role `member`, member forced to self (`scopedMemberId`), QR present. Branch resolved from `qr.raw`: v1 means `branches.qr_token` lookup, v2 means signature verify. Branch gym must equal the caller's gym, otherwise `rejected/qr_wrong_gym`.
     - A trainer doing manual or staff_qr needs the attendance module. See D5.
4. **Clock sanity:** `device_recorded_at > server_received_at + skew_tolerance` (default 5 min) gives `rejected/clock_in_future`. Older than `max_event_age` (default 7 d, config) gives `rejected/event_too_old` (kept for audit, needs manual correction). Events are always stored, never dropped.
5. **Serialize per member:** `pg_advisory_xact_lock(hashtext('att:'||gym_member_id))` (pgsql only). Safe with PgBouncer transaction mode.
6. **Delegate to the existing rules:** extract `AttendanceController::store` steps 1-4 (:151-306) into `App\Services\AttendanceCheckInService::checkIn(gymId, memberId, {classSessionId, branchId, studioId, method, accessPoint, checkInAt, recordedBy, sourceEventId})`. That returns `{ok, attendance_id}` or `{error_code, message, existing_attendance_id?}`. `store()` becomes a thin wrapper with identical HTTP responses (regression-safe). Sync calls the same service with `checkInAt = device_recorded_at`. Validity dates are evaluated as of the event date in gym tz; see D2.
   - The existing class duplicate rule maps to `duplicate/already_checked_in` with the **existing** `attendance_id`. Spec: "consistent result, no duplicate official record". The event row keeps `result=duplicate_attendance` for audit.
   - Gym entry has no dedupe beyond event_id (current behaviour) unless D1 decides otherwise.
   - `method` stored in `attendance_logs`: keep the existing vocabulary for report compatibility (`staff_qr`/`member_qr` become `qr`, `manual` stays `manual`), with the precise method on the event row. Alternatively store the new values (reports don't filter on method). See D6.
7. Write the `attendance_events` row (accepted or rejected) and `logActivity(…, 'attendance_events', event_id, details)`. Rejected events are persisted, which is the audit trail for conflicts.
8. An unexpected exception rolls back only this event, then records `result=error` in a separate small transaction and returns `retryable:true`. The next attempt re-processes (the stored `error` result is **not** replayed).

Studio/class member scans (P3 semantics: booking to attended, time window) are **out of Phase 1 scope** for sync. Phase 1 `member_qr` covers gym-entrance only. Class attendance via sync is `manual`/`staff_qr` with an explicit `class_session_id` (P1 semantics). Whether offline sync should also set the `session_bookings` row to `attended` (P1 doesn't today; P4 does) is D7.

### 10.3 Bootstrap / readiness
- `GET /api/attendance/offline/bootstrap?cursor=&limit=` (admin-class + `attendance` module):
  `{ server_time, generated_at, data_version, gym:{id,name,timezone}, policy:{…10.4}, branches:[authorized], members:[{gym_member_id, member_number, full_name, status, photo_url?, buckets:[{membership_id, plan_type, source_type, status, payment_status, start_date, end_date, sessions_remaining, sessions_total, freeze_status, allowed_branch_ids}], as_of}], class_sessions:[today-1 to today+N in authorized branches], recent_attendance:[last 48 h: {attendance_id, gym_member_id, class_session_id, branch_id, check_in_at}], qr_keys:[] (Phase 3), next_cursor }`. Members are cursor-paged (e.g. 500 per page). Branch authorization: whole gym today (no staff branch model exists, see D8). Coach scope: roster plus classes where `classes.trainer_id` = coach (D5).
- `GET /api/attendance/offline/me` (member): own gym_member, buckets, branches (for gym QR verification), and the member's own recent attendance.
- `GET /api/attendance/offline/status`: `{ server_time, policy, device:{registered, revoked}, counts:{members, class_sessions} }` for readiness UI and clock-skew estimation.
- Both responses are labelled `as_of` so clients never present cached validity as live.

### 10.4 Config (`config/attendance_offline.php`, env-driven, global; per-gym later if needed)
`enabled` (default false) · `max_batch` 50 · `max_data_age_hours` 24 · `max_event_age_days` 7 · `future_skew_seconds` 300 · `allow_manual_offline` true · `allow_staff_qr_offline` true · `allow_member_qr_offline` false (until Phase 3 signed QR) · `expired_cache_policy` `warn|block`.

### 10.5 Phase 1 tests (sqlite, `SalesTestCase` style)
New `tests/Feature/Attendance/AttendanceSyncTestCase` builds gyms, branches, profiles, staff tables, gym_members, membership_plans, member_memberships, classes, class_sessions, attendance_logs, staff_activity_logs, then runs the real new migrations. Cases:
- accepted creates exactly one log
- replaying the same event_id gives the same attendance_id and no new row
- same id with a different payload gives `event_id_reused`
- same id from another gym gives `event_id_conflict`
- partial batch (valid, invalid, valid) produces 2 rows
- cross-tenant member, branch or class gives rejected
- member forging another member_id is forced to self or rejected
- no-permission staff gives rejected
- class duplicate gives `already_checked_in` with the existing id
- future timestamp and too-old event are rejected
- batch above max gives 422
- `store()` regression (same responses as before the refactor)
- check_in_at equals device_recorded_at.

---

## 11. Risks and open decisions (need product input)
- **D1 Gym-entry dedupe:** no rule exists today. Choose between (a) event_id only (multiple entries per day stay valid; two offline devices produce two rows) and (b) a product-chosen window per member per branch. The spec forbids inventing one silently.
- **D2 As-of validation:** should membership validity and remaining sessions be judged at `device_recorded_at` (fair to offline members) or at sync time (current online semantics)? Sessions are decremented at sync either way. What happens if the bucket is spent by then: reject, or accept with `sessions_remaining` at 0 and flag?
- **D3 Gym QR replay:** a static printed v2 QR can be photographed and replayed (true today too). Is the server-side rule plus the v2 signature enough, or do we need a rotating kiosk QR? This also determines `allow_member_qr_offline`.
- **D4 Member QR format:** none exists. Choose between a signed short-exp credential (screenshot risk until exp) and a device-bound signature.
- **D5 Coach capabilities:** the coach app has no gym/class attendance today. Should coaches mark class attendance, and is the scope `classes.trainer_id` (only reliable link) or `trainer_branches`?
- **D6 `attendance_logs.method` values** for synced rows: keep `qr/manual` or introduce `staff_qr/member_qr`.
- **D7 Bookings:** should offline class check-in also set `session_bookings` to attended and respect `walk_in_allowed`/capacity (P3 semantics) or follow P1 semantics (it ignores bookings)? The online paths are already inconsistent.
- **D8 Staff branch scoping:** none exists for attendance. "Never expose another branch's data" needs either a new rule (reuse `staff_members.branch_id`) or an explicit whole-gym scope for staff.
- **D9 Logout with pending events:** the server side accepts events only from the same `actor_user_id`. Can a different user on the same device sync them? Recommendation: no.

**Pre-existing defects found (recommend fixing in Phase 1 or separately; each changes online behaviour, so it needs sign-off):**
1. `log_gym_attendance_by_token` makes cross-tenant inserts and skips membership, payment and branch checks (P2).
2. `SessionController::checkin` does no gym scoping (P5).
3. `AttendanceController::store` doesn't validate gym ownership of branch, studio or class_session, and doesn't check `payment_status`.
4. `validate_branch_access` has a uuid vs text[] runtime error.
5. Mobile token-less gym QR and `markSessionAttended` call admin-only routes.
6. Sessions are decremented inconsistently: P4 touches only `sessions_used`.
7. `GET /members` has no permission gate and no page-size cap.
8. `branches.qr_token` has no unique index.
9. `QrTokenController::verify` has no gym check.

**Unconfirmed:** prod duplicate counts for (member, class_session); the `get_gym_dashboard_stats` body; the actual Postgres session tz on prod; mobile 403 behaviour (inferred from routes, not executed).
