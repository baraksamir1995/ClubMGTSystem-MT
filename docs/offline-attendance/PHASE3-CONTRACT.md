# Offline Attendance — Phase 3 contract (member offline attendance)

Builds on CONTRACT.md (+§6) and PHASE2-CONTRACT.md (+amendments). Phase 3 scope (SPEC §14): cached member QR (the member pass), gym/branch QR offline validation, offline member check-in, replay protection, sync feedback — member app + the server and dashboard pieces it needs.

Decision D3 (default from PHASE1-PLAN, now binding): **signed branch QR v2**, two modes — `static` (printed poster, long-lived) and `rotating` (a kiosk screen at the entrance showing a QR that changes every 60 s, working offline from a pre-signed batch). Unsigned v1 QRs stay online-only.

## 1. Branch QR v2 format

Strict JSON **superset of today's v1 payload** so deployed apps keep working online (they read only `type`, `gym_id`, `branch_id`, `token` and ignore extra keys):

```json
{"type":"gym_access","gym_id":"<uuid>","branch_id":"<uuid>","token":"<branches.qr_token uuid>","v":2,"mode":"static|rotating","kid":"<kid>","iat":<unix s>,"exp":<unix s>,"jti":"<16–32 char [A-Za-z0-9_-]>","sig":"<base64url no padding>"}
```
- Key order exactly as above; exactly these 11 keys; same strictness rules as the member pass (PHASE2 amendment §3: integers only, lowercase canonical UUIDs, canonical unpadded base64url sig of 64 bytes, no BOM, ≤ 1024 chars).
- Signature: Ed25519 with the gym's **member-pass signing key** (same `gym_signing_keys` row and `kid`, same rotation/revocation), over the canonical string
  `clby_bq|2|<mode>|<kid>|<gym_id>|<branch_id>|<token>|<iat>|<exp>|<jti>`
  (distinct `clby_bq` prefix so a branch QR signature can never be confused with a member pass signature).
- `static`: `exp = iat + branch_qr_static_ttl_days` (default 365), one `jti` per issued poster. Regenerating the branch token (existing admin "Regenerate") invalidates old posters online and offline (token mismatch with the cached branch token).
- `rotating`: `exp = iat + 60`, fresh `jti` per token.

## 2. Verification (member app offline, and server)
1. Strict parse; `type=="gym_access"`, `v==2` → else not a v2 QR (fall back to v1 handling: online-only).
2. `gym_id` == member's gym → else `qr_wrong_gym`. (White-label builds also require `gym_id == Env.gymId`.)
3. `kid` in cached `pass_keys`, not revoked, active or retired-within-grace at scan time → else `qr_unknown_key` (client) / `qr_invalid` (server).
4. Signature over the canonical string → else `qr_invalid`.
5. Branch: `branch_id` is a cached active branch of the gym and `token` equals that branch's cached current `qr_token` → else `qr_invalid` (client says "This QR is out of date — ask staff").
6. Time (scan time = device time for the event; server judges at `device_recorded_at`): `iat ≤ scan + future_skew`, `scan ≤ exp + rotating_grace_seconds` (default 30, rotating only) / `scan ≤ exp` (static) → else `qr_expired`; `iat > exp` → `qr_invalid`.
7. Local membership pre-check (client only, informational, labelled "as of"): same rules as `gymEntryDenial` against cached buckets; a local denial is shown to the member and **no event is recorded** (matches today's online UX). The server re-checks authoritatively.

Server-only replay protection for `member_qr` events with a v2 QR:
- `rotating`: each `(jti, gym_member_id)` may produce at most one accepted event — a second one is `duplicate` with code `qr_replayed` (returns the original attendance id). A rotating token scanned more than `rotating_grace_seconds` after `exp` (by device time) is `qr_expired`.
- `static`: no replay limit beyond D1 (static posters are inherently replayable; mitigations are the signature, token match, membership rules and `allow_member_qr_offline` policy).
- Every accepted member_qr event stores `qr_meta = {verified:true, v:2, mode, kid, jti, iat, exp, branch_id}`.

`/attendance/qr` (online endpoint used by today's apps) also accepts a v2 QR's `token` exactly as now — no change for deployed apps.

## 3. Server endpoints (new / changed)
- `GET /api/branches/{id}/qr?mode=static` (admin, `permission:attendance,view`, branch in caller's gym) → `{ qr: "<v2 text>", mode, expires_at, kid }` for printing posters.
- `GET /api/branches/{id}/qr/rotating-batch?hours=12` (admin, same permission; max 24 h) → `{ tokens: [{qr, iat, exp}], kid, generated_at }` — consecutive 60 s rotating tokens covering the window, for the kiosk to display offline.
- `GET /api/attendance/offline/me` adds: `branches[].qr_token` (current token, needed for step 5), `member_pass: {qr, expires_at, kid}` (the member's own pass, so the app can show it offline), `pass_keys` (already present).
- Config: `branch_qr_static_ttl_days` (365), `rotating_grace_seconds` (30).

## 4. Member app
- **Offline cold start:** if the last signed-in member's scoped store exists, opens with its key, and has a `/offline/me` snapshot, the app starts in a limited offline mode (pass + check-in + this-device history) instead of failing; same rules as the coach app (same user + token + API base; only network/timeout/5xx enter offline mode; 401 → sign-in; 403 → blocked). Online-only screens show an offline notice.
- **Member pass screen:** shows the cached pass QR (high error correction, max brightness, screen-capture protection via the already-present `screen_protector` where supported), name + number, and "Pass valid until <date>". Refresh when online; if the cached pass is expired and offline, explain it can't be shown. Never shows membership as live — membership summary labelled "as of <time>".
- **Gym QR scan (existing `qr_scanner_screen.dart`):**
  - v2 QR + offline mode enabled for the policy (`enabled && allow_member_qr_offline`): verify offline (§2) → local pre-check → record `member_qr` event with `qr.raw` → show "Check-in saved on this phone — will confirm when you're back online"; then sync and update to "Confirmed" / "Not accepted — <reason>".
  - Otherwise (v1 QR, or policy off, or online and policy off): **existing online flow unchanged** (`/attendance/qr`, same messages). Offline + v1 QR or policy off → clear message that offline check-in isn't available here.
  - When online and policy on: record via outbox and sync immediately (single path, like Phase 2).
- **This-device check-ins** list (Saved / Confirmed / Not accepted + reason, read-only) and a small sync indicator on the scanner/pass screens.
- Logout: existing sign-out fan-out closes the store (pending events kept, cache wiped) — warn if pending check-ins exist and offer to sync first when online.
- EN + AR, RTL, all white-label flavors (no flavor-specific code paths beyond the `Env.gymId` lock).

## 5. Dashboard
- Branch QR modal (`gym-qr-modal.tsx`): prints/downloads the **v2 static** QR (from the new endpoint); keeps v1 display only if the endpoint fails (with a note).
- **Kiosk screen** (`/dashboard/attendance/kiosk/{branchId}` or similar, client-rendered, full-screen): downloads a rotating batch while online, shows the current token full-screen (QR + branch name + countdown), advances every 60 s using the monotonic-anchored server clock, keeps working offline until the batch runs out (warn at < 1 h left, refresh automatically when online). Permission `attendance,view`. Camera not needed.

## 6. Cross-implementation corpus
Extend `scratchpad/verify/p2/gen_corpus.php` (or a sibling `gen_branch_corpus.php`) with branch QR v2 cases (valid static/rotating, tampered fields, member-pass signature replayed as branch QR, wrong gym, unknown/revoked kid, token mismatch, expired/grace, iat>exp, non-canonical encodings). Server and Dart must agree on every case.

## Amendment (2026-11-27, product decision, binding)

No rotating QR / kiosk. Each branch has **one fixed signed QR** (`mode: static`) that never changes:
- `GET /api/branches/{id}/qr?mode=static` returns the **same text on every call**. It is reissued only when the branch token is regenerated, when the signing key is rotated or revoked, or when the poster is within 30 days of `exp`.
- `branch_qr_static_ttl_days` default is 3650 (10 years).
- The `rotating-batch` endpoint and the dashboard kiosk are removed.
- Verification of `mode: rotating` and the replay table stay as specified (dormant, since nothing issues rotating QRs), so the shared corpus is unchanged.

## Amendment 2 (2026-11-27, product decision, binding): no member pass; coach QR offline

The user does not want a member pass. Members check in only by scanning QRs, online or offline, and the app syncs later.

**A. Member pass removed everywhere (never deployed).**
- Member app: pass screen, Profile row, and pass on the offline screen.
- Server: `/api/me/member-pass`, `/api/members/{id}/member-pass`, `member_pass` in `/offline/me`.
- Dashboard and coach app: staff scanning of member passes. Staff keep **manual** offline recording (search member → record) from Phase 2.
- Sync: `staff_qr` method → `rejected/qr_invalid` with message "method not supported" (no client sends it).
- **Kept:** `gym_signing_keys` and `pass_keys` (they sign and verify the gym and coach QRs), the `attendance:pass-key` command, and the Phase 2 member-pass corpus files (archived, no longer run).

**B. Member scans the gym QR offline.** Unchanged from §2 and Amendment 1 (one fixed signed QR per branch).

**C. Member scans the coach QR offline (new).**

The coach app's existing QR `{"type":"specialist_session","gym_id","trainer_id"}` becomes a **signed v2 superset**:

```json
{"type":"specialist_session","gym_id":"<uuid>","trainer_id":"<trainer_profiles.id uuid>","v":2,"kid":"<kid>","iat":<s>,"exp":<s>,"jti":"<16–32 [A-Za-z0-9_-]>","sig":"<b64url>"}
```

- **Key order and parsing:** exactly these 9 keys in this order, with the same strictness rules as §1.
- **Canonical signed string:** `clby_sq|2|<kid>|<gym_id>|<trainer_id>|<iat>|<exp>|<jti>`, signed with the gym's signing key.
- **One fixed QR per trainer:** stored server-side the same way as branch posters (same text on every call; reissued on key rotate or revoke, or within 30 days of exp; TTL 3650 days).
- **Old member apps** keep working online (they read only `type`, `gym_id`, `trainer_id`).

**Endpoints**
- `GET /api/coach/qr`, for the coach themselves → `{qr, expires_at, kid}`.
- The coach bootstrap also includes `own_qr`, so the coach app shows the signed QR offline. If the coach app has never fetched it, it falls back to today's unsigned QR, which is online-only for members.

**Client verification**
- Steps: strict parse → `gym_id` matches the member's gym (plus the white-label lock) → key → signature → `trainer_id` is a cached active trainer of the gym → time (`iat` ≤ scan + skew; scan ≤ `exp`).
- Errors: `qr_invalid` / `qr_wrong_gym` / `qr_unknown_key` / `qr_expired`.
- Local pre-check, informational: the member has a cached active assignment with that trainer, with sessions remaining and not expired. Otherwise show today's denial messages (`no_package` / `package_expired` / `package_exhausted`) and record nothing.

**Event:** `kind: service_session`, `method: member_qr`, actor = member, `member_id` = self, `qr.raw` = the scanned text, `trainer_id` in payload.

**Server on sync**
- Verify the QR as of `device_recorded_at`.
- Then apply exactly the online `SpecialistScanController` rules as of device time, using the shared code path:
  - pick the assignment;
  - expired → rejected;
  - exhausted → D2: accepted + `review_flag`, matching the coach offline rule;
  - the SCAN_GUARD window (`recently_logged`) → `duplicate`, returning the original log id;
  - decrement and complete under lock;
  - write `service_session_logs` with `source_event_id`.
- Store `qr_meta` the same way as for branch QRs.

**`/offline/me`** adds:
- `trainers: [{id, name, service_type, is_active}]` for the member's gym;
- `assignments: [{id, trainer_id, service_type, sessions_total, sessions_used, expires_at, status}]` for the member's own active service assignments, labelled "as of".

**Corpus:** add specialist QR v2 cases (valid, tampered, a branch-QR signature replayed as a coach QR and the reverse, wrong gym, unknown or revoked key, inactive trainer, expired, strictness). PHP and Dart must agree on every case.

**Member app:** the offline screen shows only "Scan QR" and "Check-ins on this phone". The check-ins list shows both gym check-ins and coach sessions.
