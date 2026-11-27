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
