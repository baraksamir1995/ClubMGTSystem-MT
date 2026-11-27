# Offline Attendance — Phase 3 verification (PARTIAL, pre-amendment-2)

> **Status: PARTIAL — stopped by the lead before PHASE3-CONTRACT amendments 2 and 3.**
>
> - **Scope covered:** commits `53a8b67..68adf79`, judged against PHASE3-CONTRACT including the 2026-11-27 amendment 1 (one fixed static QR per branch, no kiosk).
> - **What did not run:** the member-app review and the dashboard smoke test (both delegated) were stopped mid-run, so their results are not included here.
> - **Re-run needed:** everything below must be re-verified after the rework.

## Suites

| Suite | Result |
|---|---|
| clby-api | **297 passed** (1439 assertions) |
| gym-admin vitest | **412 passed**, 7 skipped (env-gated live files) |
| gym-admin `tsc` | clean |
| gym-admin eslint | **1 error**, 13 warnings |
| Package / member / coach Flutter suites | not run (the delegated run was stopped) |
| Branch corpus 59/59 and P2 member-pass corpus 66/66 (Dart side) | not run |

The eslint error is `components/classes/schedule-tab.tsx:432` (rules-of-hooks in `_SessionCard`). It is pre-existing (commit e626184) and not part of Phase 3.

## Independent corpus (server side only)

**Location:** `scratchpad/verify/p3/mine/gen_my_branch_corpus.php` → `my_branch_corpus.json`. It has 24 cases of my own, verdicts from `BranchQrService::verify` with the DB writes rolled back. The Dart comparison was not run.

**Server verdicts:**

| Case | Verdict |
|---|---|
| Branch of another gym, signed with gym A's key | `qr_invalid` |
| Claims gym B, signed by A | `qr_wrong_gym` |
| Duplicate `token`: old then current (last wins) | ok |
| Duplicate `token`: current then old | `qr_invalid` |
| Appended `"v":1` | not_v2 |
| Appended `"type":"studio"` | not_v2 |
| Duplicate `"v":2` | ok |
| `iat` = scan + 299 s | ok |
| `iat` = scan + 301 s | `qr_expired` |
| `\u`-escaped token | ok |
| Negative `iat` | ok |
| `exp` = 2^60 | ok |
| `exp` overflowing int64 | `qr_invalid` |
| jti of 32 characters | ok |
| kid of 33 characters | `qr_invalid` |
| `sig` null | `qr_invalid` |
| Trailing newline / leading space | ok |
| Retired key, scan after grace | `qr_invalid` |
| Revoked key, scan before revocation | `qr_invalid` |
| **Rotating QR with a 10-year `exp`** | **ok** (see LOW-3) |

## Live results (my own servers: :8086 offline enabled + member QR allowed; :8087 defaults)

**Fixed poster:**
- `GET /branches/{id}/qr?mode=static` returned identical text on 3 calls, and :8086 and :8087 served the same text.
- aya (sales only), coach and member → 403. Another gym's admin → 404. `mode=rotating` → 422. `rotating-batch` → 404.

**`/offline/me`:**
- Member → 200 with `branches[].qr_token`, `member_pass{qr,expires_at,kid}` and `pass_keys`. It contains no secret and no other member's data.
- joe, coach, aya and the other gym's admin → 403.
- The admin bootstrap does not include `qr_token`. The coach bootstrap has `pass_keys` only.

**member_qr v2 sync as barak (:8086):**

| Case | Result |
|---|---|
| Poster signed with the real key, `iat` = now − 2 d, scanned −1 h | **accepted**, `qr_meta` exactly `{verified:true, v:2, mode:"static", kid, jti, iat, exp, branch_id}`, 1 attendance_logs row (`method=qr`, branch set, `check_in_at` = device time) |
| Stored fixed poster, scanned now | accepted, exact `qr_meta` |
| Stored fixed poster, scanned −1 h / −6 d | `qr_expired` |
| Any scan at −8 d | `event_too_old` |
| Revoked key | `qr_invalid` |
| Retired key, in grace | accepted |
| Retired key, past grace | `qr_invalid` |
| Stale token (poster from before "Regenerate", signed with the real key) | `qr_invalid` |
| Another gym's poster | `qr_wrong_gym` |
| v1 JSON, −1 h | `offline_disabled`, `qr_meta {verified:false, reason:"offline_disabled", v:1}` |
| v1 bare token, now | accepted (Phase 1 behaviour) |

The stored fixed poster is rejected at −1 h only because its `iat` is when it was first issued (my first GET at 15:25Z); the scan predates the poster.

**Offline disabled (:8087):**
- v2 scanned −1 h → `offline_disabled`.
- v2 scanned now → accepted (online grace).

**Old apps:** `POST /attendance/qr` with the v2 poster's token → `{status:"allowed"}` on both :8086 and :8087.

## Findings so far (pre-amendment-2)

### MEDIUM-1 — A fixed 10-year poster gives no proof of presence, and members can backdate check-ins up to 7 days

**What happens:**
- The poster text never changes and is printed on the wall; members' phones also keep it in `qr.raw`.
- Any member can replay it from anywhere, at any time, as an "offline" check-in.
- `device_recorded_at` can be backdated up to `max_event_age_days` (7), and there is no per-day limit (D1).
- Online v1 already allowed remote check-ins at *now*. What's new is backdating and the "verified" label in `qr_meta`.

**Repro:** the −1 h accepted case above (poster with an older `iat`).

**Fix:**
- Cap `member_qr` backdating (e.g. ≤ `max_data_age_hours`, or flag `needs_review` beyond a few hours).
- Limit to one accepted member_qr per member per branch per N hours.
- Consider an anomaly flag.

### LOW-1 — `/offline/me` returns every branch's v1 secret `qr_token` to every member

This includes inactive branches and branches outside the member's `allowed_branch_ids`. It is a documented deviation (BACKEND-NOTES P3 §9), and the gym-entry rules still apply online.

**Fix:** return only tokens for active branches the member may enter, or a hash of the token for the offline comparison.

### LOW-2 — `verify()` accepts any poster signed with the gym's key, not only the stored fixed one

`jti` is not checked against `branch_qr_posters`. "One fixed QR" is enforced only at issue time; posters reissued because of key rotation or nearing `exp` stay valid until grace or `exp`. This is documented for rotation.

**Fix:** optionally require `jti` to equal the stored poster's `jti`, or a recent previous one.

### LOW-3 — Dormant rotating verification doesn't bound `exp − iat`

A "rotating" QR with a 10-year `exp` verifies (corpus `mine_rotating_long_lived_10y` → ok). Only the key holder can produce one, but if anything ever issues rotating QRs again, enforce `exp − iat ≤ period`.

### Other notes

- The poster's advisory-lock issuance looks correct: `pg_advisory_xact_lock` plus `FOR UPDATE` re-read and a PK backstop.
- No branch has a NULL `qr_token` (null tokens would yield unverifiable posters).

## Not done (for the full pass)

- Dart vs server on both corpora.
- Package, member and coach suites.
- The member app: offline entry rules, router redirect, scanner dispatcher (old online path unchanged?), sign-out wipe of `member_pass`, `screen_protector` scope.
- Dashboard branch-QR modal smoke, and Regenerate in the UI.
- Coach and dashboard regression with offline disabled.

## Cleanup

- **Deleted:**
  - my 16 sync events (`app_version='p3verify'`), their 5 attendance_logs rows and 16 device rows;
  - 2 online `/attendance/qr` rows (f8bd832d, 4268901d);
  - the temporary signing keys `p3vRev01`, `p3vRet01`, `p3vOld01`;
  - a stray key `fd391c87cebe` created for gym 691364d4.
- **Stored poster:** the Golden Hights `branch_qr_posters` row was created by my first GET. It is the branch's legitimate fixed poster, so I kept it.
- **Delegated agents:** asked to stop and revert their data (including the Sheraton token, if changed). Their reports are pending.
- **Servers:** the :8086 / :8087 servers and the `p3-verify` tokens are removed when the agents stop (see the final report).
