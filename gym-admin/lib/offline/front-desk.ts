/**
 * Offline attendance — front-desk flows (dashboard, Phase 2). Framework-free so
 * the React screen stays thin and the logic is unit-testable.
 *
 * PHASE2-CONTRACT "Online vs offline path":
 *  - policy.enabled → every record goes through the outbox and is synced
 *    immediately when online (one code path; the online endpoint is NOT called);
 *  - policy disabled → the existing online `POST /api/attendance` (same body as
 *    the manual check-in modal), and offline recording is unavailable.
 */
import {
  getMemberMemberships,
  getMeta,
  getCachedMember,
  type OfflineDB,
} from './db';
import { verifyMemberPass, type Ed25519Verifier, type PassFailure, type MemberPass } from './member-pass';
import type { RecordAttendanceInput, RecordResult } from './recorder';
import { estimateServerNow, systemTime, type TimeSource } from './server-clock';
import {
  DEFAULT_POLICY,
  type CachedMember,
  type CachedMembership,
  type OfflinePolicy,
  type OutboxRow,
  type SyncEngineState,
} from './types';

export type RecordingPath = 'outbox' | 'online';

export function recordingPath(policy: OfflinePolicy | null | undefined): RecordingPath {
  return policy?.enabled ? 'outbox' : 'online';
}

// ── permission snapshot gate ────────────────────────────────────────────────

export type PermissionGate = 'ok' | 'denied' | 'stale' | 'unknown';

/**
 * The server guard decided on page load; the tab may stay open (and offline)
 * for a long time. Recording is allowed only while the cached snapshot is
 * younger than `maxAgeMs`; when stale the UI re-validates online
 * (`revalidateAttendancePermission`) or blocks recording while offline.
 */
export function permissionGate(
  snapshot: { attendance: boolean; checked_at: number } | null | undefined,
  nowMs: number,
  maxAgeMs: number,
): PermissionGate {
  if (!snapshot) return 'unknown';
  if (!snapshot.attendance) return 'denied';
  return nowMs - snapshot.checked_at > maxAgeMs ? 'stale' : 'ok';
}

export type PermissionRecheck = 'allowed' | 'denied' | 'auth_required' | 'unknown';

/**
 * Online re-check through the existing attendance proxy (server guard = Laravel
 * permission). An expired/missing session (401, or the middleware's redirect to
 * /login) is `auth_required` — the UI shows "Login required", it is not a
 * permission change. Outages are `unknown` (keep the current snapshot).
 */
export async function revalidateAttendancePermission(fetchImpl: typeof fetch = fetch): Promise<PermissionRecheck> {
  try {
    const res = await fetchImpl('/api/attendance?limit=1', { cache: 'no-store', redirect: 'manual' });
    if (res.type === 'opaqueredirect' || res.redirected || (res.status >= 300 && res.status < 400) || res.status === 401) {
      return 'auth_required';
    }
    if (res.ok) return 'allowed';
    if (res.status === 403) return 'denied';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// ── recording ───────────────────────────────────────────────────────────────

/** What the online endpoint calls the access point (mirrors the sync service). */
export function accessPointLabel(sessionName: string | null | undefined, branchName: string | null | undefined): string {
  if (sessionName) return sessionName;
  return branchName || 'Gym Access';
}

export interface SubmitDeps {
  policy: OfflinePolicy;
  /** session.record — outbox path */
  record: (input: RecordAttendanceInput) => Promise<RecordResult>;
  /** engine.syncNow — kicked (not awaited) after an outbox write */
  syncNow: () => Promise<unknown>;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export type SubmitOutcome =
  | { path: 'outbox'; result: RecordResult }
  | { path: 'online'; ok: true; attendanceId: string | null }
  | { path: 'online'; ok: false; status: number; body: unknown };

export interface SubmitInput extends RecordAttendanceInput {
  /** display names used for the online endpoint's access point */
  sessionName?: string | null;
  branchName?: string | null;
}

export async function submitAttendance(deps: SubmitDeps, input: SubmitInput): Promise<SubmitOutcome> {
  const { sessionName, branchName, ...recordInput } = input;
  if (recordingPath(deps.policy) === 'outbox') {
    const result = await deps.record(recordInput);
    if (result.ok) void deps.syncNow().catch(() => undefined);
    return { path: 'outbox', result };
  }
  const f = deps.fetchImpl ?? fetch;
  try {
    const res = await f('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: recordInput.member_id,
        checkInAt: (deps.now?.() ?? new Date()).toISOString(),
        accessPoint: accessPointLabel(sessionName, branchName),
        branchId: recordInput.branch_id ?? null,
        classSessionId: recordInput.class_session_id ?? null,
        specialistName: null,
        // existing endpoint's method values (D6): a verified pass scan is 'qr'
        method: recordInput.attendance_method === 'staff_qr' ? 'qr' : 'manual',
      }),
    });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) return { path: 'online', ok: false, status: res.status, body };
    return { path: 'online', ok: true, attendanceId: (body as { id?: string } | null)?.id ?? null };
  } catch (err) {
    return { path: 'online', ok: false, status: 0, body: { error: err instanceof Error ? err.message : String(err) } };
  }
}

// ── staff QR ────────────────────────────────────────────────────────────────

export interface ScanCandidate {
  pass: MemberPass;
  raw: string;
  member: CachedMember;
  memberships: CachedMembership[];
  /** snapshot as_of: the membership summary is "as of" this time, never live */
  asOf: string | null;
}

export type ScanOutcome = { ok: true; candidate: ScanCandidate } | { ok: false; code: PassFailure };

/** Steps 1–6 against the cached pass keys + member cache; the UI then asks staff to confirm. */
export async function scanMemberPass(
  db: OfflineDB,
  gymId: string,
  raw: string,
  opts: { time?: TimeSource; verifier?: Ed25519Verifier } = {},
): Promise<ScanOutcome> {
  const time = opts.time ?? systemTime;
  const [keys, policy, asOf, est] = await Promise.all([
    getMeta(db, 'pass_keys'),
    getMeta(db, 'policy'),
    getMeta(db, 'as_of'),
    estimateServerNow(db, time),
  ]);
  const v = await verifyMemberPass(raw, {
    gymId,
    passKeys: keys ?? [],
    serverNowMs: est.serverNowMs ?? time.wallNow(),
    futureSkewSeconds: (policy ?? DEFAULT_POLICY).future_skew_seconds,
    findMember: (id) => getCachedMember(db, id),
    verifier: opts.verifier,
  });
  if (!v.ok) return { ok: false, code: v.code };
  const memberships = await getMemberMemberships(db, v.member.gym_member_id);
  return { ok: true, candidate: { pass: v.pass, raw, member: v.member, memberships, asOf: asOf ?? null } };
}

/** Staff tapped "Confirm": record a staff_qr event carrying qr.raw (or the online call when disabled). */
export function confirmScan(
  deps: SubmitDeps,
  candidate: ScanCandidate,
  extra: { branch_id?: string | null; branchName?: string | null; class_session_id?: string | null; sessionName?: string | null } = {},
): Promise<SubmitOutcome> {
  return submitAttendance(deps, {
    member_id: candidate.member.gym_member_id,
    attendance_method: 'staff_qr',
    qr: { raw: candidate.raw },
    branch_id: extra.branch_id ?? null,
    class_session_id: extra.class_session_id ?? null,
    branchName: extra.branchName ?? null,
    sessionName: extra.sessionName ?? null,
  });
}

// ── per-item state ──────────────────────────────────────────────────────────

export type ItemState = 'waiting' | 'synced' | 'rejected';

/** Never "confirmed" unless the server said so (UI requirement). */
export function itemState(row: Pick<OutboxRow, 'sync_status'>): ItemState {
  if (row.sync_status === 'synced') return 'synced';
  if (row.sync_status === 'rejected') return 'rejected';
  return 'waiting';
}

/** Summary line for a member's cached buckets (UI decides wording). */
export function activeBuckets(memberships: CachedMembership[]): CachedMembership[] {
  return memberships.filter((b) => b.status === 'active');
}

// ── connection / sync indicator ─────────────────────────────────────────────

export type IndicatorKey =
  | 'online'
  | 'offline'
  | 'syncing'
  | 'pending'
  | 'failed'
  | 'expired'
  | 'authRequired'
  | 'deviceBlocked';

/** PHASE2-CONTRACT indicator states, from the engine state. Pauses win. */
export function indicatorFor(state: Pick<SyncEngineState, 'status' | 'paused'>): IndicatorKey {
  if (state.paused === 'auth_required') return 'authRequired';
  if (state.paused === 'device_revoked' || state.paused === 'device_mismatch') return 'deviceBlocked';
  switch (state.status) {
    case 'syncing':
      return 'syncing';
    case 'offline':
      return 'offline';
    case 'failed':
      return 'failed';
    case 'expired':
      return 'expired';
    case 'pending':
      return 'pending';
    default:
      return 'online';
  }
}
