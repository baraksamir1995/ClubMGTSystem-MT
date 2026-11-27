import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { accepted, enablePolicy, fakeTransport, freshIndexedDb, noLock, seedMembers } from './helpers';
import { makeKey, passKey, signPass, type TestKey } from './pass-helpers';
import {
  accessPointLabel,
  confirmScan,
  indicatorFor,
  itemState,
  permissionGate,
  recordingPath,
  revalidateAttendancePermission,
  scanMemberPass,
  submitAttendance,
  type SubmitDeps,
} from '@/lib/offline/front-desk';
import { getOutboxRow, listOutbox, setMeta } from '@/lib/offline/db';
import { recordServerTime } from '@/lib/offline/server-clock';
import { openOfflineSession, type OfflineSession } from '@/lib/offline/session';
import { DEFAULT_POLICY, type OfflinePolicy } from '@/lib/offline/types';

const GYM = 'f59a895f-430e-46d7-ae1c-01602f4ec4fd';
const M1 = '11111111-1111-4111-8111-111111111111';
const NOW = Date.now();
const nowS = Math.floor(NOW / 1000);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('front desk: path selection (PHASE2 "Online vs offline path")', () => {
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

describe('front desk: permission snapshot gate', () => {
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

describe('front desk: indicator + item states', () => {
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

describe('front desk: staff QR → confirm → record', () => {
  let session: OfflineSession;
  let key: TestKey;
  let policy: OfflinePolicy;

  beforeEach(async () => {
    freshIndexedDb();
    key = await makeKey('k1');
    const t = fakeTransport((req) => ({
      type: 'ok',
      response: { server_time: new Date().toISOString(), results: req.events.map((e) => accepted(e.event_id)) },
    }));
    session = await openOfflineSession({ userId: 'staff-1', gymId: GYM, role: 'staff' }, { transport: t, lock: noLock, broadcast: false, isOnline: () => true });
    policy = await enablePolicy(session.db);
    await seedMembers(session.db, [M1]);
    await setMeta(session.db, 'pass_keys', [passKey(key)]);
    await setMeta(session.db, 'as_of', '2026-11-26T07:00:00.000Z');
    await session.db.put('memberships', {
      membership_id: 'ms1', gym_member_id: M1, plan_type: 'duration', source_type: 'subscription', status: 'active', payment_status: 'paid',
      start_date: '2026-11-01', end_date: '2026-12-01', sessions_remaining: null, sessions_total: null, freeze_status: null, allowed_branch_ids: null,
    });
  });

  const deps = (): SubmitDeps => ({ policy, record: session.record, syncNow: () => session.engine.syncNow() });

  it('valid pass → candidate with cached member, memberships and as_of; nothing recorded before confirm', async () => {
    const raw = await signPass(key, { g: GYM, m: M1, n: 1, iat: nowS - 60, exp: nowS + 86_400 });
    const res = await scanMemberPass(session.db, GYM, raw);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.candidate.member.gym_member_id).toBe(M1);
    expect(res.candidate.memberships.map((m) => m.membership_id)).toEqual(['ms1']);
    expect(res.candidate.asOf).toBe('2026-11-26T07:00:00.000Z');
    expect(await listOutbox(session.db)).toHaveLength(0);
  });

  it('confirm → one staff_qr event carrying qr.raw, then synced', async () => {
    const raw = await signPass(key, { g: GYM, m: M1, n: 1, iat: nowS - 60, exp: nowS + 86_400 });
    const res = await scanMemberPass(session.db, GYM, raw);
    if (!res.ok) throw new Error('scan failed');
    const out = await confirmScan(deps(), res.candidate, { branch_id: 'b1' });
    expect(out.path).toBe('outbox');
    if (out.path !== 'outbox' || !out.result.ok) throw new Error('record failed');
    expect(out.result.event).toMatchObject({ attendance_method: 'staff_qr', qr: { raw }, member_id: M1, branch_id: 'b1', actor_user_id: 'staff-1' });
    await vi.waitFor(async () => expect((await getOutboxRow(session.db, out.result.ok ? out.result.event.event_id : ''))?.sync_status).toBe('synced'));
  });

  it('unknown key → qr_unknown_key (UI offers "refresh offline data"); wrong gym → qr_wrong_gym', async () => {
    const other = await makeKey('k-rotated');
    expect(await scanMemberPass(session.db, GYM, await signPass(other, { g: GYM, m: M1, iat: nowS, exp: nowS + 100 }))).toEqual({
      ok: false, code: 'qr_unknown_key',
    });
    expect(await scanMemberPass(session.db, GYM, await signPass(key, { g: '99999999-9999-4999-8999-999999999999', m: M1, iat: nowS, exp: nowS + 100 }))).toEqual({
      ok: false, code: 'qr_wrong_gym',
    });
  });

  it('expiry uses the estimated server clock, not a changed device clock', async () => {
    const raw = await signPass(key, { g: GYM, m: M1, iat: nowS - 3600, exp: nowS + 600 });
    await recordServerTime(session.db, new Date(NOW).toISOString(), { wall: Date.now(), mono: 0 });
    // monotonic clock says 1 h passed on the server → expired, even though wall time didn't move
    const time = { wallNow: () => Date.now(), monoNow: () => 3_600_000 };
    expect(await scanMemberPass(session.db, GYM, raw, { time })).toEqual({ ok: false, code: 'pass_expired' });
  });

  it('disabled policy: confirm uses the online endpoint (scan still verified offline)', async () => {
    const raw = await signPass(key, { g: GYM, m: M1, iat: nowS - 60, exp: nowS + 86_400 });
    const res = await scanMemberPass(session.db, GYM, raw);
    if (!res.ok) throw new Error('scan failed');
    const fetchImpl = vi.fn().mockResolvedValue(json({ id: 'att-9' }));
    const out = await confirmScan({ ...deps(), policy: { ...policy, enabled: false }, fetchImpl }, res.candidate);
    expect(out).toEqual({ path: 'online', ok: true, attendanceId: 'att-9' });
    expect(JSON.parse(String((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body)).method).toBe('qr');
    expect(await listOutbox(session.db)).toHaveLength(0);
  });

  afterEach(() => session.close());
});
