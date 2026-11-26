/**
 * Offline attendance — event recorder (dashboard, kind=attendance).
 *
 * Creates `pending` outbox rows after the Level-1 local duplicate checks:
 *  - anti-double-tap: the same member + same class_session + same method within
 *    `doubleTapWindowMs` (default 5 s) returns the existing event instead of a new
 *    one. This is a UI guard against accidental repeat taps/scans, NOT a business
 *    duplicate window (D1: gym entry has no duplicate window; only event_id dedupes).
 *  - class rule (existing CLBY rule): one attendance per (member, class_session)
 *    — checked against the cached recent_attendance + non-rejected outbox rows.
 *
 * The server re-validates everything; a local pass never means "confirmed".
 */
import { getCachedMember, getMeta, type OfflineDB } from './db';
import {
  DEFAULT_POLICY,
  type ActorType,
  type AttendanceMethod,
  type OfflinePolicy,
  type OutboxRow,
} from './types';

export const DEFAULT_DOUBLE_TAP_WINDOW_MS = 5_000;

export interface RecorderContext {
  gymId: string;
  userId: string;
  actorType: ActorType;
  deviceId: string;
  /** override; defaults to the cached policy (or DEFAULT_POLICY) */
  policy?: OfflinePolicy;
  now?: () => Date;
  timeZone?: string;
  doubleTapWindowMs?: number;
}

export interface RecordAttendanceInput {
  member_id: string;
  attendance_method: Exclude<AttendanceMethod, 'member_qr'>;
  branch_id?: string | null;
  class_session_id?: string | null;
  studio_id?: string | null;
  qr?: { raw: string } | null;
  metadata?: Record<string, unknown>;
}

export type RecordRejection =
  | 'offline_disabled'
  | 'method_not_allowed'
  | 'invalid_input'
  | 'member_not_cached'
  | 'double_tap'
  | 'already_checked_in';

export type RecordResult =
  | { ok: true; event: OutboxRow }
  | {
      ok: false;
      reason: RecordRejection;
      /** for double_tap / already_checked_in: the existing local event, if any */
      existingEvent?: OutboxRow;
      /** for already_checked_in from the server cache */
      existingAttendanceId?: string;
    };

const METADATA_MAX_BYTES = 4096;

/** Format a Date as ISO-8601 with the local UTC offset, e.g. 2026-11-26T08:01:02.123+02:00. */
export function toIsoWithOffset(d: Date): string {
  const pad = (n: number, w = 2) => String(Math.abs(Math.trunc(n))).padStart(w, '0');
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}` +
    `${sign}${pad(offsetMin / 60)}:${pad(offsetMin % 60)}`
  );
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function methodAllowed(policy: OfflinePolicy, method: AttendanceMethod): boolean {
  if (method === 'manual') return policy.allow_manual_offline;
  if (method === 'staff_qr') return policy.allow_staff_qr_offline;
  return policy.allow_member_qr_offline;
}

export async function recordAttendance(
  db: OfflineDB,
  ctx: RecorderContext,
  input: RecordAttendanceInput,
): Promise<RecordResult> {
  const policy = ctx.policy ?? (await getMeta(db, 'policy')) ?? DEFAULT_POLICY;
  // CONTRACT §4: when disabled, clients must not create new offline events.
  if (!policy.enabled) return { ok: false, reason: 'offline_disabled' };
  if (!methodAllowed(policy, input.attendance_method)) return { ok: false, reason: 'method_not_allowed' };

  if (!input.member_id || (input.attendance_method === 'staff_qr' && !input.qr?.raw)) {
    return { ok: false, reason: 'invalid_input' };
  }
  const metadata = input.metadata ?? {};
  if (new TextEncoder().encode(JSON.stringify(metadata)).length > METADATA_MAX_BYTES) {
    return { ok: false, reason: 'invalid_input' };
  }

  const member = await getCachedMember(db, input.member_id);
  if (!member) return { ok: false, reason: 'member_not_cached' };

  const now = ctx.now?.() ?? new Date();
  const nowMs = now.getTime();
  const classSessionId = input.class_session_id ?? null;
  const windowMs = ctx.doubleTapWindowMs ?? DEFAULT_DOUBLE_TAP_WINDOW_MS;

  const row: OutboxRow = {
    event_id: globalThis.crypto.randomUUID(),
    kind: 'attendance',
    attendance_method: input.attendance_method,
    gym_id: ctx.gymId,
    branch_id: input.branch_id ?? null,
    member_id: input.member_id,
    class_session_id: classSessionId,
    studio_id: input.studio_id ?? null,
    service_assignment_id: null,
    device_recorded_at: toIsoWithOffset(now),
    device_timezone: ctx.timeZone ?? deviceTimeZone(),
    qr: input.qr ?? null,
    note: null,
    metadata,
    actor_user_id: ctx.userId,
    actor_type: ctx.actorType,
    device_id: ctx.deviceId,
    sync_status: 'pending',
    sync_attempts: 0,
    next_attempt_at: null,
    last_sync_error: null,
    result_status: null,
    result_code: null,
    result_message: null,
    official_id: null,
    flags: [],
    server_received_at: null,
    processed_at: null,
    created_at: now.toISOString(),
    recorded_at_ms: nowMs,
    sync_started_at: null,
  };

  // Check + insert in ONE readwrite transaction so two rapid taps in the same
  // tab (or two tabs) serialize on the outbox store.
  const tx = db.transaction(['outbox', 'recent_attendance'], 'readwrite');
  const outbox = tx.objectStore('outbox');
  const memberEvents = await outbox.index('member_id').getAll(input.member_id);
  const live = memberEvents.filter((e) => e.sync_status !== 'rejected');

  const tap = live.find(
    (e) =>
      e.class_session_id === classSessionId &&
      e.attendance_method === input.attendance_method &&
      Math.abs(nowMs - e.recorded_at_ms) < windowMs,
  );
  if (tap) {
    tx.abort();
    await tx.done.catch(() => undefined);
    return { ok: false, reason: 'double_tap', existingEvent: tap };
  }

  if (classSessionId) {
    const localDup = live.find((e) => e.class_session_id === classSessionId);
    if (localDup) {
      tx.abort();
      await tx.done.catch(() => undefined);
      return { ok: false, reason: 'already_checked_in', existingEvent: localDup };
    }
    const cached = await tx
      .objectStore('recent_attendance')
      .index('member_session')
      .get([input.member_id, classSessionId]);
    if (cached) {
      tx.abort();
      await tx.done.catch(() => undefined);
      return { ok: false, reason: 'already_checked_in', existingAttendanceId: cached.attendance_id };
    }
  }

  await outbox.add(row);
  await tx.done;
  return { ok: true, event: row };
}
