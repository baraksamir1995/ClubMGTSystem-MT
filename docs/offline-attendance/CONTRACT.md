# Offline Attendance — Phase 1 contract (source of truth for all agents)

Decided by the product owner 2026-11-26:
- **D1 = A** Gym entry: no new duplicate window. Only an identical `event_id` is a duplicate. Classes keep the existing one-per-(member, class_session) rule.
- **D2 = A** Validity is judged **as of `device_recorded_at`** (gym timezone date). If sessions/pack ran out between the visit and the sync, the event is still **accepted** and returned with a `flags` entry (`sessions_exhausted` / `pack_exhausted`) and the server row is marked for staff review. Counters never go negative.
- **D5 = A** Coaches record **PT/physio service sessions** offline (`kind: service_session`), the same thing `POST /coach/sessions/decrement` does today. Coaches do not record gym/class attendance in this feature.
- Defaults (PHASE1-PLAN §4): D3 signed QR = Phase 3; D4 member pass = Phase 2/3; D6 `attendance_logs.method` keeps existing values (`qr`/`manual`), precise method lives on the event row; D7 offline class check-in follows today's manual path (no booking changes); D8 staff scope = whole gym; D9 pending events sync only with the same user's token.

## 1. Event (client → server)

```jsonc
{
  "event_id": "uuid v4",                  // idempotency key, generated on device, never reused
  "kind": "attendance" | "service_session",
  "attendance_method": "staff_qr" | "member_qr" | "manual",   // kind=attendance only
  "gym_id": "uuid",                       // client's belief; server derives & compares
  "branch_id": "uuid|null",
  "member_id": "uuid",                    // gym_members.id
  "class_session_id": "uuid|null",        // kind=attendance, optional
  "studio_id": "uuid|null",               // kind=attendance, optional
  "service_assignment_id": "uuid|null",   // kind=service_session, required
  "device_recorded_at": "2026-11-26T08:01:02.123+02:00",      // ISO-8601 WITH offset
  "device_timezone": "Africa/Cairo",
  "qr": { "raw": "<scanned text>" } | null,                   // member_qr (v1 branch token in Phase 1)
  "note": "string|null",                  // service_session optional note (≤500)
  "metadata": {}                          // free-form, ≤4 KB, stored, never trusted
}
```

Who may send what (enforced server-side per event; client values are never trusted):

| kind / method | actor | rule |
|---|---|---|
| attendance / manual, staff_qr | gym_admin, staff, trainer **with `attendance` module** (same check as `permission:attendance,create`) | member, branch, class_session, studio must belong to the actor's gym |
| attendance / member_qr | member | member forced to self; branch from `qr.raw` (v1 `token` → `branches.qr_token`); branch gym = member gym; same gym-entry rules as `AttendanceController::logByQr` (`gymEntryDenial`) evaluated as of `device_recorded_at` |
| service_session | trainer passing the `coach` middleware rules (role trainer + active trainer_profile) | assignment must belong to that trainer and the actor's gym; same rules as `CoachController::decrement`, but the 30-min guard and expiry use `device_recorded_at` |

## 2. `POST /api/attendance/sync`

Auth: Sanctum bearer. Group: `auth:sanctum`, `RequireGymId`, `LogActivityMiddleware`, named limiter `attendance-sync` (30/min per user+device). `verified_member` applies (it bypasses admin-class roles). Permission checked **per event**.

Request:
```json
{ "device_id": "uuid", "app": "admin|coach|member", "app_version": "1.0.7",
  "events": [ /* 1..50 events, distinct event_id */ ] }
```
Envelope errors (whole request): 401, 403 (device revoked / bound to another user), 422 (bad envelope, >50 events, duplicate ids in batch), 429. A malformed single event never fails the batch — it gets a per-event `rejected/invalid_payload`.

Response **200** always when the envelope is valid:
```json
{ "server_time": "ISO",
  "results": [ {
    "event_id": "uuid",
    "status": "accepted" | "duplicate" | "rejected" | "error",
    "code": "created | event_replayed | already_checked_in | …",
    "message": "human readable",
    "attendance_id": "uuid|null",        // kind=attendance
    "service_log_id": "uuid|null",       // kind=service_session
    "flags": ["sessions_exhausted"],     // D2 review flags, may be empty
    "server_received_at": "ISO",
    "processed_at": "ISO|null",
    "retryable": false
  } ] }
```

Result codes:
- accepted: `created`
- duplicate: `event_replayed` (same event_id resent → original result & ids), `already_checked_in` (class rule; returns the EXISTING `attendance_id`)
- rejected: `invalid_payload`, `tenant_mismatch`, `member_not_found`, `branch_not_found`, `class_session_not_found`, `studio_not_found`, `assignment_not_found`, `assignment_not_active`, `permission_denied`, `not_self`, `qr_invalid`, `qr_wrong_gym`, `branch_inactive`, gym-entry reasons (`not_a_member`, `membership_frozen`, `gym_access_not_included`, `branch_not_included`), existing AttendanceController::store error codes (mapped 1:1, listed in the backend implementation), `pack_expired`, `guard_window` (30-min PT guard), `clock_in_future`, `event_too_old`, `event_id_conflict` (id used by another actor/gym — no details), `event_id_reused` (same actor, different payload), `offline_disabled`
- error: `server_error` with `retryable: true` (stays pending on the client)

Idempotency: the server stores every processed event (accepted or rejected) keyed by `event_id` with a sha256 `payload_hash`. A resend with the same actor + hash returns the stored result unchanged (status `duplicate`, code `event_replayed`, same ids) — **except** a stored `error`, which is re-processed. Each event runs in its own DB transaction; per-member advisory lock on Postgres.

Clock rules: `device_recorded_at` > server now + 300 s → `clock_in_future`. Older than `max_event_age_days` (7) → `event_too_old` (stored for audit). Official `attendance_logs.check_in_at` / `service_session_logs` time = `device_recorded_at`.

## 3. Readiness endpoints

- `GET /api/attendance/offline/status` (any authenticated role in the groups above) → `{ server_time, enabled, policy, device: { registered, revoked } }`. Query `?device_id=`.
- `GET /api/attendance/offline/bootstrap?cursor=&limit=` → role-scoped snapshot, cursor-paged on members (default 500):
  - admin-class with `attendance` module: `{ server_time, as_of, gym:{id,name,timezone}, policy, branches:[{id,name,is_active}], members:[{gym_member_id, member_number, full_name, phone_last4, photo_url, status, buckets:[{membership_id, plan_type, source_type, status, payment_status, start_date, end_date, sessions_remaining, sessions_total, freeze_status, allowed_branch_ids}]}], class_sessions:[{id, class_id, name, branch_id, studio_id, starts_at, ends_at}] (yesterday → +7 days), recent_attendance:[{attendance_id, gym_member_id, class_session_id, branch_id, check_in_at}] (last 48 h), next_cursor }`
  - trainer (coach): `{ server_time, as_of, gym, policy, assignments:[{assignment_id, gym_member_id, member_name, member_number, photo_url, service_type, package_name, sessions_total, sessions_used, status, expires_at, last_session_at}], recent_service_logs:[{service_log_id, assignment_id, logged_at}] (48 h), next_cursor }`
  - member: 403 (use `/me`).
- `GET /api/attendance/offline/me` (member) → `{ server_time, as_of, gym, policy, member:{gym_member_id, member_number, full_name}, buckets:[…same shape…], branches:[{id,name,is_active}], recent_attendance:[…own, 48 h…] }`

Every snapshot carries `as_of`; clients must label cached validity "as of <time>", never as live.

## 4. Policy object (from `config/attendance_offline.php`, global)

```json
{ "enabled": false, "max_batch": 50, "max_data_age_hours": 24, "max_event_age_days": 7,
  "future_skew_seconds": 300, "allow_manual_offline": true, "allow_staff_qr_offline": true,
  "allow_member_qr_offline": false, "allow_service_session_offline": true,
  "expired_cache_policy": "warn", "retry_base_seconds": 5, "retry_max_seconds": 900 }
```
When `enabled` is false the sync endpoint still processes events already recorded (never strand data) but clients must not create new offline events.

## 5. Client-side model (Flutter package + dashboard share these names)

Outbox row = event fields above + `actor_user_id`, `actor_type`, `device_id`, `sync_status` (`pending|syncing|synced|rejected`), `sync_attempts`, `next_attempt_at`, `last_sync_error`, `result_code`, `result_message`, `official_id` (attendance_id or service_log_id), `flags`, `server_received_at`, `created_at`.

Result mapping: `accepted`/`duplicate` → `synced` (store ids + flags); `rejected` → `rejected` (kept, visible, never auto-deleted); `error`/network/timeout/5xx → stays `pending` with exponential backoff + jitter (`retry_base_seconds`… `retry_max_seconds`); 401 → pause engine (`auth_required`), keep events; 403 device revoked → pause (`device_revoked`), keep events; 429 → back off. On startup, rows stuck in `syncing` return to `pending`. Order by `device_recorded_at`, then `created_at`. Single-flight per database.

Storage scope: one local store per (api base, gym_id, user_id). Logout: cached operational data wiped; pending/rejected events kept in that user's store and only synced with that user's token (D9).

Headers every client sends on API calls: `X-Device-Id`, `X-App` (`admin|coach|member`), `X-App-Version`, `X-App-Build`, `X-App-Platform`.
