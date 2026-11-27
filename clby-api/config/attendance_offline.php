<?php

/*
|--------------------------------------------------------------------------
| Offline attendance policy (global; per-gym overrides may come later)
|--------------------------------------------------------------------------
|
| Served as the `policy` object by GET /api/attendance/offline/*
| (docs/offline-attendance/CONTRACT.md §4, §6.2). `enabled` and the allow_*
| flags are enforced server-side for OFFLINE events (device_recorded_at older
| than `online_grace_seconds`); near-real-time events are always processed.
|
*/

$bool = fn (string $key, bool $default) => filter_var(env($key, $default), FILTER_VALIDATE_BOOL);

return [
    'enabled' => $bool('ATTENDANCE_OFFLINE_ENABLED', false),
    'max_batch' => (int) env('ATTENDANCE_OFFLINE_MAX_BATCH', 50),
    'max_data_age_hours' => (int) env('ATTENDANCE_OFFLINE_MAX_DATA_AGE_HOURS', 24),
    'max_event_age_days' => (int) env('ATTENDANCE_OFFLINE_MAX_EVENT_AGE_DAYS', 7),
    'future_skew_seconds' => (int) env('ATTENDANCE_OFFLINE_FUTURE_SKEW_SECONDS', 300),
    'allow_manual_offline' => $bool('ATTENDANCE_OFFLINE_ALLOW_MANUAL', true),
    'allow_staff_qr_offline' => $bool('ATTENDANCE_OFFLINE_ALLOW_STAFF_QR', true),
    // Off until the signed v2 branch QR ships (Phase 3): a v1 token can't
    // be verified on a device without leaking the check-in secret.
    'allow_member_qr_offline' => $bool('ATTENDANCE_OFFLINE_ALLOW_MEMBER_QR', false),
    'allow_service_session_offline' => $bool('ATTENDANCE_OFFLINE_ALLOW_SERVICE_SESSION', true),
    'expired_cache_policy' => env('ATTENDANCE_OFFLINE_EXPIRED_CACHE_POLICY', 'warn'), // warn | block
    'retry_base_seconds' => (int) env('ATTENDANCE_OFFLINE_RETRY_BASE_SECONDS', 5),
    'retry_max_seconds' => (int) env('ATTENDANCE_OFFLINE_RETRY_MAX_SECONDS', 900),
    // CONTRACT §6.2: an event is "offline" when device_recorded_at is older
    // than server receipt minus this grace. Offline events are rejected
    // `offline_disabled` when `enabled` or the per-kind/method allow_* flag
    // is false; events within the grace are always processed (online-equivalent).
    'online_grace_seconds' => (int) env('ATTENDANCE_OFFLINE_ONLINE_GRACE_SECONDS', 120),

    // Phase 2 member pass (PHASE2-CONTRACT): exp = iat + this many days.
    // Retired signing keys are still accepted until retired_at + this TTL.
    'member_pass_ttl_days' => (int) env('ATTENDANCE_MEMBER_PASS_TTL_DAYS', 30),
    // Issued passes are reused for this long to avoid churn (≥ 1 h per contract).
    'member_pass_cache_minutes' => (int) env('ATTENDANCE_MEMBER_PASS_CACHE_MINUTES', 60),

    // Phase 3 signed branch QR v2 (PHASE3-CONTRACT §1–§2).
    // One fixed poster per branch that effectively never expires (10 years);
    // reissued only on token regenerate / key rotation / within 30 d of exp.
    'branch_qr_static_ttl_days' => (int) env('ATTENDANCE_BRANCH_QR_STATIC_TTL_DAYS', 3650),
    'branch_qr_reissue_before_days' => 30,
    // Rotating QRs are no longer issued; the verifier still honours this
    // grace for any rotating-mode QR it sees (dormant path).
    'rotating_grace_seconds' => (int) env('ATTENDANCE_ROTATING_GRACE_SECONDS', 30),

    // Server-side only (not part of the policy object).
    'sync_rate_per_minute' => (int) env('ATTENDANCE_OFFLINE_SYNC_RATE_PER_MINUTE', 30), // per user
];
