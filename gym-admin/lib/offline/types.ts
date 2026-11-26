/**
 * Offline attendance — shared types.
 *
 * Mirrors docs/offline-attendance/CONTRACT.md exactly (field names are the
 * wire names). Keep in sync with the Flutter package `packages/clby_offline`.
 *
 * This module (and everything under lib/offline/) must stay free of React /
 * Next imports so it can later be imported from a service worker.
 */

// ── §1 Event ────────────────────────────────────────────────────────────────

export type EventKind = 'attendance' | 'service_session';
export type AttendanceMethod = 'staff_qr' | 'member_qr' | 'manual';
export type AppName = 'admin' | 'coach' | 'member';
export type ActorType = 'gym_admin' | 'staff' | 'trainer' | 'member';

export interface OfflineEvent {
  event_id: string;
  kind: EventKind;
  /** kind=attendance only; null for service_session */
  attendance_method: AttendanceMethod | null;
  gym_id: string;
  branch_id: string | null;
  member_id: string;
  class_session_id: string | null;
  studio_id: string | null;
  service_assignment_id: string | null;
  /** ISO-8601 WITH offset, e.g. 2026-11-26T08:01:02.123+02:00. Never overwritten. */
  device_recorded_at: string;
  device_timezone: string;
  qr: { raw: string } | null;
  note: string | null;
  metadata: Record<string, unknown>;
}

/** The exact keys that go on the wire for an event (outbox-only fields are stripped). */
export const EVENT_WIRE_KEYS = [
  'event_id',
  'kind',
  'attendance_method',
  'gym_id',
  'branch_id',
  'member_id',
  'class_session_id',
  'studio_id',
  'service_assignment_id',
  'device_recorded_at',
  'device_timezone',
  'qr',
  'note',
  'metadata',
] as const satisfies readonly (keyof OfflineEvent)[];

// ── §5 Outbox row ───────────────────────────────────────────────────────────

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'rejected';

export interface OutboxRow extends OfflineEvent {
  actor_user_id: string;
  actor_type: ActorType;
  device_id: string;
  sync_status: SyncStatus;
  sync_attempts: number;
  /** epoch ms; null = due immediately */
  next_attempt_at: number | null;
  last_sync_error: string | null;
  /** server result status (accepted|duplicate|rejected|error) of the last result applied */
  result_status: ResultStatus | null;
  result_code: string | null;
  result_message: string | null;
  /** attendance_id or service_log_id */
  official_id: string | null;
  flags: string[];
  server_received_at: string | null;
  processed_at: string | null;
  /** ISO, local creation time */
  created_at: string;
  /** local-only: epoch ms of device_recorded_at, used for ordering (ISO strings with
   * different offsets don't sort lexicographically) */
  recorded_at_ms: number;
  /** local-only: epoch ms when the row was last moved to `syncing` */
  sync_started_at: number | null;
  /** local-only: consecutive 422 envelope failures while sent alone (CONTRACT §6.5) */
  envelope_failures?: number;
  /** local-only: set when the engine stops auto-retrying this row (capped 422s).
   * The row stays `pending` (never auto-rejected); a forced sync retries it. */
  sync_hold?: 'invalid_envelope' | null;
}

// ── §2 Sync request / response ──────────────────────────────────────────────

export interface SyncRequest {
  device_id: string;
  app: AppName;
  app_version: string;
  events: OfflineEvent[];
}

export type ResultStatus = 'accepted' | 'duplicate' | 'rejected' | 'error';

export type AcceptedCode = 'created';
export type DuplicateCode = 'event_replayed' | 'already_checked_in';
export type RejectedCode =
  | 'invalid_payload'
  | 'tenant_mismatch'
  | 'member_not_found'
  | 'branch_not_found'
  | 'class_session_not_found'
  | 'studio_not_found'
  | 'assignment_not_found'
  | 'assignment_not_active'
  | 'permission_denied'
  | 'not_self'
  | 'qr_invalid'
  | 'qr_wrong_gym'
  | 'branch_inactive'
  | 'not_a_member'
  | 'membership_frozen'
  | 'gym_access_not_included'
  | 'branch_not_included'
  | 'pack_expired'
  | 'guard_window'
  | 'clock_in_future'
  | 'event_too_old'
  | 'event_id_conflict'
  | 'event_id_reused'
  | 'offline_disabled';
export type ErrorCode = 'server_error';

/**
 * Known result codes. The backend also maps AttendanceController::store error
 * codes 1:1 (list owned by the backend), so `string` stays in the union.
 */
export type ResultCode = AcceptedCode | DuplicateCode | RejectedCode | ErrorCode | (string & Record<never, never>);

export type ReviewFlag = 'sessions_exhausted' | 'pack_exhausted';

export interface SyncResult {
  event_id: string;
  status: ResultStatus;
  code: ResultCode;
  message: string;
  attendance_id?: string | null;
  service_log_id?: string | null;
  flags?: (ReviewFlag | (string & Record<never, never>))[];
  server_received_at?: string | null;
  processed_at?: string | null;
  retryable?: boolean;
}

export interface SyncResponse {
  server_time: string;
  results: SyncResult[];
}

// ── §4 Policy ───────────────────────────────────────────────────────────────

export interface OfflinePolicy {
  enabled: boolean;
  max_batch: number;
  max_data_age_hours: number;
  max_event_age_days: number;
  future_skew_seconds: number;
  allow_manual_offline: boolean;
  allow_staff_qr_offline: boolean;
  allow_member_qr_offline: boolean;
  allow_service_session_offline: boolean;
  expired_cache_policy: 'warn' | 'block' | (string & Record<never, never>);
  retry_base_seconds: number;
  retry_max_seconds: number;
}

/** Contract defaults (CONTRACT §4). Used until the server sends a policy. */
export const DEFAULT_POLICY: OfflinePolicy = {
  enabled: false,
  max_batch: 50,
  max_data_age_hours: 24,
  max_event_age_days: 7,
  future_skew_seconds: 300,
  allow_manual_offline: true,
  allow_staff_qr_offline: true,
  allow_member_qr_offline: false,
  allow_service_session_offline: true,
  expired_cache_policy: 'warn',
  retry_base_seconds: 5,
  retry_max_seconds: 900,
};

/** Server-side hard cap on events per request (CONTRACT §2). */
export const SERVER_MAX_BATCH = 50;

// ── §3 Readiness endpoints ──────────────────────────────────────────────────

export interface OfflineStatusResponse {
  server_time: string;
  enabled: boolean;
  policy: OfflinePolicy;
  device: { registered: boolean; revoked: boolean };
}

export interface GymInfo {
  id: string;
  name: string;
  timezone: string;
}

export interface CachedBranch {
  id: string;
  name: string;
  is_active: boolean;
}

export interface MembershipBucket {
  membership_id: string;
  plan_type: string;
  source_type: string;
  status: string;
  payment_status: string | null;
  /** date-only `YYYY-MM-DD` in the gym's timezone (CONTRACT §6.4) */
  start_date: string | null;
  /** date-only `YYYY-MM-DD` in the gym's timezone (CONTRACT §6.4) */
  end_date: string | null;
  sessions_remaining: number | null;
  sessions_total: number | null;
  freeze_status: string | null;
  allowed_branch_ids: string[] | null;
}

export interface BootstrapMember {
  gym_member_id: string;
  member_number: string | number | null;
  full_name: string | null;
  phone_last4: string | null;
  photo_url: string | null;
  status: string;
  buckets: MembershipBucket[];
}

export interface CachedClassSession {
  id: string;
  class_id: string | null;
  name: string | null;
  branch_id: string | null;
  studio_id: string | null;
  starts_at: string;
  ends_at: string | null;
}

export interface RecentAttendance {
  attendance_id: string;
  gym_member_id: string;
  class_session_id: string | null;
  branch_id: string | null;
  check_in_at: string;
}

/** Admin-class bootstrap page (GET /api/attendance/offline/bootstrap). */
export interface AdminBootstrapPage {
  server_time: string;
  as_of: string;
  gym: GymInfo;
  policy: OfflinePolicy;
  branches: CachedBranch[];
  members: BootstrapMember[];
  class_sessions: CachedClassSession[];
  recent_attendance: RecentAttendance[];
  next_cursor: string | null;
}

// ── Local cache rows (IndexedDB) ────────────────────────────────────────────

/** members store row: bootstrap member minus buckets, plus a lowercase search key. */
export interface CachedMember extends Omit<BootstrapMember, 'buckets'> {
  name_lc: string;
}

/** memberships store row: one bucket, keyed by membership_id. */
export interface CachedMembership extends MembershipBucket {
  gym_member_id: string;
}

// ── meta store ──────────────────────────────────────────────────────────────

export interface MetaValues {
  identity: { user_id: string; gym_id: string; role: string };
  device_id: string;
  policy: OfflinePolicy;
  gym: GymInfo;
  /** snapshot `as_of` of the cached operational data */
  as_of: string;
  /** device time when the snapshot was stored (epoch ms) */
  snapshot_stored_at: number;
  /** server_time - device time at bootstrap/sync (ms), informational */
  server_clock_offset_ms: number;
  last_successful_sync_at: string;
  last_sync_attempt_at: string;
  bootstrap_cursor: string | null;
  sync_lease: { owner: string; expires_at: number };
}
export type MetaKey = keyof MetaValues;

// ── Engine state (for Phase 2 UI) ───────────────────────────────────────────

export type EngineStatus = 'online' | 'offline' | 'syncing' | 'pending' | 'failed' | 'expired';
/** device_revoked / device_mismatch are distinct per CONTRACT §6.1. */
export type PauseReason = 'auth_required' | 'device_revoked' | 'device_mismatch' | 'forbidden';

export interface SyncCounts {
  pending: number;
  syncing: number;
  synced: number;
  rejected: number;
}

export interface SyncEngineState {
  status: EngineStatus;
  online: boolean;
  running: boolean;
  paused: PauseReason | null;
  counts: SyncCounts;
  last_successful_sync_at: string | null;
  last_attempt_at: string | null;
  last_error: string | null;
  /** snapshot as_of of cached data, null if never bootstrapped */
  data_as_of: string | null;
  /** ms since data_as_of, null if never bootstrapped */
  data_age_ms: number | null;
  data_expired: boolean;
  /** epoch ms of the earliest scheduled retry, null if none */
  next_retry_at: number | null;
  /** pending rows the engine stopped auto-retrying (capped 422s, §6.5) — show as failed */
  held: number;
  /** last known server_time − device time (ms), null if never measured */
  clock_offset_ms: number | null;
}
