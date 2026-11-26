<?php

/*
|--------------------------------------------------------------------------
| Offline attendance policy (global; per-gym overrides may come later)
|--------------------------------------------------------------------------
|
| Served verbatim as the `policy` object by GET /api/attendance/offline/*
| (docs/offline-attendance/CONTRACT.md §4). `enabled` only tells clients
| whether they may CREATE new offline events — POST /api/attendance/sync
| keeps processing already-recorded events when it is false, so data on a
| device is never stranded.
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

    // Server-side only (not part of the policy object).
    'sync_rate_per_minute' => (int) env('ATTENDANCE_OFFLINE_SYNC_RATE_PER_MINUTE', 30),
];
