# Offline Attendance — Audit summary + Phase 1 plan

Sources: `audit-backend.md`, `audit-dashboard.md`, `audit-coach-app.md`, `audit-member-app.md` (2026-11-26).
Branch `feat/offline-attendance` (worktree `ClubMGTSystem-MT-offline`), based on `main`.

## 1. Audit summary

**Official record.** `attendance_logs` (legacy Supabase, no migration, no unique constraints, hard-deleted in 4 places) is the only official attendance table. Five write paths exist: `POST /attendance` (`AttendanceController::store`, admin + `attendance` permission, already accepts `check_in_at`), `POST /attendance/qr` (SQL fn `log_gym_attendance_by_token`), `POST /access/studio` (`validate_studio_access`), booking status update, and `/sessions/{id}/checkin` (booking only). No push/notification/job on check-in.

**Duplicate rules.** Only one exists: one record per (member, class_session), check-then-insert in `AttendanceController.php:229-237` and in `validate_studio_access`. Gym-floor entry has none. The "2-min cooldown" referenced in mobile comments does not exist server-side. PT sessions have a 30-min guard (server clock).

**QR.** Branch QR = static unsigned JSON `{type:'gym_access', gym_id, branch_id, token}` with `branches.qr_token` UUID — not verifiable offline. No member QR exists in any client (removed May 2026); `QrTokenController` issues 60 s HMAC tokens nobody uses. Deployed apps read only `type/gym_id/branch_id/token` and ignore extra keys → a signed v2 payload can be a strict JSON superset.

**Clients.**
- Dashboard: everything server-rendered (`force-dynamic`, server route guard), token in httpOnly cookie, browser only calls same-origin `/api/*` proxies; manual-log modal already searches members client-side; no scanner, camera blocked by `Permissions-Policy: camera=()`; no PWA/IndexedDB.
- Coach app: 5 real screens but its "attendance" is PT/physio session-pack usage (`service_session_logs`), not check-ins; no scanner; no local storage; can't cold-start offline; any 401 wipes the session.
- Member app: gym-QR scanner exists (`qr_scanner_screen.dart`), membership gating done client-side; no member QR; no local storage/connectivity; offline cold start shows "Wrong gym".

**Branch / coach scoping.** No staff branch scoping for attendance (sales only). Coaches scoped by gym + trainer ownership; `class_sessions` has no trainer link (`classes.trainer_id` is the only one).

**Infra.** Sanctum tokens never expire, no device table, global 300/min limiter, PgBouncer transaction mode (→ transaction-scoped advisory locks), audit via `staff_activity_logs`. Backend tests = sqlite in-memory with hand-built tables (`tests/Feature/Sales/SalesTestCase.php`); SQL functions can't run there.

**Pre-existing defects** (each changes online behaviour → separate sign-off):
1. **P0 cross-tenant check-in** — `log_gym_attendance_by_token` inserts with the *branch's* gym, never checks it equals the member's gym, and skips membership/payment/branch/duplicate checks (all enforced only in the app).
2. `SessionController::checkin` has no gym scoping of session or member.
3. `AttendanceController::store` doesn't verify branch/studio/class_session belong to the caller's gym; no payment_status check.
4. `validate_branch_access` uuid-vs-text runtime error (unused).
5. Member app's token-less gym QR + `markSessionAttended` hit admin-only routes (403, inferred).
6. Inconsistent session deduction (booking path only bumps `sessions_used`).
7. `GET /members` no permission gate / no page cap.
8. `branches.qr_token` not unique.
9. `QrTokenController::verify` no gym check.
10. Dashboard login proxy returns the token in its response body.

## 2. Architecture (all phases)

One event model, one server endpoint, one shared Flutter package, one dashboard module:

```
 member app ─┐   packages/clby_offline (Dart, Drift+SQLCipher-mc)   ┐
 coach app  ─┘   outbox · cache · sync engine · QR verify            │  POST /api/attendance/sync
 dashboard  ───  gym-admin/lib/offline (TS, IndexedDB via idb)       ├─ → AttendanceCheckInService (extracted
                 outbox · cache · sync engine (Web Locks)            │     from AttendanceController::store)
                 → Next proxy /api/attendance/sync (httpOnly cookie) ┘   → attendance_logs (+source_event_id)
                                                                          attendance_events (audit/idempotency)
```

Backend stays the source of truth; client events are evidence; `check_in_at = device_recorded_at`, receipt time on the event row.

## 3. Phase 1 scope (foundation only — no UI, no service worker, no scanner)

### 3.1 Backend (`clby-api`)
- Migrations: `attendance_devices`; `attendance_events` (PK `event_id`, server-derived gym/branch/member, method, actor, device, both timestamps, result, reason, `attendance_log_id` FK ON DELETE SET NULL, payload_hash, qr_meta, metadata, attempts); `attendance_logs.source_event_id` uuid NULL + unique index. No (member, class_session) unique index yet (prod dups unverified; deploy-abort risk).
- `App\Services\AttendanceCheckInService` extracted from `AttendanceController::store` (store becomes a wrapper with identical responses).
- `POST /api/attendance/sync` — per-event transactions, idempotent replay of stored result, `event_id_conflict`/`event_id_reused`, server-derived tenant/actor, per-event permission matrix, clock sanity (future skew / max age), per-member advisory lock, results `accepted|duplicate|rejected|error(retryable)`, rejected events persisted, activity log, named rate limiter, max batch 50.
- `GET /api/attendance/offline/bootstrap` (staff, cursor-paged), `GET /api/attendance/offline/me` (member), `GET /api/attendance/offline/status`. All labelled `as_of`.
- `config/attendance_offline.php` (global; `enabled` default false; member QR offline off until Phase 3).
- sqlite feature tests (list in audit-backend §10.5) + store() regression tests.
- `member_qr` in Phase 1 = gym entrance with **v1 token lookup only**, validated properly server-side (gym must match). Signed v2 QR = Phase 3.

### 3.2 Shared Flutter package (`packages/clby_offline`, path dep of both apps)
- Drift schema: `outbox_events` (all spec fields + sync state + next_attempt_at + result fields), `cached_members`, `cached_memberships`, `cached_branches`, `cached_class_sessions`, `cached_recent_attendance`, `sync_meta`. Encrypted via sqlite3 `sqlite3mc` (key in flutter_secure_storage, never regenerated on a failed read). DB file per (api base, gym, user).
- `OfflineEventRecorder` (local duplicate check vs cache + pending), `SyncEngine` (single-flight, ordered by device_recorded_at, batches, per-event result mapping, exponential backoff + jitter, crash recovery `syncing→pending`, auth errors pause without data loss, never delete on timeout), `SyncTransport` interface (apps plug in their ApiService), `DeviceIdentity`, `OfflinePolicy`, `ConnectivityMonitor` abstraction.
- Unit tests (in-memory Drift): persistence across reopen, scoping isolation, dedupe, ordering, result mapping, backoff, crash recovery, timeout safety.
- Apps: dependency + wiring only (open/close DB on login/logout, X-App-Version / X-Device-Id headers). No screens.

### 3.3 Dashboard (`gym-admin`)
- `lib/offline/{types,db,sync-engine,bootstrap}.ts` with `idb`; per-user DB `clby-offline:{gym}:{user}`; Web Locks single-flight (IndexedDB lease fallback); Next proxies `app/api/attendance/sync` + `offline/bootstrap` + `offline/status` that return real 401s (not the login redirect).
- Vitest + `fake-indexeddb` tests mirroring the Flutter engine's.
- Real `npm install` in the worktree (replace the node_modules symlink) + npm-10 lockfile regen.

### 3.4 Acceptance for Phase 1
All new tests green; full existing API suite green; `store()` responses unchanged; one event → exactly one official row under replay, concurrent duplicate, and timeout-after-commit; cross-tenant events rejected; pending events survive DB reopen on both client stacks.

## 4. Decisions

Answered by the product owner 2026-11-26: P0 cross-tenant check-in → fixed separately (commit 4dfba7f, cherry-picked here); **D1 = A** (event_id-only dedupe for gym entry); **D2 = A** (validity as of device time, exhausted → accept + flag); **D5 = A** (coaches: PT/physio service sessions offline). Binding details in `CONTRACT.md`.

Defaults taken unless overridden:
- **D3** signed static v2 branch QR + optional rotating kiosk mode (Phase 3); `allow_member_qr_offline=false` until then.
- **D4** device-bound signed member pass (Phase 2/3).
- **D6** `attendance_logs.method` keeps existing values (`qr`/`manual`) so reports don't change; exact method lives on `attendance_events`.
- **D7** offline class check-in follows today's manual path (doesn't touch bookings); revisit in Phase 2.
- **D8** staff scope = whole gym (today's behaviour); per-branch staff scoping is a separate feature.
- **D9** pending events sync only with the same user's token; other accounts can't read or send them; explicit, logged discard only.
- Encryption: whole-DB on Flutter (sqlite3mc); dashboard IndexedDB unencrypted but per-user, cleared of cached member data on logout (browser storage can't be meaningfully encrypted without a server-held key — revisit in Phase 4).
