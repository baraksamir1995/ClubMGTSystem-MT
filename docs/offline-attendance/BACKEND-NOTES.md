# Offline Attendance — backend notes (clby-api)

## Phase 3

Implements `PHASE3-CONTRACT.md` server side: signed branch QR v2, the branch poster endpoint, v2 `member_qr` sync with rotating replay protection, and `/offline/me` additions.

### Phase 3 verification — server LOW fixes (2026-11-27)

- **`/offline/me` scope (L2):**
  - `branches[].qr_token` is the current token **only for active branches this member may enter**, using the gym-entry rules (`gymEntryDenialForBranch` === null: own gym, active paid subscription not frozen, gym-capable plan, branch in `allowed_branch_ids`; no-subscription and transfer rules unchanged). Every other branch is still listed, with `qr_token: null`.
  - `trainers` lists **active trainers only**.
- **Policy off (L5)**, when `attendance_offline.enabled` is false:
  - `/offline/bootstrap` (admin and coach) and `/offline/me` return a **minimal snapshot**: `server_time`, `as_of`, `gym`, `policy` and `pass_keys`, with every list empty and no tokens.
    - admin: `branches`, `members`, `class_sessions`, `recent_attendance` are `[]`, `next_cursor:null`;
    - coach: `assignments`, `recent_service_logs` are `[]`, `own_qr:null`, `next_cursor:null`;
    - member: `member:null`, and `buckets`, `branches`, `recent_attendance`, `trainers`, `assignments` are `[]`.
  - The top-level shape is unchanged, so existing parsers (the dashboard requires `members` to be an array) keep working while caching nothing.
  - Role and permission checks still run first.
  - `/coach/qr` itself is unaffected.
- **Member-pass leftovers (L9, server side):**
  - removed the sync messages for `pass_expired` / `qr_member_mismatch` and the unused config `member_pass_cache_minutes`;
  - reworded the key command, the key-service messages and comments to "gym/QR signing keys".
  - The `pass_keys` meta key and stale texts in the **dashboard** are client-side and not in this change. Server-side `pass_keys` (the public-key list) stays, as Amendment 2 requires.
- **Online coach-scan bugs: fixed** (ported from `fix/specialist-scan` d2be08a so they don't come back on merge):
  - the online 30-minute guards (`SpecialistSessionService` online path behind `/specialists/scan`, and the `ServiceSessionService` coach decrement) pass the cutoff as ISO-8601 with an offset, so a Postgres session in Africa/Cairo no longer stretches the window to ~2.5 h;
  - `/specialists/scan` with an **inactive** trainer returns 404 `{"error":"This specialist is no longer active at your gym.","code":"specialist_not_found"}`.
  - Tests: `SpecialistScanRegressionTest` (inactive case) and the Postgres-only `CoachGuardPostgresTest`, which runs with `CLBY_PG_TEST_DATABASE=clby_offline` inside a rolled-back transaction and fails without the fix.
- **Not changed (L1, label only):** a hand-crafted QR nested deeper than `json_decode`'s depth of 4 is `not_v2` on the server and `qr_invalid` in Dart. Both reject it.

### Amendment 2: no member pass; the coach QR works offline (2026-11-27)

**A. Member pass removed (server)**
- **Removed:**
  - `GET /api/me/member-pass` and `GET /api/members/{id}/member-pass` now return 404 (`MemberPassController` deleted);
  - `member_pass` is gone from `/offline/me`;
  - `MemberPassService` lost `passFor`, `issue`, `verify`, `parse` and `canonical`.
- **Kept:**
  - `gym_signing_keys` (they sign the gym and coach QR v2);
  - `pass_keys` in the admin/coach bootstrap and `/offline/me`;
  - `attendance:pass-key`;
  - `MemberPassService` itself, now only key management (active key, rotate, revoke, `pass_keys`, `verificationKey`, `withSigner`, base64url). The class name is historical.
- **Sync, `staff_qr`:** → `rejected/qr_invalid` with message `method not supported`, after the payload, tenant, clock and offline-gate checks. No client sends it.
- **Coach `service_session` with `metadata.source="qr"`:** the member-pass check is gone, so these are treated as manual coach sessions, which is how Phase 1 already handled them.

**C. Coach (specialist) QR v2** (`SpecialistQrService`)
- **Format and signature:** the exact 9 keys in contract order, signed with the gym key over `clby_sq|2|<kid>|<gym_id>|<trainer_id>|<iat>|<exp>|<jti>`.
- **Fixed QR per trainer** in the new table `trainer_qr_posters` (migration `2026_11_27_220000_…`; primary key `trainer_id`; columns `gym_id`, `qr`, `kid`, `iat`, `exp`):
  - the same text on every call;
  - reissued only when the kid is not the gym's active key, or within 30 days of `exp`;
  - TTL `branch_qr_static_ttl_days` (3650);
  - concurrent first calls are safe (pg advisory lock + `FOR UPDATE` re-read + primary key).
- **Endpoints:**
  - `GET /api/coach/qr` (coach group) → `{qr, expires_at, kid}`;
  - the coach bootstrap's **first page** adds `own_qr` (the same object).
- **Verification**, as of `device_recorded_at`:
  1. not v2 (anything that isn't an object with `type:"specialist_session"` and integer `v:2`) → `not_v2`;
  2. strict parse (same rules as the branch QR) → `qr_invalid`;
  3. gym → `qr_wrong_gym`;
  4. key (unknown, revoked or out of grace) → `qr_invalid`;
  5. signature → `qr_invalid`;
  6. trainer exists in the gym and `is_active` → else `qr_invalid`;
  7. time: `iat > exp` → `qr_invalid`; `iat > scan + skew` or `scan > exp` → `qr_expired` (a scan exactly at `exp` is ok).
- **Old member apps:** `POST /specialists/scan` takes `trainer_id`, which old apps read from the v2 text; this is unchanged. `SpecialistScanController` is now a thin wrapper over `SpecialistSessionService`, with byte-identical responses (`SpecialistScanRegressionTest`).
- **Sync event**, a member scanning the coach QR. Payload, matching the Flutter package's wire format:
  - `kind:"service_session"`, `attendance_method:"member_qr"` (the contract text says "method"; the wire field is `attendance_method`, as for every other event);
  - `trainer_id` (required uuid) and `qr.raw` (required);
  - `service_assignment_id` must be absent or null (otherwise `invalid_payload`); the server picks the pack.
- **Sync rules:**
  - **Actor:** admin-class actor → `permission_denied`; the member is forced to self.
  - **Offline gate:** an offline event needs `enabled` **and both** `allow_service_session_offline` and `allow_member_qr_offline`, the same as the client.
  - **v2 QR:** verified as above. Its `trainer_id` must equal the event's, otherwise `qr_invalid` ("trainer_id does not match the scanned QR").
  - **Unsigned v1 coach QR:** offline → `offline_disabled` (online-only, like the v1 gym QR). Near-real-time → processed if its `gym_id` and `trainer_id` match; `qr_meta={verified:false, reason:"unsigned_v1_online", v:1}`.
  - **Pack rules:** `SpecialistSessionService::memberScan(..., at: device_recorded_at)`, the code shared with the online endpoint:
    - no pack with this trainer → `rejected/no_package`;
    - every pack expired **at device time** → `rejected/package_expired`;
    - only cancelled or manually completed packs → `rejected/assignment_not_active`;
    - another session for (member × trainer) within ±30 min of the device time → **`duplicate/recently_logged` with the original `service_log_id`**;
    - otherwise the soonest-expiring active pack with sessions left → decrement (complete at 0) under row lock;
    - if every pack valid at the visit is used up → D2: **accepted** with `flags:["pack_exhausted"]`, `service_session_logs.review_flag='pack_exhausted'`, and no counter change.
  - **Log row:** `note='Member self-scan'`, `delivered_at` = device time, `source_event_id` = the event (unique).
  - **`qr_meta`:** accepted → `{verified:true, v:2, kid, jti, iat, exp, trainer_id}`; rejected → `{verified:false, reason, v}`.
- **`/offline/me` adds:**
  - `trainers: [{id, name, service_type (= trainer_profiles.trainer_type), is_active}]`, the gym's **active** trainers (see the LOW fixes above);
  - `assignments: [{id, trainer_id, service_type, sessions_total, sessions_used, expires_at (ISO), status}]`, the member's own packs with status `active` only.
- **Dormant rotating branch QRs now have a lifetime bound:** `exp - iat > 120` → `qr_invalid` (`BranchQrService::ROTATING_MAX_LIFETIME`). **The Dart verifier must mirror this rule.**
- **Corpora:**
  - `scratchpad/verify/p3/gen_specialist_corpus.php` writes `specialist_corpus.json` (55 cases, with `trainers` and `pass_keys`). It covers both cross-type directions (a branch-QR signature pasted into a coach QR, a branch QR offered as a coach QR) and a member-pass signature pasted into a coach QR.
  - `branch_corpus.json` was regenerated as **version 2** (64 cases): the 59 earlier verdicts are unchanged, plus 3 rotating-lifetime cases and 2 coach-QR cross-type cases. The v1 file is kept as `branch_corpus.v1.json`.

### Product amendment: one fixed QR per branch, no rotating codes (2026-11-27)

- **Same QR every time.** `GET /api/branches/{id}/qr?mode=static` returns the **same QR text on every call**. The issued poster is stored in a new table, `branch_qr_posters`:
  - columns: `branch_id` PK, `gym_id`, `qr`, `kid`, `token`, `iat`, `exp`, timestamps;
  - migration `2026_11_27_210000_create_branch_qr_posters_table.php` (new table, guarded); the legacy `branches` table is untouched.
- **Reissued only when** (the stored row is overwritten):
  - the branch `qr_token` changed (admin "Regenerate"; the old poster then fails `qr_invalid`);
  - the stored `kid` is no longer the gym's active key (`attendance:pass-key --rotate`, or rotate + revoke);
  - the poster is within `branch_qr_reissue_before_days` (30) of `exp`.
- **Concurrent first calls** are safe. Under a transaction, the code takes the pg advisory lock `branch-qr-poster:<branch_id>`, re-reads the row with `FOR UPDATE`, and returns that poster if another request stored it meanwhile. The primary key on `branch_id` is the backstop.
- **TTL:** `branch_qr_static_ttl_days` default is now **3650** (10 years), effectively never expiring.
- **Removed:**
  - the route `GET /branches/{id}/qr/rotating-batch`;
  - `BranchQrController::rotatingBatch` and `BranchQrService::rotatingBatch`;
  - the config keys `rotating_period_seconds` and `rotating_batch_max_hours`.
  - Nothing issues `mode=rotating` any more; `?mode=rotating` on the poster endpoint → 422.
- **Kept, now dormant:** `BranchQrService::verify` still handles rotating-mode QRs (`rotating_grace_seconds`), and `attendance_qr_redemptions` plus the `qr_replayed` sync path are unchanged. `branch_corpus.json` and the Dart verifier depend on them; the corpus was **not** regenerated. Tests build rotating QRs by hand (`OfflineSyncTestCase::signRotating`) to keep that path covered.
- Item 8 below still applies: a key rotation now reissues the stored poster, and the gym must **reprint** it. The old poster keeps verifying for the 30-day pass grace, or not at all if the key was revoked.

### Contract deviations / interpretations (Phase 3)

1. **v1 `member_qr` is online-only (D3).** An offline v1 event (older than `online_grace_seconds`) is rejected `offline_disabled` ("Offline check-in needs a signed (v2) gym QR code"), **even when `allow_member_qr_offline` is true**. Near-real-time v1 events behave exactly as in Phase 1, and online `/attendance/qr` is unchanged.
2. **How v2 is detected.** A QR is v2 only if the raw text (as-is, no trimming) JSON-decodes to an object with `type === "gym_access"` and `v === 2` (an integer). Everything else is "not v2" and takes the v1 path; the corpus verdict for it is `not_v2`. This includes `v: 2.0`, `"2"`, 1, a BOM, an array wrapper or a bare token. A recognised v2 then gets the strict parse below; any failure → `qr_invalid`.
3. **Strict parse** (same rules as the member pass):
   - ≤ 1024 characters, exactly the 11 keys, integers only;
   - lowercase canonical UUIDs for `gym_id`, `branch_id` and `token` (an uppercase value, even if signed, → `qr_invalid`);
   - `mode` is `static` or `rotating`;
   - `kid` matches `[A-Za-z0-9_-]{1,32}`, `jti` matches `[A-Za-z0-9_-]{16,32}`;
   - `sig` is canonical unpadded base64url of 64 bytes.
   - As with the pass, key order, JSON whitespace and `\u` escapes are not enforced.
4. **Step 5** (unknown branch, inactive branch, or token ≠ the branch's current `qr_token`) → `qr_invalid`, as the contract says. The Phase 1 code `branch_inactive` remains for v1 QRs only.
5. **Step 6, time** (judged at `device_recorded_at`):
   - `iat > exp` → `qr_invalid`;
   - `iat > scan + future_skew_seconds` → `qr_expired`, per the contract's wording (the member pass uses `qr_invalid` for the same situation);
   - static: `scan ≤ exp` (a scan exactly at `exp` is accepted);
   - rotating: `scan ≤ exp + rotating_grace_seconds` (30).
   - There is no separate `iat ≤ server now + skew` check, because the sync clock rule already caps `device_recorded_at` at now + skew.
6. **Rotating replay protection:**
   - New table `attendance_qr_redemptions` with **UNIQUE (jti, gym_member_id)**. The check runs under the per-member advisory lock on Postgres; the unique index is the backstop.
   - A second use by the same member → `duplicate/qr_replayed` with the **original** `attendance_id`, even if the membership changed since. A different member may use the same token once.
   - Without the pg lock (sqlite), a true race hits the unique index: that event becomes a retryable `error`, and its retry returns `qr_replayed`.
   - Static posters have no replay limit beyond D1.
7. **`qr_meta`:**
   - accepted v2 events store exactly `{verified:true, v:2, mode, kid, jti, iat, exp, branch_id}`;
   - rejected v2 events store `{verified:false, reason, v:2}` (the Phase 2 shape plus `v`);
   - rejected offline v1 events store `{verified:false, reason:"offline_disabled", v:1}`.
8. **Keys:** branch QRs use the gym's member-pass key. After `attendance:pass-key --rotate`, static posters keep verifying only for the **pass** grace (`member_pass_ttl_days`, 30 d), not the 365-day poster TTL, so reprint posters after a rotation. `--revoke` invalidates them at once. The branch "Regenerate" token action also invalidates old posters (token mismatch).
9. **`/offline/me` exposes `branches[].qr_token` to members**, as required by step 5, now only for active branches the member may enter (LOW fixes above). That token is the v1 check-in secret (also printed on every poster): any member can now read it via the API and use online `/attendance/qr`, where the gym-entry rules still apply. Staff bootstrap does **not** include `qr_token`.

### Endpoints

- `GET /api/branches/{id}/qr?mode=static` (admin group, `permission:attendance,view`; the branch must belong to the caller's gym, otherwise 404) → `{qr, mode:"static", expires_at, kid}`.
  - `mode` may only be `static` (otherwise 422).
  - The same stored text on every call (see the amendment). `jti` is 16 random bytes → 22 characters, chosen at (re)issue.
  - `exp = iat + branch_qr_static_ttl_days` (3650).
- ~~`GET /api/branches/{id}/qr/rotating-batch`~~: **removed** by the product amendment above (404).
- `GET /api/attendance/offline/me` adds:
  - `branches[].qr_token` (current, lowercase);
  - ~~`member_pass`~~: removed by Amendment 2; `trainers` and the member's own `assignments` were added instead (see above).
- `POST /api/attendance/qr` is unchanged and accepts a v2 poster's `token` (regression test plus Postgres e2e).
- Config: `branch_qr_static_ttl_days` (3650), `branch_qr_reissue_before_days` (30), `rotating_grace_seconds` (30, verifier only).

### Files

- `app/Services/BranchQrService.php`: issue, batch, verify, strict parse.
- `app/Http/Controllers/BranchQrController.php`.
- `app/Services/MemberPassService.php`: new shared `verificationKey()` and `withSigner()`, which decrypts the secret once and wipes it; member-pass behaviour is unchanged.
- `app/Services/AttendanceSyncService.php`: `evaluateMemberQrV2`, the v1 online-only rule, codes `qr_expired` and `qr_replayed`.
- `app/Http/Controllers/AttendanceOfflineController.php` (`/me`).
- `config/attendance_offline.php`, `routes/api.php`.
- Migration `2026_11_27_200000_create_attendance_qr_redemptions_table.php` (new table, unique `(jti, gym_member_id)`, FK to `attendance_logs` set to null on delete).
- Tests: `BranchQrTest` (8), `MemberQrV2SyncTest` (6). Existing v1 `member_qr` tests now send near-real-time events.
- **Corpus:** `scratchpad/verify/p3/gen_branch_corpus.php` writes `branch_corpus.json` (59 cases).
  - Every case has a `scan_ms`; the file also includes `pass_keys` (active/retired/revoked) and `branches` (id, `is_active`, `qr_token`).
  - Server verdicts were produced against Postgres with the writes rolled back.
  - Verdicts: `ok | not_v2 | qr_invalid | qr_wrong_gym | qr_expired`. Clients may say `qr_unknown_key` where the server says `qr_invalid` for key failures.

---

## Phase 2

Implements `PHASE2-CONTRACT.md` (server side: member pass, pass verification on sync, review endpoint).

### Contract deviations / clarifications (Phase 2)

1. **`GET /api/me/member-pass` is not limited to role `member`.** Any user with a `gym_members` row in their gym gets their own pass, so a staff member who also trains can use one. Users without a row get 404 `{code: member_not_found}`.
   - The route sits in the members group, so members need a verified email (`verified_member`).
2. **One cached pass per member, shared by both pass endpoints.** `/me/member-pass` and `/members/{id}/member-pass` return the same cached pass for 60 min (`ATTENDANCE_MEMBER_PASS_CACHE_MINUTES`, minimum 60).
   - The cache key includes the `kid`, so rotating the key issues a new pass at once.
3. **Server verification** (after the Phase 2 verification amendments §1–§4):
   - **Order:** 1 strict parse → 4 gym (`qr_wrong_gym`, before any key lookup) → 2 key → 3 signature → 5 time → 6 member.
   - **Key step:** an unknown kid, a **revoked** key (any time), a retired key past its grace at scan time, or a key belonging to a gym other than `g` all give `qr_invalid`.
   - **Time step:**
     - `iat > exp` → `qr_invalid`;
     - `iat > device_recorded_at + future_skew_seconds` (pass issued after the scan) → `qr_invalid`;
     - `iat > server now + skew` → `qr_invalid`;
     - `exp ≤ device_recorded_at` → `pass_expired`.
   - Expiry and retired-key grace are judged at the scan time (D2): a pass valid when scanned is accepted even if it has expired since. Because `iat` must predate the scan, a pass minted later can no longer label a backdated event as QR-verified (verification MEDIUM-1).
   - **Strict parse (§3)**, anything else → `qr_invalid`:
     - ≤ 1024 characters, no BOM;
     - a JSON object with exactly the 9 keys;
     - `t === "clby_mp"`, `v === 1` (an integer; `1.0` and `true` rejected);
     - `kid` matches `[A-Za-z0-9_-]{1,32}`;
     - `n` is an integer or null, `iat`/`exp` are integers (no `.0`, no exponent);
     - `sig` is base64url without padding, decodes to exactly 64 bytes and re-encodes to the identical string. This rejects `+`, `/`, `=`, extra or short characters, and non-canonical trailing bits.
   - **Two tightenings beyond the enumerated list (deviation):**
     - `g` and `m` must be **lowercase** canonical UUIDs, as issued. An uppercase `m`, even if validly signed, → `qr_invalid`; clients currently say `member_not_found`, so both reject.
     - `|n| ≤ 2^53−1`, so every client can represent it exactly (JS already rejected larger values).
   - **Still accepted by all three implementations:** JSON whitespace, key order, `\u` escapes and duplicate keys (last wins). The signature binds the decoded values, so these re-encodings are harmless. They are not rejected because §3 doesn't list them; tighten all three together if wanted.
4. **`staff_qr` is now strict.** It requires `qr.raw` to be a valid pass naming `member_id`. A missing or non-pass `qr` → `qr_invalid` (in Phase 1, `staff_qr` without a QR was accepted). Results are `qr_invalid`, `qr_wrong_gym`, `pass_expired`, `member_not_found` or `qr_member_mismatch`.
   - The check runs after the permission check and the offline gate.
   - For a rejected pass, `attendance_events.gym_member_id` stays null, because the server stores only verified ids. The claimed id is in `metadata.claimed`.
   - `qr_meta` (§5):
     - verified passes store `{verified:true, format:"clby_mp", v, kid, iat, exp, m}`, never the signature;
     - rejected passes (including `qr_member_mismatch`) store only `{verified:false, reason}`.
5. **Coach `service_session` with `metadata.source == "qr"` and a `qr.raw`:** verified the same way. The pass `m` must equal the **assignment's** member, otherwise `qr_member_mismatch` (an event `member_id` must already match the assignment).
   - `source:"qr"` without `qr.raw`, or manual sessions, are unchanged.
6. **`pass_keys`:**
   - Shape: `[{kid, public_key (base64url of 32 bytes), status, valid_until}]`.
   - Order: active key first, then retired keys (listed only while `valid_until`, i.e. `retired_at + member_pass_ttl_days`, is in the future), then **revoked** keys.
   - Revoked keys are always listed with `status:"revoked"` and `valid_until = revoked_at` (already past), so clients reject them offline even if they only compare `valid_until`.
   - Sent on the admin and coach bootstrap first page (the key sits just before `next_cursor`) and in `/offline/me`.
   - The first request that needs a key creates it.
7. **Key management (§4):** `php artisan attendance:pass-key {gym_id} [--rotate] [--revoke=KID]`.
   - **No options:** lists keys (kid, status, valid_until, public key).
   - **`--rotate`:** new active key; the old one becomes `retired` with grace.
   - **`--revoke=KID`:**
     - revokes a retired key immediately (`status='revoked'`, `revoked_at`);
     - **refuses to revoke the active key** unless `--rotate` is given too. In that case it rotates first (printing `New active kid: …`) and then revokes.
   - Never prints secret material. On a gym with no key yet, the listing creates one, as for any first use.
   - New migration `2026_11_27_100100_add_revoked_at_to_gym_signing_keys.php` (additive).
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
   - Rows with `result = error` return the generic message "Temporary server error; the event will be retried." The stored exception text is never exposed (§6).

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
- Tests: `MemberPassTest`, `StaffQrSyncTest`, `MemberPassHardeningTest` (amendments).
- `app/Console/Commands/AttendancePassKey.php` (artisan `attendance:pass-key`).
- **Shared cross-implementation corpus:** the generator `scratchpad/verify/p2/gen_corpus.php` writes `corpus.json` (version 2, 66 cases), with the server verdicts produced against Postgres (writes rolled back).
  - Cases may carry an optional **`scan_ms`**: the scan time used for `iat`-after-scan, expiry and grace. Clients must use `scan_ms ?? now_ms` as the scan time; `now_ms` stays the server clock.
  - `pass_keys` in the corpus now includes a `revoked` key.

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
