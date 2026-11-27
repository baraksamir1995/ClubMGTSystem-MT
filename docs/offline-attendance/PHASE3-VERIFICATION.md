# Offline Attendance — Phase 3 verification

> **Scope:** commits `2bb081a` (api), `7e2e9b8` (mobile, coach, offline package) and `17caa1d` (admin) on `feat/offline-attendance`, judged against PHASE3-CONTRACT with amendments 1–4.
> **Verdict:** no HIGH issues. **3 MEDIUM** (1 server, 2 member app), several LOW. Every suite passes. All implementer corpora agree; one of my own cases disagrees (LOW).
> **Date:** 2026-11-27. Local Postgres `clby_offline`; APIs on :8091 (policy on) and :8092 (policy off); dashboards on :3011 → :8091 and :3012 → :8092.

## 1. Suites

| Suite | Result |
|---|---|
| clby-api | **299 passed** |
| gym-admin vitest | **371 passed** |
| gym-admin `tsc` | clean |
| gym-admin eslint | 1 error at `components/classes/schedule-tab.tsx:432` (rules-of-hooks). It is pre-existing (e626184), not Phase 3. |
| gym-admin live test | 5/5 |
| `packages/clby_offline` | **178 passed**, 10 skipped (env-gated live and corpus files, run separately below). `flutter analyze`: no issues. |
| `gym_mobile_flutter` | **31 passed**, plus 7 of my own temporary logic tests (deleted afterwards). `flutter analyze lib test`: 22 warnings. 3 are in Phase 3-touched files, all unused declarations: `profile_screen.dart:41,43`, `api_service.dart:214 _patch`. |
| `coaches_mobile_flutter` | **22 passed**. `flutter analyze lib test`: no issues. |

## 2. Cross-implementation corpora (PHP vs Dart)

The implementer corpora were generated at 20:14, before the API commit at 20:17. I regenerated them against HEAD; every server verdict was unchanged.

| Corpus | Cases | Disagreements |
|---|---|---|
| `branch_corpus.json` v2 (regenerated) | 64 | 0 |
| `specialist_corpus.json` (regenerated) | 55 | 0 |
| `my_branch_corpus.json` (mine) | 24 | 0 |
| `my_specialist_corpus.json` (mine) | 16 | **1** |

**The disagreement (LOW):** `mine_nested_object_value` (`jti` = `{"a":{"b":{"c":1}}}`). Dart says `qr_invalid`; the server says `not_v2`.
- **Cause:** PHP `SpecialistQrService::isV2`/`parse` call `json_decode(..., 4)`. Deeper nesting returns null, so the server treats the QR as not v2.
- **Dart side:** `SpecialistQr.claimsV2` (`packages/clby_offline/lib/src/pass/specialist_qr.dart:55`) has no depth limit. It claims v2, then the strict parse fails.
- **Branch QR:** `BranchQrService` and `BranchQr.claimsV2` have the same pattern (read in the code, not run).
- **Impact:** only a hand-crafted QR is affected. Both sides reject it; only the label differs.
- **Fix:** add the same depth limit in Dart `claimsV2`, or drop the depth argument in PHP.

## 3. API (live, :8091 / :8092)

- **Gym QR offline:** a member check-in backdated 1 h was accepted. `check_in_at` equals the device time and `qr_meta` was complete (`v, kid, iat, exp, jti, mode, verified, branch_id`).
- **Coach QR:**
  - `GET /coach/qr` is stable across calls and equals `own_qr` in the coach bootstrap. Admin and member get 403.
  - An offline coach-QR session backdated 5 h was accepted with `qr_meta`, and exactly one session log was created.
  - A second scan 20 min later (inside the 30-min window) returned `duplicate` / `recently_logged`, pointing at the original log, with no new row.
  - A member can only log for themselves: an event naming another member is recorded for the sender.
  - Rejected: a `trainer_id` that differs from the QR, another member's package, and an admin or coach sender.
  - An unsigned coach QR offline, or any offline scan with the policy off, gets `offline_disabled`.
- **Removal and compatibility:**
  - The member-pass routes return 404.
  - Old apps keep working: `/specialists/scan` response codes and fields are unchanged, and `/attendance/qr` accepts the token from the new gym QR (`{"status":"allowed"}` on :8092).

## 4. Dashboard (live, Playwright + Chrome)

Script: `scratchpad/verify/p3/full/dash/live-checks.cjs`. Results are in `live-{A,B,C}.json` and screenshots in `shots/` in the same folder. Every check passed.

### A. Policy on (:3011, gym admin)

**Offline:**
- **Status pill:** reads "Online", then "Offline".
- **Banner:** shown.
- **Dimming:** everything below the header is dimmed (`opacity 0.4`, `pointer-events:none`, `inert`, includes the tabs). Clicking a tab is blocked. Gym QR Code and Manual Check-in stay enabled.
- **Gym QR offline:** the modal shows "Shown from saved copy", and Download PNG works (`gym-checkin-qr-sheraton.png`).
- **Manual Check-in offline:** recorded barak and "test pay". Each showed "Saved on this device — will sync when back online", and the pill read "Offline · 2 pending". IndexedDB held 2 pending outbox rows.

**After reconnecting:**
- The pill returns to "Online", the dimming is removed, and both events synced.
- **Server rows:**
  - barak: `accepted`, method `manual`, app `admin`, and `check_in_at` = device time.
  - test pay: `rejected` with `no_active_subscription`.
- **Rejection notice:** "1 offline check-in was not accepted by the server — test pay (27 Nov 2026 8:52 PM): Member does not have an active subscription."
  - Dismiss hides it, and it stays hidden after a reload.
- No page errors.

### B. Sign-out wipe (:3011, separate token)

- **Before sign-out:** members 3, memberships 8, branches 2, class_sessions 4, recent_attendance 2415.
- **Sign-out:** redirects to `/login` and the server revoked the token.
- **After sign-out:** all cache stores hold 0 rows, and meta keeps only `device_id`, `identity`, `policy`, `server_clock_offset_ms`. The outbox is kept.

### C. Policy off (:3012)

- Online behaves normally.
- Offline:
  - The pill reads "Offline".
  - The Manual Check-in modal shows "Offline check-in is turned off for this gym…", and Log Check-in is disabled.
  - Nothing is queued.
- Reconnect works.

## 5. Mobile (member + coach)

The live runs below are against :8091 with the barak account and the device clock 1 h behind.

| Event | Result |
|---|---|
| Gym QR backdated 1 h | accepted; one `attendance_logs` row at device time |
| Coach QR backdated 1 h | accepted; exactly one `service_session_logs` row (the package was restored afterwards) |
| Same coach QR 20 min later | `duplicate` / `recently_logged`, no new row |
| Policy off (:8092) | recorder refuses gym-QR and coach-QR events with `offlineDisabled`; outbox stays empty |

Code review and unit tests (no simulator, by agreement):
- **Offline mode with the policy off:** not possible. `tryEnterOfflineMode` closes the store and returns false when the cached `enabled && allow_member_qr_offline` is false.
- **Dimmed shell:** the whole shell is under `IgnorePointer` + `Opacity 0.35`. Only the centre Scan button works.
- **Status chip:** hidden when the policy is off (`shouldShowStatus`), including offline with pending events.
- **Scanner when the policy is off, or for v1/unsigned codes:** the old `_handleCode` body moved unchanged into `_handleCodeOnline`, so behaviour is as before.
  - **Behaviour change:** with the policy on and online, a signed coach QR now goes through the outbox. The member sees the "saved / synced" sheet instead of today's success screen with sessions remaining. This is by contract §4 (not a defect).
- **Coach app:**
  - The QR screen and the offline home show the cached signed `own_qr`. The QR screen falls back to the unsigned QR when nothing is cached.
  - Scanning member passes is removed.
  - HTML error pages are classified like the member app's.

## 6. Findings

### MEDIUM

**M1. The fixed QRs can be replayed and backdated (server).**
- The gym poster and the coach QR are each valid for 10 years. Each can be scanned from anywhere and backdated up to `max_event_age_days` (7).
- Nothing limits entries per day, and nothing shows the member was present.
- So a member who keeps a photo of either QR can log gym entries, and coach sessions that use up their package, without being there or without the coach.
- **Fix:**
  - cap how far back member-QR events can be dated (for example a few hours), or flag them `needs_review` past that;
  - limit member-QR gym entries per day;
  - flag coach sessions the coach did not confirm.

**M2. The member app can stay dimmed with no way out (`member_offline_controller.dart:131-139`).**
- Offline mode is left only when the connectivity plugin reports a change from offline to online.
- **How it gets stuck:** a cold-start 5xx or timeout with the network still up enters offline mode. `SyncState.online` stays `true`, so no such change ever arrives and the profile is never reloaded.
- **Why nothing recovers it:**
  - `AuthProvider`'s resume refresh requires a loaded profile.
  - The whole shell ignores taps, so Profile, pull-to-refresh and sign-out are unreachable.
  - `retryOnline()` and `confirmSignOut()` are now unused.
- The app stays dimmed until it is killed. Confirmed by reading the code; not run on a device.
- **Fix:** while in offline mode, retry the profile load on resume and on a backoff timer, and give the status chip an `onTap` with "Try again" and "Check-ins on this phone".

**M3. "Check-ins on this phone" can't be reached offline without scanning first.**
- Profile is dimmed and the chip has no `onTap`.
- The only way in is the button on the result sheet after a new scan, so a member who reopens the app offline cannot see pending or rejected check-ins. Amendment 3 requires access from Profile.
- **Fix:** the same chip `onTap` as M2.

### LOW

- **L1:** the corpus depth mismatch (section 2).
- **L2:** `/offline/me` returns every branch's check-in token (including inactive and not-allowed branches) and every trainer (including inactive ones).
- **L3:** online `/specialists/scan` lets a member log a session with an inactive trainer. This is pre-existing (not Phase 3).
- **L4:** the scanner app bar shows the sync chip even with the policy off (`qr_scanner_screen.dart:789`).
  - Behind it, the member store is opened and `/offline/me` is fetched for every member regardless of policy (`bootstrapWhenDisabled: true`, whose comment still refers to the removed pass).
- **L5:** with the policy off, the server still serves the full `/attendance/offline/bootstrap`, and the dashboard caches member data in IndexedDB (seen live on :3012: 3 members, 2415 recent check-ins). I did not check whether this is new in Phase 3.
- **L6:** offline coach-QR denial messages differ from online ones.
  - `/offline/me` sends only `status='active'` packages (`AttendanceOfflineController.php:532`).
  - So a finished or expired package shows `no_package` offline, where online returns `package_exhausted` or `package_expired`.
- **L7:** a duplicate coach scan shows the gym "already checked in" message (`qr_scanner_screen.dart:545`).
- **L8:** the coach QR screen builds a new `ownQr()` future on every rebuild, so the unsigned QR flashes briefly on first build. Cache the future in state.
- **L9:** leftovers from the member-pass removal.
  - The dashboard still writes the `pass_keys` meta key.
  - The dashboard messages keep `qr_member_mismatch` and `pass_expired` texts.
  - The member app's v3→v4 migration leaves an old cached `member_pass` row.
  - `verify_p3_member_backdated_live_test.dart` queries `status, code` columns that don't exist (the real columns are `result, reason_code`).
- **L10:** dashboard code reading: `manualOutbox` is not memoised, which slows member search. The offline policy is only fetched when the page first loads online.
- **Info:** the member app requires `allow_member_qr_offline` even for coach QR offline, while the server gates `service_session` only on `allow_service_session_offline`. The client is stricter, which is safe.

## 7. Not verified

- Nothing ran on a simulator or device (by agreement, to save disk). The dimmed shell, M2 and M3 come from code reading and unit tests.
- The online `/specialists/scan` success path for recv was blocked by a log another agent had made inside the 30-min window.

## 8. Cleanup

- **Deleted:**
  - all verification rows: the dashboard runs' 509 events (507 + 2) with their 505 attendance logs and 6 devices; the mobile run's 5 events, 4 attendance logs and 1 session log, plus its device row;
  - the `p3full-verify` tokens.
- **Restored:** the coach packs I touched to their original counts.
- **Stopped:** the servers on :3011, :3012, :8091 and :8092.
- **Removed:** the temporary test files; the env-gated `verify_p3full_member_live_test.dart` was moved to the scratchpad, so `git status` is clean.
- **Not mine, left in place:** events and devices from 16:33–20:26 (earlier implementer smoke runs), and token 342 `p3-member-live`.
