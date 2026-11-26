# Offline Attendance — backend notes (clby-api)

## Phase 2

Implements `PHASE2-CONTRACT.md` (server side: member pass, pass verification on sync, review endpoint).

### Contract deviations / clarifications (Phase 2)

1. **`GET /api/me/member-pass` is not limited to role `member`.** Any user with a `gym_members` row in their gym gets their own pass, so a staff member who also trains can use one. Users without a row get 404 `{code: member_not_found}`.
   - The route sits in the members group, so members need a verified email (`verified_member`).
2. **One cached pass per member, shared by both pass endpoints.** `/me/member-pass` and `/members/{id}/member-pass` return the same cached pass for 60 min (`ATTENDANCE_MEMBER_PASS_CACHE_MINUTES`, minimum 60).
   - The cache key includes the `kid`, so rotating the key issues a new pass at once.
3. **Server verification details:**
   - **Unknown kid:** server-side it is `qr_invalid`, as the contract says.
   - **Foreign signing key:** a key that belongs to a gym other than the pass's `g` → `qr_invalid`. Without this, one gym's key could sign passes claiming another gym.
   - **Expiry and retired-key grace** are judged at the scan time (`device_recorded_at` for sync), per the coordinator's D2 note. A pass that was valid when scanned is accepted even if it has expired since.
   - **`iat`:** must be ≤ server now + `future_skew_seconds`, and `iat` > `exp` → `qr_invalid`.
4. **`staff_qr` is now strict.** It requires `qr.raw` to be a valid pass naming `member_id`. A missing or non-pass `qr` → `qr_invalid` (in Phase 1, `staff_qr` without a QR was accepted). Results are `qr_invalid`, `qr_wrong_gym`, `pass_expired`, `member_not_found` or `qr_member_mismatch`.
   - The check runs after the permission check and the offline gate.
   - For a rejected pass, `attendance_events.gym_member_id` stays null, because the server stores only verified ids. The claimed id is in `metadata.claimed`.
   - `qr_meta` stores `{format:"clby_mp", v, kid, iat, exp, m}`, never the signature.
5. **Coach `service_session` with `metadata.source == "qr"` and a `qr.raw`:** verified the same way. The pass `m` must equal the **assignment's** member, otherwise `qr_member_mismatch` (an event `member_id` must already match the assignment).
   - `source:"qr"` without `qr.raw`, or manual sessions, are unchanged.
6. **`pass_keys`:**
   - Shape: `[{kid, public_key (base64url of 32 bytes), status, valid_until}]`.
   - The active key comes first; retired keys are listed only while `valid_until` (`retired_at + member_pass_ttl_days`) is in the future.
   - Sent on the admin and coach bootstrap first page (the key sits just before `next_cursor`) and in `/offline/me`.
   - The first request that needs a key creates it.
7. **Key rotation** exists only as `MemberPassService::rotate($gymId)`. There is no HTTP endpoint or artisan command yet; that is an open item if staff need to rotate.
8. **`GET /api/attendance/offline/events`** (admin group, `permission:attendance,view`, gym-scoped, read-only):
   - **Query params:**
     - `result` accepts `accepted|rejected|duplicate|error`;
     - `needs_review=1|true`;
     - `limit` 1–200, default 50;
     - `cursor` is opaque (base64url of `received|event_id`); an invalid one gets 422.
   - **Ordering:** newest first, `server_received_at DESC, event_id DESC`, keyset-paged.
   - **Row shape:**
     - `{event_id, kind, method, result, code, message, flags, needs_review, attendance_id, service_log_id, attempts, device_recorded_at, device_timezone, server_received_at, processed_at}`
     - `member: {gym_member_id, member_number, full_name} | null`
     - `actor: {user_id, type, full_name}`
     - `device: {device_id, label, platform, app, app_version}`
     - `branch_id`, `class_session_id`, `studio_id`, `service_assignment_id`
   - **Device label:** `attendance_devices.label` if set, otherwise `"<app> <platform> <app_version>"`.
   - **Response:** `{data, next_cursor}`.
   - Conflict-audit rows (`attendance_event_conflicts`) are not listed here.

### Files

- `app/Services/MemberPassService.php`
- `app/Http/Controllers/MemberPassController.php`
- `AttendanceOfflineController::events` and `pass_keys` in bootstrap and me
- `AttendanceSyncService` (`checkPass`, new codes)
- `config/attendance_offline.php` (`member_pass_ttl_days`, `member_pass_cache_minutes`)
- `routes/api.php`
- Migration `2026_11_27_100000_create_gym_signing_keys_table.php`:
  - columns: `kid` PK, `gym_id`, `purpose`, `public_key`, `secret_key_enc` (Crypt), `status`, `created_at`, `retired_at`;
  - a partial unique index allowing one active key per (gym, purpose).
- Tests: `MemberPassTest`, `StaffQrSyncTest`.

---

# Phase 1

Implements `CONTRACT.md` including the §6 amendments (2026-11-26, post-verification). Everything below is either a contract deviation (kept minimal) or a detail the contract left open that client agents need.

## Contract deviations

1. **Replay of a stored non-accepted result.** Only a stored `accepted` replays as `duplicate/event_replayed`. A stored `duplicate/already_checked_in` or `rejected/<code>` is returned **unchanged** (same status, code, ids, timestamps). Clients map both the same way (`duplicate` → synced, `rejected` → rejected), so nothing changes for them.
2. **`event_id_conflict` / `event_id_reused` are audited in a separate table, not in `attendance_events`** (§6.3). The `event_id` primary key already belongs to the original event, which is never modified. Each attempt is a row in `attendance_event_conflicts`: contested `event_id`, `reason_code`, and the **attempting** actor, gym, device, app/version, payload hash, `server_received_at`, IP.
3. **`not_self` is never emitted.** `member_qr` forces the member to self, as the contract table says. Any client `member_id` is ignored, so there is nothing to reject as `not_self`.
   - *(Former deviation 3b removed.)* `offline_disabled` **is** emitted now: see "Offline gate" below.
4. **Policy object has one extra key**, `online_grace_seconds` (default 120), so clients can apply the same §6.2 rule locally.
5. **Coach sync: another coach's assignment returns `assignment_not_found`** with the same message as a missing one ("Assignment not found."), so sync is no existence oracle. The online `POST /coach/sessions/decrement` still returns its original 403 `forbidden` (responses there are kept byte-identical).
6. **Extra columns** (additive):
   - `attendance_logs.review_flag`
   - `service_session_logs.review_flag`
   - `attendance_events.needs_review` and `attendance_events.retryable`
   - `attendance_events.metadata`, stored as `{ "client": <client metadata>, "claimed": { gym_id, branch_id, member_id, class_session_id, studio_id, service_assignment_id } }`. The id columns hold only server-verified ids; the claimed ids are kept for auditing rejections.

## D2: how flagged visits are represented

- **Class check-in (kind=attendance)**
  - Trigger: the member has a class-capable bucket that is not frozen and in its date window, but no sessions remain at sync time.
  - Result: `accepted` with `flags: ["sessions_exhausted"]`.
  - Official row: one `attendance_logs` row is written with `review_flag='sessions_exhausted'`.
  - Counters: **no decrement**. `sessions_used` is unchanged and `sessions_remaining` stays at its current value (≥ 0).
  - Event row: `attendance_events.needs_review=true`, `flags=["sessions_exhausted"]`.
- **Coach PT/physio session (kind=service_session)**
  - Trigger: the pack is used up (`sessions_used >= sessions_total`, usually already `status='completed'`).
  - Result: `accepted` with `flags: ["pack_exhausted"]`.
  - Official row: one `service_session_logs` row is written with `review_flag='pack_exhausted'`.
  - Counters: `sessions_used` is **not incremented**, so it never exceeds `sessions_total`, and the status is untouched.
  - Event row: `attendance_events.needs_review=true`.
- **Staff review query:**
  - `attendance_events WHERE gym_id=? AND needs_review` (indexed), or
  - `attendance_logs WHERE review_flag IS NOT NULL` (partial index on pg).
- The server cannot reconstruct whether a pack was already empty at visit time. Every visit that is exhausted at sync time is accepted and flagged for review, never silently rejected.

## "As of device_recorded_at" (D2): exactly what is evaluated at device time

- **Bucket date window.** `end_date >= visit date` is checked on the **visit's date in the gym's timezone** (`gyms.timezone`). Online `store()` still uses today's UTC date.
- **Coach pack.** `expires_at` is checked against `device_recorded_at`.
- **30-min PT guard.** The guard is **symmetric**: any delivery on the same assignment within ±30 min of `device_recorded_at` gives `guard_window`. A symmetric window is needed because an offline session may sync after a later online one.
- **Current values only.** `status`, `freeze_status`, `payment_status` and plan type use current values, because no history exists. For example, a membership *replaced* (old row set to `status='expired'`) between the visit and the sync is rejected `no_active_subscription`.
- **Gym-entry rules (`member_qr`).** Exact parity with online `logByQr` (`gymEntryDenialForBranch`); no date checks in either path. What the code does:
  1. Member must belong to the branch's gym, else `not_a_member`.
  2. If the member has an active, **paid** `subscription` bucket:
     - frozen → `membership_frozen`;
     - plan type not one of `monthly|annual|duration|duration_session` → `gym_access_not_included`;
     - `allowed_branch_ids` set and missing this branch → `branch_not_included`;
     - otherwise allowed.
  3. If there is no active paid subscription:
     - an active `transfer` bucket exists → `gym_access_not_included` (transferred sessions are studio-only);
     - **otherwise allowed**, including a member with no membership at all, or only an unpaid / non-active subscription. This mirrors online `logByQr` and the member app's rules; tightening it is a separate, online-affecting decision.

## Result codes actually emitted

| status | codes |
|---|---|
| accepted | `created` |
| duplicate | `event_replayed`, `already_checked_in` (with the existing `attendance_id`) |
| rejected | `invalid_payload`, `offline_disabled`, `tenant_mismatch`, `member_not_found`, `branch_not_found`, `class_session_not_found`, `studio_not_found`, `assignment_not_found`, `assignment_not_active`, `permission_denied`, `qr_invalid`, `qr_wrong_gym`, `branch_inactive`, `not_a_member`*, `membership_frozen`, `gym_access_not_included`, `branch_not_included`, `pack_expired`, `guard_window`, `clock_in_future`, `event_too_old`, `event_id_conflict`, `event_id_reused`, plus the store() codes below |
| error | `server_error` (`retryable: true`) |

\* Reached only if the member's gym differs from the branch's gym. That case is already caught as `qr_wrong_gym`.

`AttendanceController::store` errors mapped 1:1, shown as `code` → HTTP message:

| code | online `store()` message |
|---|---|
| `member_not_found` | Member not found (404) |
| `no_active_subscription` | Member does not have an active subscription |
| `class_access_not_included` | This plan does not allow class access… |
| `gym_access_not_included` | This plan does not allow gym access… |
| `membership_frozen` | Membership is frozen |
| `already_checked_in` | Already checked in for this session (sync returns `duplicate`) |
| `no_remaining_sessions` | No remaining sessions (online only; sync accepts and flags `sessions_exhausted`) |

`CoachController::decrement` errors mapped:

| online code | sync code |
|---|---|
| `not_found` | `assignment_not_found` |
| `forbidden` | `assignment_not_found` (same message as not found) |
| `not_active` | `assignment_not_active` |
| `expired` | `pack_expired` |
| `recently_logged` | `guard_window` |
| `exhausted` | accepted and flagged `pack_exhausted` |

## Field rules per event

- **Required for every event:** `event_id` (envelope), `kind`, `gym_id`, `device_recorded_at` (ISO-8601 with offset or `Z`, ≤ 6 fractional digits).
- **Optional:** `device_timezone` (≤ 64), `note` (≤ 500), `metadata` (object, ≤ 4 KB JSON).
- **Per kind / method:**
  - **`attendance` + `manual` / `staff_qr`:** `member_id` required. `branch_id`, `class_session_id` and `studio_id` must belong to the caller's gym, or the event is rejected with `*_not_found`.
    - `attendance_logs.method` is `manual` or `qr` (D6).
    - `access_point` is the class name for class entries, otherwise the branch name, otherwise `Gym Access`.
  - **`attendance` + `member_qr`:** `qr.raw` required. Accepted forms:
    - the v1 poster JSON `{"type":"gym_access","gym_id","branch_id","token"}`;
    - a bare token uuid.
    - Token-less legacy payloads (`gym:<id>`, JSON without `token`) are rejected `qr_invalid`.
    - The row is written in PHP (method `qr`, `access_point` = branch name), not through `log_gym_attendance_by_token`.
    - `qr_meta` stores `{format, v, branch_id}`, never the token.
  - **`service_session`:** `service_assignment_id` required. `member_id` is optional; if sent, it must match the assignment, or the event is rejected `invalid_payload`.
- **Clock rules** (checked after the payload is validated and the tenant matches):
  - More than `future_skew_seconds` ahead of server receipt → `clock_in_future`.
  - Older than `max_event_age_days` → `event_too_old`.
  - Both are stored.
- **Impossible dates** that pass the format regex (e.g. `2026-02-30`, hour 25, offset beyond ±14:00) → `invalid_payload`. They are no longer rolled over by Carbon.

## Offline gate (CONTRACT §6.2)

- An event is **offline** when `device_recorded_at < server_received_at − online_grace_seconds` (default 120, env `ATTENDANCE_OFFLINE_ONLINE_GRACE_SECONDS`).
- An offline event is rejected `offline_disabled` (stored, like every rejection) when `enabled` is false, or when the flag for its kind/method is false:

  | kind / method | flag |
  |---|---|
  | `attendance` / `manual` | `allow_manual_offline` |
  | `attendance` / `staff_qr` | `allow_staff_qr_offline` |
  | `attendance` / `member_qr` | `allow_member_qr_offline` (default **false**) |
  | `service_session` | `allow_service_session_offline` |

- Events within the grace are always processed (online-equivalent), whatever the policy.
- The gate runs after payload validation, the tenant check and the clock rules, and before permission checks.
- Already-processed events are never re-evaluated: a resend replays the stored result, even if the policy changed since.
- Consequence of the shipped defaults (`enabled=false`): on deploy, only near-real-time events are accepted. Backdated `member_qr` self check-ins (verification HIGH-3) are refused until both `enabled` and `allow_member_qr_offline` are turned on.

## Envelope / HTTP

- **422** (standard Laravel validation body) in these cases:
  - `device_id` missing or not a uuid;
  - `app` not one of `admin|coach|member`;
  - `events` missing, empty, or more than `max_batch`;
  - an event that is not an object or has no valid `event_id`;
  - duplicate `event_id`s in one batch (case-insensitive).
- **Device binding is per (device_id, user_id)** (§6.1). A shared browser or phone works for every account; each pair is registered on its first sync and revoked independently.
  - Table: `attendance_devices.device_id` (client id) + `user_id`, unique together. `id` is now a server surrogate; pre-existing rows were backfilled with `device_id = id`.
  - `X-App-Platform` is stored as `platform`.
- **403** `{ "error": "...", "code": "device_mismatch" }` only when the **same user** presents the device for a **different gym** than the pair was registered with (account moved gyms).
- **403** `{ "error": "...", "code": "device_revoked" }` when that user's pair is revoked (`revoked_at` set). Other users on the same device are unaffected.
- **429** from the `attendance-sync` limiter: `ATTENDANCE_OFFLINE_SYNC_RATE_PER_MINUTE` (default 30) **per user**. Rotating device ids gives no extra quota. The global 300/min API limiter also applies.
- **Timestamps** in responses: UTC with milliseconds, `2026-11-26T16:21:04.536Z`.
- **Routes** sit in the members+staff group (`auth:sanctum, RequireGymId, verified_member, LogActivityMiddleware`). Members, staff and coaches all reach them; permission is checked per event or per role inside the controller.

## Readiness endpoints

- **`GET /attendance/offline/status?device_id=`**
  - Accepts the device id from the query or the `X-Device-Id` header.
  - `device.registered` / `device.revoked` describe the caller's own (device, user) pair in the current gym.
- **`GET /attendance/offline/bootstrap?cursor=&limit=`** (limit 1–1000, default 500)
  - **Variant selection:**
    - `?app=coach`, `X-App: coach`, or a trainer with an active `trainer_profiles` row and no `app` → **coach** variant. A caller without an active profile gets 403.
    - Otherwise → **admin** variant, which requires the `attendance` module (gym_admin bypasses). Without it: 403 `permission_denied`.
    - Members always get 403.
  - **Paging:** admin pages by `gym_members.id`; coach pages by `member_service_assignments.id`. `next_cursor` is null on the last page.
  - **Non-paged sections are sent on the first page only** (request without `cursor`): `branches`, `class_sessions`, `recent_attendance` (admin) or `recent_service_logs` (coach). Later pages contain only `server_time, as_of, gym, policy, members|assignments, next_cursor`; the keys are **absent** (not empty arrays), so clients must keep the first page's values.
  - **Buckets** = `member_memberships` with `status='active'`, subscriptions first. `allowed_branch_ids` is null when unrestricted.
  - **Date-only fields** (§6.4): bucket `start_date` / `end_date` are `YYYY-MM-DD` in the gym's timezone (same in `/me`). Timestamps (`check_in_at`, `starts_at`, `logged_at`, `last_session_at`) stay ISO-8601 UTC. Assignment `expires_at` is a real timestamp column (`timestamptz`) and stays ISO-8601.
  - **`class_sessions`:** status ≠ cancelled, from the gym-local date yesterday through today + 7. `starts_at`/`ends_at` are computed in the gym timezone.
- **`GET /attendance/offline/me`:** members only. Admin-class roles get 403; a member with no `gym_members` row in the gym gets 404 `member_not_found`.

## Concurrency

Each event runs in its own transaction. On Postgres it takes two locks in this order, then checks idempotency inside the transaction:
1. `pg_advisory_xact_lock(hashtextextended('attendance-event:'||event_id, 0))`
2. a lock on `'attendance-member:'||member_id`

Two more guarantees:
- **DB backstop:** unique `source_event_id` on both official tables (partial on pg).
- **Coach sessions:** these also keep the existing `lockForUpdate` on the assignment row.

**Online paths** (`store()`, `logByQr`, studio QR) do not take the member advisory lock. An online check-in can still race a sync for the same class, which is a pre-existing race.

## Code map

- `config/attendance_offline.php`: the policy, env-driven, plus `sync_rate_per_minute`.
- `app/Services/AttendanceCheckInService.php`: `store()` rules, `gymEntryDenial*`, `recordGymEntry`.
- `app/Services/ServiceSessionService.php`: the coach decrement transaction, online and sync modes.
- `app/Services/AttendanceSyncService.php`: per-event pipeline.
- `app/Services/StaffPermission.php`: module check shared with `CheckPermission`.
- `app/Http/Controllers/AttendanceOfflineController.php`: sync, status, bootstrap, me.
- Migrations `2026_11_26_2000xx_*`, six files (`200400`: devices per user; `200500`: `attendance_event_conflicts`). Each is idempotent and guarded with `hasTable`/`hasColumn`; pg-only SQL is behind `DB::getDriverName()`.
- Tests: `tests/Feature/Attendance/*`, sqlite.

## Covered only by the manual Postgres run

- The advisory locks.
- The partial unique indexes.
- Real concurrency: 8 parallel identical requests → 1 row; 8 parallel distinct events for the same member and class → 1 row + 7 `already_checked_in`.
- `log_gym_attendance_by_token` (online `logByQr` allowed path), which is unchanged.
- §6 re-check (2026-11-26):
  - admin and member syncing on one device_id both 200; revoking one pair → that user 403 `device_revoked`, the other still 200;
  - `member_qr` backdated 1 h with `enabled=true`, `allow_member_qr_offline=false` → `offline_disabled`, and 100 s old → accepted;
  - `event_id_reused` → audit row, original event untouched;
  - 32 requests with rotating device ids → 30×200 + 2×429.
