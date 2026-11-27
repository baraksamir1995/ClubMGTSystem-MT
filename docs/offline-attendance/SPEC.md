# Feature: CLBY Offline-First Attendance System

(Product owner's spec, saved verbatim-in-substance 2026-11-26. Phases are sequential: audit → Phase 1 plan → Phase 1 only.)

## Objective
Offline attendance across all three CLBY platforms — Admin Dashboard (gym-admin), Coach Mobile App (coaches_mobile_flutter), Member Mobile App (gym_mobile_flutter) — so gyms keep recording attendance without internet, with no lost events and no duplicate records. Locally recorded attendance syncs automatically to the backend when connectivity returns. ONE unified architecture, not three inconsistent implementations.

Attendance methods (all must work offline within the limits of cached data + secure offline validation):
- staff_qr — staff scans a member QR code
- member_qr — member scans the gym/branch QR code
- manual — admin or coach manually marks attendance

## 1. Mandatory codebase audit (before implementing)
Identify: Flutter member app architecture; Flutter coach app architecture; admin dashboard framework/routing; backend framework/API structure; current attendance DB schema; attendance creation + validation logic; QR generation + scanning; member/gym/branch/class/coach relationships; authn/authz; multi-tenant isolation (gym_id/branch_id); existing attendance duplicate-prevention rules; background processing + notification infrastructure. Produce a concise technical audit of reusable components and architectural gaps. Do not replace existing attendance logic without understanding it. Do not create a second attendance system — extend the existing one.

## 2. Offline architecture
Components: local storage; cached operational data; local attendance event queue; sync service; backend validation + idempotency; conflict resolution; offline status + sync UI. Backend is the single source of truth. A locally recorded event must be preserved even if sync fails.

Flutter: use existing local storage if reliable/secure enough, otherwise SQLite via Drift (or equivalent). Persist cached members, memberships, authorized branches, classes/schedules, attendance info for duplicate checks, pending events, sync metadata. Must survive navigation, app termination, app restart, device restart. Don't store sensitive info unnecessarily; encrypt sensitive local data and protect DB access.

Admin dashboard: PWA + Service Worker (app shell/assets) + IndexedDB (cached operational data) + persistent local event queue. Essential attendance UI must load offline. Service-worker caching alone is not database-level offline.

## 3. Data preparation / offline readiness
While online + authenticated, download data the user is authorized for: authorized gym/branch info; members of accessible gym/branch; member IDs + QR validation info; membership status + last known validity; assigned classes/schedules; existing attendance needed for duplicate detection; relevant permissions. Periodic + manual refresh. Display last successful sync time, cached member count, cached class count, offline readiness. Branch access must be respected — going offline must never expose another branch's data. Configurable maximum offline data age; warn when stale and apply configured policy.

## 4. Attendance methods
A. Staff scans member QR (dashboard + coach app): open screen → scanner → scan → validate payload → check cached member → check cached membership/attendance → check existing event → create local event → show "Pending sync" → auto-sync. Never present cached membership as live verification. If QR can't be verified locally, show a message rather than accepting an unverified identity. Preserve online behavior.

B. Member scans gym QR (member app): gym displays registered branch QR → member scans → validate payload locally → verify gym/branch identity → check cached membership → create local event → "saved offline, awaiting confirmation" → sync. Security: signed/verifiable gym/branch QR payloads; token expiry + replay protection; never trust arbitrary QR text; one gym's QR must never create attendance for another tenant; backend revalidates member + branch authorization. If existing QR is static, evaluate whether it can safely support offline validation or a signed format is needed. Do NOT silently introduce a QR format that breaks deployed app versions — compatible migration.

C. Manual (dashboard + coach app): search cached members (fully local) → select → select class/session if applicable → mark → save locally → pending status → auto-sync. Preserve existing permission restrictions.

## 5. Attendance event model
UUID idempotency key. Fields: event_id, gym_id, branch_id, member_id, class_id (nullable), attendance_method (staff_qr|member_qr|manual), recorded_by, actor_type, device_id, device_recorded_at, device_timezone, server_received_at, sync_status (pending|syncing|synced|rejected), sync_attempts, last_sync_error, metadata. Original event timestamp never overwritten by sync time; server timestamps for official receipt/processing. Preserve existing attendance schema where practical; separate event/outbox table if needed with clear relation to official attendance records. Never duplicate official attendance records.

## 6. Backend sync API
Batch endpoint following existing conventions, e.g. POST /api/attendance/sync with {device_id, events:[{event_id, gym_id, branch_id, member_id, class_id, attendance_method, device_recorded_at, device_timezone}]}. Per-event result: event_id, status, official attendance_id when created, server_received_at, rejection reason. Must: require auth; validate gym/branch authorization, member + class relationships, actor attendance permissions; enforce tenant isolation; process each event idempotently; partial batch success (valid events not rolled back by a failing one); rate + batch-size limits; audit logs. Repeated event_id never creates a second record. Never trust client-supplied gym_id/branch_id/member_id/actor without server-side authorization.

## 7. Duplicates + conflicts
Level 1 local: check cached attendance + pending events before creating; prevent rapid repeat scans. Level 2 backend: event_id duplication; existing attendance for same member+session; attendance from another device; configured duplicate window; existing CLBY rules. Do NOT invent a new duplicate window without inspecting current business rules. Two devices recording the same member: apply existing rules, clear result, keep audit trail of conflicting events, never silently delete a local event, no duplicate official record. Define handling of late-arriving events and clock discrepancies. Device timestamps are evidence, not authorization.

## 8. Sync engine
Triggers: app start with connectivity; connectivity regained; app resume; attendance screen opened; background sync where supported (never rely on it exclusively). Engine: load pending → order by original creation time → batch → process per-event results → mark synced → keep rejected visible → exponential backoff on transient errors → no concurrent duplicate jobs → safe recovery after termination → never delete an event because a request timed out. If server processed but client missed the response, retry must return the original result.

## 9. Offline UX
Connection indicator: Online / Offline / Synchronizing / Pending synchronization / Synchronization failed / Offline data expired, visible on attendance screens. Per-record: "Saved locally — pending synchronization" / "Synced — confirmed by server" / "Rejected — not accepted by server". Never show a local event as confirmed. Sync summary: pending, synced, rejected, last successful sync, cached data age. Authorized staff can inspect failed events + reasons. No editing/deleting pending events in ways that break the audit trail; correction/reversal workflow following existing permissions.

## 10. Platform specifics
Dashboard: PWA, IndexedDB, cached member search, offline QR scanning (camera permissions in installed PWA), manual + class attendance, pending queue, sync indicator, failure handling, cached data refresh.
Coach app: cached assigned classes, cached authorized member lists, offline QR scanning, manual attendance, offline history, pending status, auto-sync. Coaches only access assigned branches/classes/permitted member info.
Member app: cached identity + membership summary, offline member QR display, gym/branch QR scanning, offline event creation, pending check-in status, sync feedback. Never imply membership is currently valid from cached info; if expired/unavailable apply policy and explain.

## 11. Security + multi-tenancy (critical)
Encrypt sensitive local data; scope cache to gym + authorized branch; preserve roles/permissions; authenticated sync APIs; bind device identity to authenticated user/device registration; protect QR validation from forgery + replay; no auth secrets in ordinary local storage; safe logout + revocation handling; secure local cleanup on revoked access; no access to another gym's pending/cached attendance. On logout, pending attendance must not be silently deleted — explicit policy to preserve/sync authorized pending events without letting another account access them. Local DB manipulation must never bypass backend permissions.

## 12. Offline policy/config
Centralized config; evaluate: enable offline attendance; max offline data age; max offline operating period; manual allowed offline; member check-in allowed offline; staff QR allowed offline; behavior when cached membership expired; max batch size + retry config. Sensible defaults, preserve online behavior. No complex per-gym config unless the architecture supports it cleanly.

## 13. Testing
A Staff QR (cache, offline scan, restart persists, sync, exactly one official record). B Member QR (offline scan, sync, expired/invalid/replayed/cross-tenant tokens). C Manual (offline search + mark, restart, sync). D Multi-device conflicts (dup prevention, consistent results, audit kept). E Failure recovery (disconnect mid-sync, timeout after server processed, termination mid-sync, invalid auth, revoked access, expired cache, expired membership, branch access change, duplicate event ids, large queues, clock skew). F Regression (online QR, manual, class booking/attendance, history, branch restrictions, reports/analytics, attendance notifications).

## 14. Phases (sequential; each must pass acceptance before the next)
1 Architecture + data foundation: audit; local event model; cached data models; local persistence; backend idempotency + sync API; tests for event creation + sync.
2 Admin + coach offline attendance: cached member lists, offline search, staff QR, manual, class attendance, pending sync UI.
3 Member offline attendance: cached member QR, gym/branch QR offline validation, offline check-in, replay protection, sync feedback.
4 PWA + cross-platform reliability: dashboard PWA, IndexedDB, service worker, offline QR scanning, sync lifecycle, browser/mobile testing.
5 Conflict resolution + hardening: multi-device, failed events, revocation, expired cache, security review, performance, full regression.

## 15. Acceptance criteria
All three platforms support the offline workflows; staff scan cached member QR offline; members scan gym QR offline where secure validation is possible; admins/coaches manual offline; pending survives app + device restarts; auto-sync on reconnect (platform permitting); duplicate submissions never create duplicate official records; consistent multi-device conflict handling; offline vs confirmed clearly distinguished; cache respects gym/branch/role/user permissions; stale membership never shown as live; online attendance intact; failed sync never silently loses data; audit keeps original time, actor, device, sync outcome.

## 16. Delivery per phase
Files/modules changed, migrations, endpoints, local storage implementation, security considerations, automated tests run, manual test results, known limitations, remaining work. Never mark something implemented unless actually tested.

**Instruction: complete the audit, propose the detailed Phase 1 plan, then implement Phase 1 only.**
