import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { accepted, enablePolicy, fakeTransport, freshIndexedDb, noLock, seedMembers } from './helpers';
import {
  accessPointLabel,
  indicatorFor,
  itemState,
  manualCheckinPath,
  permissionGate,
  pillFor,
  recordingPath,
  revalidateAttendancePermission,
  searchCachedMemberOptions,
  submitAttendance,
  toMemberOption,
  unacknowledgedRejections,
  type SubmitDeps,
} from '@/lib/offline/manual-checkin';
import { countOutbox, getOutboxRow, listOutbox } from '@/lib/offline/db';
import { openOfflineSession, type OfflineSession } from '@/lib/offline/session';
import { DEFAULT_POLICY, type OfflinePolicy } from '@/lib/offline/types';

const GYM = 'f59a895f-430e-46d7-ae1c-01602f4ec4fd';
const M1 = '11111111-1111-4111-8111-111111111111';
const NOW = Date.now();
const nowS = Math.floor(NOW / 1000);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('manual check-in: path selection (PHASE2 "Online vs offline path")', () => {
  it('enabled → outbox, disabled / unknown → online', () => {
    expect(recordingPath({ ...DEFAULT_POLICY, enabled: true })).toBe('outbox');
    expect(recordingPath({ ...DEFAULT_POLICY, enabled: false })).toBe('online');
    expect(recordingPath(null)).toBe('online');
  });

  it('enabled: records through the outbox, kicks a sync, never calls the online endpoint', async () => {
    const fetchImpl = vi.fn();
    const record = vi.fn().mockResolvedValue({ ok: true, event: { event_id: 'e' } });
    const syncNow = vi.fn().mockResolvedValue(undefined);
    const out = await submitAttendance(
      { policy: { ...DEFAULT_POLICY, enabled: true }, record, syncNow, fetchImpl },
      { member_id: 'm1', attendance_method: 'manual', branch_id: 'b1', sessionName: 'Yoga', branchName: 'Main' },
    );
    expect(out).toMatchObject({ path: 'outbox', result: { ok: true } });
    expect(record).toHaveBeenCalledWith({ member_id: 'm1', attendance_method: 'manual', branch_id: 'b1' });
    expect(syncNow).toHaveBeenCalledTimes(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('enabled: a local refusal is returned and no sync is kicked', async () => {
    const syncNow = vi.fn();
    const out = await submitAttendance(
      { policy: { ...DEFAULT_POLICY, enabled: true }, record: async () => ({ ok: false, reason: 'double_tap' }), syncNow },
      { member_id: 'm1', attendance_method: 'manual' },
    );
    expect(out).toEqual({ path: 'outbox', result: { ok: false, reason: 'double_tap' } });
    expect(syncNow).not.toHaveBeenCalled();
  });

  it('disabled: calls the existing POST /api/attendance exactly like the manual modal; outbox untouched', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ id: 'att-1' }));
    const record = vi.fn();
    const at = new Date('2026-11-26T08:00:00Z');
    const out = await submitAttendance(
      { policy: DEFAULT_POLICY, record, syncNow: vi.fn(), fetchImpl, now: () => at },
      { member_id: 'm1', attendance_method: 'manual', branch_id: 'b1', class_session_id: 'cs1', sessionName: 'Yoga', branchName: 'Main' },
    );
    expect(out).toEqual({ path: 'online', ok: true, attendanceId: 'att-1' });
    expect(record).not.toHaveBeenCalled();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/attendance');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      memberId: 'm1', checkInAt: at.toISOString(), accessPoint: 'Yoga', branchId: 'b1', classSessionId: 'cs1', specialistName: null,
      method: 'manual',
    });
  });

  it('disabled: server error / network failure are surfaced, nothing stored', async () => {
    const deps: SubmitDeps = { policy: DEFAULT_POLICY, record: vi.fn(), syncNow: vi.fn(), fetchImpl: vi.fn().mockResolvedValue(json({ error: 'Membership expired' }, 422)) };
    expect(await submitAttendance(deps, { member_id: 'm1', attendance_method: 'manual' })).toEqual({
      path: 'online', ok: false, status: 422, body: { error: 'Membership expired' },
    });
    deps.fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await submitAttendance(deps, { member_id: 'm1', attendance_method: 'manual' })).toMatchObject({ path: 'online', ok: false, status: 0 });
  });

  it('access point label mirrors the server: class name, else branch, else "Gym Access"', () => {
    expect(accessPointLabel('Yoga', 'Main')).toBe('Yoga');
    expect(accessPointLabel(null, 'Main')).toBe('Main');
    expect(accessPointLabel(null, null)).toBe('Gym Access');
  });
});

describe('manual check-in: permission snapshot gate', () => {
  const H = 3_600_000;
  it('ok / stale / denied / unknown', () => {
    expect(permissionGate({ attendance: true, checked_at: 0 }, 1 * H, 24 * H)).toBe('ok');
    expect(permissionGate({ attendance: true, checked_at: 0 }, 25 * H, 24 * H)).toBe('stale');
    expect(permissionGate({ attendance: false, checked_at: 0 }, 1, 24 * H)).toBe('denied');
    expect(permissionGate(undefined, 1, 24 * H)).toBe('unknown');
  });

  it('online re-validation: 200 allowed, 403 denied, outage unknown', async () => {
    expect(await revalidateAttendancePermission(vi.fn().mockResolvedValue(json({ logs: [] })))).toBe('allowed');
    expect(await revalidateAttendancePermission(vi.fn().mockResolvedValue(json({}, 403)))).toBe('denied');
    expect(await revalidateAttendancePermission(vi.fn().mockResolvedValue(json({}, 503)))).toBe('unknown');
    expect(await revalidateAttendancePermission(vi.fn().mockRejectedValue(new Error('x')))).toBe('unknown');
  });

  it('expired cookie during the re-check → auth_required (Login required), not "denied"', async () => {
    expect(await revalidateAttendancePermission(vi.fn().mockResolvedValue(json({ error: 'Unauthorized' }, 401)))).toBe('auth_required');
    expect(await revalidateAttendancePermission(vi.fn().mockResolvedValue(new Response(null, { status: 307, headers: { location: '/login' } })))).toBe('auth_required');
  });
});

describe('manual check-in: indicator + item states', () => {
  it('maps engine state to the contract indicator, pauses first', () => {
    expect(indicatorFor({ status: 'online', paused: null })).toBe('online');
    expect(indicatorFor({ status: 'pending', paused: null })).toBe('pending');
    expect(indicatorFor({ status: 'expired', paused: null })).toBe('expired');
    expect(indicatorFor({ status: 'offline', paused: null })).toBe('offline');
    expect(indicatorFor({ status: 'syncing', paused: null })).toBe('syncing');
    expect(indicatorFor({ status: 'failed', paused: 'auth_required' })).toBe('authRequired');
    expect(indicatorFor({ status: 'failed', paused: 'device_revoked' })).toBe('deviceBlocked');
    expect(indicatorFor({ status: 'failed', paused: 'device_mismatch' })).toBe('deviceBlocked');
    expect(indicatorFor({ status: 'failed', paused: 'forbidden' })).toBe('failed');
  });

  it('a local item is never "synced" unless the server said so', () => {
    expect(itemState({ sync_status: 'pending' })).toBe('waiting');
    expect(itemState({ sync_status: 'syncing' })).toBe('waiting');
    expect(itemState({ sync_status: 'synced' })).toBe('synced');
    expect(itemState({ sync_status: 'rejected' })).toBe('rejected');
  });
});

describe('manual check-in: path on the Attendance page (Amendment 4)', () => {
  const on = { ...DEFAULT_POLICY, enabled: true };
  it('online + policy off → legacy endpoint; policy on or offline → outbox', () => {
    expect(manualCheckinPath('online', DEFAULT_POLICY)).toBe('legacy');
    expect(manualCheckinPath('online', on)).toBe('outbox');
    expect(manualCheckinPath('offline', DEFAULT_POLICY)).toBe('outbox');
    expect(manualCheckinPath('offline', on)).toBe('outbox');
    expect(manualCheckinPath('reconnecting', on)).toBe('outbox');
  });

  it('status pill: connectivity first, pending count, syncing / login required', () => {
    const eng = (p: number, extra: object = {}) => ({ running: false, paused: null, counts: { pending: p, syncing: 0, synced: 0, rejected: 0 }, ...extra });
    expect(pillFor('online', null)).toEqual({ key: 'online', pending: 0 });
    expect(pillFor('offline', eng(2))).toEqual({ key: 'offline', pending: 2 });
    expect(pillFor('reconnecting', eng(1))).toEqual({ key: 'reconnecting', pending: 1 });
    expect(pillFor('online', eng(1, { running: true }))).toEqual({ key: 'syncing', pending: 1 });
    expect(pillFor('online', eng(1, { paused: 'auth_required' }))).toEqual({ key: 'loginRequired', pending: 1 });
  });

  it('rejection notices skip dismissed rows', () => {
    const r = (id: string, status: 'rejected' | 'synced') => ({ event_id: id, sync_status: status }) as never;
    expect(unacknowledgedRejections([r('a', 'rejected'), r('b', 'rejected'), r('c', 'synced')], ['b']).map((x: { event_id: string }) => x.event_id)).toEqual(['a']);
  });
});

describe('manual check-in: offline path end to end (cached search → outbox → sync on reconnect)', () => {
  let session: OfflineSession;
  let online = false;
  beforeEach(async () => {
    freshIndexedDb();
    online = false;
    const t = fakeTransport((req) => ({
      type: 'ok',
      response: { server_time: new Date().toISOString(), results: req.events.map((e) => accepted(e.event_id)) },
    }));
    session = await openOfflineSession(
      { userId: 'staff-1', gymId: 'gym-1', role: 'staff' },
      { transport: t, lock: noLock, broadcast: false, isOnline: () => online },
    );
    await enablePolicy(session.db);
    await seedMembers(session.db, ['m1', 'm2']);
  });
  afterEach(() => session.close());

  it('searches the cached member list in the modal shape', async () => {
    const res = await searchCachedMemberOptions(session.db, 'member m1');
    expect(res).toEqual([{ id: 'm1', member_number: '1', full_name: 'Member m1', plan_type: null }]);
    expect(toMemberOption({ gym_member_id: 'x', member_number: 7, full_name: null, phone_last4: null, photo_url: null, status: 'active', name_lc: '' })).toMatchObject({ member_number: '7', full_name: null });
  });

  it('offline: records a pending gym-entry manual event; reconnect syncs it', async () => {
    const r = await session.record({ member_id: 'm1', attendance_method: 'manual', branch_id: 'b1', class_session_id: null });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.event).toMatchObject({ kind: 'attendance', attendance_method: 'manual', class_session_id: null, branch_id: 'b1', sync_status: 'pending' });
    // still offline: nothing is sent
    expect(await session.engine.syncNow()).toMatchObject({ ran: false, skipped: 'offline' });
    expect(await countOutbox(session.db)).toMatchObject({ pending: 1 });
    // back online → synced
    online = true;
    await session.engine.syncNow({ ignoreBackoff: true });
    expect(await getOutboxRow(session.db, r.event.event_id)).toMatchObject({ sync_status: 'synced', official_id: `att-${r.event.event_id}` });
  });

  it('offline with the gym policy off: refused (offline_disabled), nothing stored', async () => {
    await enablePolicy(session.db, { enabled: false });
    expect(await session.record({ member_id: 'm1', attendance_method: 'manual' })).toEqual({ ok: false, reason: 'offline_disabled' });
    expect(await listOutbox(session.db)).toHaveLength(0);
  });
});
