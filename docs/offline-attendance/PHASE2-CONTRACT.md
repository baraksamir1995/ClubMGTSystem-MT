# Offline Attendance — Phase 2 contract (admin + coach offline attendance UI)

Builds on `CONTRACT.md` (incl. §6). Phase 2 scope (SPEC §14): cached member lists, offline search, staff QR scanning, manual attendance, class attendance, pending-sync UI — for the **dashboard** and the **coach app**. Member-app UI (showing the pass, scanning the gym QR) is Phase 3. Service worker / installable PWA is Phase 4 — Phase 2 dashboard offline means "the attendance page was loaded while online and keeps working when the connection drops".

## Decision: member pass (D4, Phase 2 form)

Staff scanning needs a member credential that can be verified **offline**. Phase 2 ships a **server-signed member pass** (Ed25519, per-gym key). Screenshot/sharing risk is mitigated by: the scanner always shows the cached member photo + name for the staff to confirm, pass expiry, member status from the cache, and server re-verification on sync. Phase 3 adds a device-bound rotating signature from the member app on top (format field `v` reserved for that).

### Pass format (QR text)
Compact JSON, keys in this order:
```json
{"t":"clby_mp","v":1,"kid":"<key id>","g":"<gym_id>","m":"<gym_member_id>","n":<member_number|null>,"iat":<unix s>,"exp":<unix s>,"sig":"<base64url, no padding>"}
```
Signature = Ed25519 over the UTF-8 canonical string `clby_mp|1|<kid>|<g>|<m>|<n or empty>|<iat>|<exp>`.
Validity: `exp = iat + 30 days` (config `member_pass_ttl_days`). Unknown `t`/`v` → not a member pass.

### Keys
- Per-gym keypair in new table `gym_signing_keys` (`kid` text PK — short random id, `gym_id`, `purpose='member_pass'`, `public_key` base64url, `secret_key_enc` — encrypted with Laravel `Crypt` (APP_KEY), `status` active|retired, `created_at`, `retired_at`). Created lazily on first need. One active key per gym; rotation = new active key, old one `retired` but still accepted until its passes expire (`retired_at + ttl`).
- Private keys never leave the server; never logged; never returned by any endpoint.

### Endpoints (new)
- `GET /api/me/member-pass` (member, verified) → `{ qr: "<pass text>", expires_at: ISO, kid }`. Issues a fresh pass (cache per member for ≥ 1 h to avoid churn).
- `GET /api/members/{id}/member-pass` (admin-class, `permission:members,view`) → same shape, for printing a member card from the dashboard.
- Bootstrap (admin + coach variants) adds `pass_keys: [{kid, public_key, status, valid_until|null}]` (first page only). `/offline/me` adds the gym's `pass_keys` too (Phase 3 use).

### Verification (identical rules on dashboard, coach app, and server)
1. Parse; `t=="clby_mp"`, `v==1`, all fields present and well-typed → else `qr_invalid`.
2. `kid` known in cached `pass_keys` (active, or retired and still within `valid_until`) → else `qr_unknown_key` (client: "refresh offline data"; server: `qr_invalid`).
3. Signature valid → else `qr_invalid`.
4. `g` == the staff's gym → else `qr_wrong_gym`.
5. `exp` > estimated server now (CONTRACT §6.6 clock) and `iat` ≤ now + future skew → else `pass_expired` / `qr_invalid`.
6. Member `m` is in the cache (client) / exists in gym and not deleted (server) → else `member_not_found`. Client shows cached photo + name + membership summary labelled "as of <time>" and asks staff to confirm before recording.
Server re-runs 1–6 on sync for `staff_qr` events (using `qr.raw`), and the event's `member_id` must equal the pass's `m` → else `qr_member_mismatch`.

New result codes: `qr_unknown_key` (client only), `pass_expired`, `qr_member_mismatch`.

### Coach use (D5)
Coach scans a member pass to pick the member → then picks one of that member's cached active assignments → records `kind: service_session` (method field not used for service sessions; put `"source":"qr"|"manual"` in `metadata`).

## Staff review endpoints (new, admin-class `permission:attendance,view`)
- `GET /api/attendance/offline/events?result=rejected|accepted|duplicate&needs_review=1&cursor=` → paged list of the gym's synced events with member name, actor name, device label, method/kind, device_recorded_at, server_received_at, result, code, message, flags, official ids. For the "failed / flagged events" inspector.
- No edit/delete of events. Corrections use existing attendance permissions (e.g. delete an official attendance log via the existing endpoint); this phase only surfaces them.

## UI requirements (both clients)
- Connection/sync indicator on attendance screens: Online / Offline / Synchronizing / Pending (n) / Sync failed / Offline data expired / Login required / Device blocked.
- Readiness panel: last successful sync, data as-of + age, cached member count, cached class/assignment count, policy enabled?, "Refresh offline data" button, "Sync now" button.
- Every recorded item shows its state: "Saved on this device — waiting to sync" / "Synced — confirmed by server" / "Rejected — <reason>". Never show a local item as confirmed.
- Pending/rejected items can't be edited or deleted from the UI.
- When `policy.enabled` is false: online actions keep working exactly as today (existing endpoints), offline recording is disabled with an explanation.
- Arabic + English, RTL-safe.

## Online vs offline path (one path when enabled)
- `policy.enabled == true`: every attendance / PT record from the new screens goes through the outbox and is synced immediately when online (single code path; the existing online endpoints are not called by the new screens). The item shows "Synced" within seconds when online.
- `policy.enabled == false` (the shipped default): the new screens call the existing online endpoints (`POST /attendance`, `POST /coach/sessions/decrement`) exactly like today, and show a clear "offline mode is off for this gym" note. Staff QR scanning still works online (verify pass → member → existing endpoint).
- The existing attendance pages/screens stay as they are; the new screens are additive (dashboard: a new client-rendered route; coach app: wire into the existing log flow where natural).

## Amendments after Phase 2 verification (2026-11-26, binding)

1. **Pass must predate the scan.** Add to step 5: `iat` ≤ `device_recorded_at` + `future_skew_seconds` (server) / ≤ scan time + skew (clients), else `qr_invalid`. `iat > exp` → `qr_invalid` everywhere.
2. **Check order for messages:** after parsing (1), check `g` == staff gym (4) **before** key lookup (2), so another gym's pass says "wrong gym", not "refresh offline data". Then 2, 3, 5, 6.
3. **Strict canonical parsing on all three implementations** (a pass has exactly one valid QR text): JSON must be an object with exactly the 9 keys; `t` string, `v` integer `1` (not `1.0`), `kid`/`g`/`m` strings, `n` integer or null (not a string), `iat`/`exp` integers (no fractional/`.0`), `sig` base64url without padding whose decoded length is 64 and which re-encodes to the same string (reject non-canonical trailing bits, `+`/`/`, `=`); no BOM; total length ≤ 1024 chars. Anything else → `qr_invalid`.
4. **Key revocation:** `gym_signing_keys.status` gains `revoked` — never accepted, no grace. `pass_keys` includes revoked keys with `status: "revoked"` so clients reject them offline. Artisan command `attendance:pass-key {gym_id} {--rotate} {--revoke=kid}`.
5. **Unverified QR data:** `qr_meta` is stored only for passes that verified; rejected passes store only `{verified:false, reason}` (no claimed member/kid/times as if trusted).
6. **Review endpoint:** rows with result `error` return a generic message (no exception text).
