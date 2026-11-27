/**
 * Offline attendance — manual check-in on the Attendance & Access page
 * (PHASE3-CONTRACT Amendments 3 + 4). Framework-free so it is unit-testable.
 *
 * Path selection (PHASE2-CONTRACT "Online vs offline path", Amendment 4):
 *  - online + policy disabled → the existing `POST /api/attendance` (unchanged UI);
 *  - policy enabled (online or offline) → the outbox, synced immediately when online;
 *  - offline + policy disabled → refused by the recorder (`offline_disabled`).
 */
import { searchMembers, type OfflineDB } from './db';
import type { RecordAttendanceInput, RecordResult } from './recorder';
import type { CachedMember, OfflinePolicy, OutboxRow, SyncEngineState } from './types';

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

// ── per-item state ──────────────────────────────────────────────────────────

export type ItemState = 'waiting' | 'synced' | 'rejected';

/** Never "confirmed" unless the server said so (UI requirement). */
export function itemState(row: Pick<OutboxRow, 'sync_status'>): ItemState {
  if (row.sync_status === 'synced') return 'synced';
  if (row.sync_status === 'rejected') return 'rejected';
  return 'waiting';
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

// ── page-level helpers (Amendment 3/4) ──────────────────────────────────────

export type Connectivity = 'online' | 'offline' | 'reconnecting';

/** Which path the Manual Check-in modal takes right now. */
export type ManualPath = 'legacy' | 'outbox';

export function manualCheckinPath(connectivity: Connectivity, policy: OfflinePolicy | null | undefined): ManualPath {
  // online + policy off: exactly today's modal/endpoint; otherwise the outbox
  // (offline + policy off is refused by the recorder with `offline_disabled`)
  return connectivity === 'online' && !policy?.enabled ? 'legacy' : 'outbox';
}

/** The modal's member row shape, from the cached member list. */
export interface CachedMemberOption {
  id: string;
  member_number: string;
  full_name: string | null;
  plan_type: string | null;
}

export function toMemberOption(m: CachedMember): CachedMemberOption {
  return { id: m.gym_member_id, member_number: String(m.member_number ?? ''), full_name: m.full_name, plan_type: null };
}

/** Offline member search for the existing modal (name, number, last-4 phone). */
export async function searchCachedMemberOptions(db: OfflineDB, query: string, limit = 20): Promise<CachedMemberOption[]> {
  return (await searchMembers(db, query, limit)).map(toMemberOption);
}

export type PillKey = 'online' | 'offline' | 'reconnecting' | 'syncing' | 'loginRequired';

/** Status pill: connectivity first; "syncing"/"login required" refine the online state. */
export function pillFor(
  connectivity: Connectivity,
  engine: Pick<SyncEngineState, 'running' | 'paused' | 'counts'> | null,
): { key: PillKey; pending: number } {
  const pending = engine ? engine.counts.pending + engine.counts.syncing : 0;
  if (connectivity !== 'online') return { key: connectivity, pending };
  if (engine?.paused === 'auth_required') return { key: 'loginRequired', pending };
  if (engine?.running) return { key: 'syncing', pending };
  return { key: 'online', pending };
}

/** Rejected outbox rows the user hasn't dismissed yet. */
export function unacknowledgedRejections(rows: OutboxRow[], dismissed: string[]): OutboxRow[] {
  const d = new Set(dismissed);
  return rows.filter((r) => r.sync_status === 'rejected' && !d.has(r.event_id));
}
