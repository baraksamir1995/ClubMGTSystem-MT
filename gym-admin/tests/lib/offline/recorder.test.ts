import { describe, it, expect, beforeEach } from 'vitest';
import { freshIndexedDb, openTestDb, enablePolicy, seedMembers, GYM, USER, DEVICE } from './helpers';
import { recordAttendance, toIsoWithOffset, type RecorderContext } from '@/lib/offline/recorder';
import { getOutboxRow, listOutbox, type OfflineDB } from '@/lib/offline/db';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('recorder', () => {
  let db: OfflineDB;
  let clock: number;
  let ctx: RecorderContext;

  beforeEach(async () => {
    freshIndexedDb();
    db = await openTestDb();
    await enablePolicy(db);
    await seedMembers(db, ['m1', 'm2']);
    clock = Date.UTC(2026, 10, 26, 8, 0, 0);
    ctx = {
      gymId: GYM,
      userId: USER,
      actorType: 'staff',
      deviceId: DEVICE,
      now: () => new Date(clock),
      timeZone: 'Africa/Cairo',
    };
  });

  it('creates a pending event with all contract + outbox fields', async () => {
    const res = await recordAttendance(db, ctx, {
      member_id: 'm1',
      attendance_method: 'manual',
      branch_id: 'b1',
      metadata: { access_point: 'gym' },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const e = res.event;
    expect(e.event_id).toMatch(UUID_V4);
    expect(e).toMatchObject({
      kind: 'attendance',
      attendance_method: 'manual',
      gym_id: GYM,
      branch_id: 'b1',
      member_id: 'm1',
      class_session_id: null,
      studio_id: null,
      service_assignment_id: null,
      device_timezone: 'Africa/Cairo',
      qr: null,
      note: null,
      metadata: { access_point: 'gym' },
      actor_user_id: USER,
      actor_type: 'staff',
      device_id: DEVICE,
      sync_status: 'pending',
      sync_attempts: 0,
      next_attempt_at: null,
      official_id: null,
      flags: [],
      recorded_at_ms: clock,
    });
    // ISO with explicit offset, and it denotes the same instant
    expect(e.device_recorded_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}[+-]\d\d:\d\d$/);
    expect(Date.parse(e.device_recorded_at)).toBe(clock);
    expect(await getOutboxRow(db, e.event_id)).toEqual(e);
  });

  it('toIsoWithOffset round-trips the instant', () => {
    const d = new Date(Date.UTC(2026, 0, 1, 23, 59, 59, 7));
    const iso = toIsoWithOffset(d);
    expect(Date.parse(iso)).toBe(d.getTime());
    expect(iso).toMatch(/[+-]\d\d:\d\d$/);
  });

  it('uses the device time zone from Intl when none is given', async () => {
    const res = await recordAttendance(db, { ...ctx, timeZone: undefined }, { member_id: 'm1', attendance_method: 'manual' });
    expect(res.ok && res.event.device_timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('anti-double-tap: same member+method within the window returns the existing event', async () => {
    const first = await recordAttendance(db, ctx, { member_id: 'm1', attendance_method: 'manual' });
    clock += 2_000;
    const second = await recordAttendance(db, ctx, { member_id: 'm1', attendance_method: 'manual' });
    expect(second.ok).toBe(false);
    if (second.ok || !first.ok) return;
    expect(second.reason).toBe('double_tap');
    expect(second.existingEvent?.event_id).toBe(first.event.event_id);
    expect(await listOutbox(db)).toHaveLength(1);
  });

  it('D1: gym entry has no business duplicate window — after the tap window a second entry is allowed', async () => {
    await recordAttendance(db, ctx, { member_id: 'm1', attendance_method: 'manual' });
    clock += 6_000;
    const again = await recordAttendance(db, ctx, { member_id: 'm1', attendance_method: 'manual' });
    expect(again.ok).toBe(true);
    clock += 60 * 60_000;
    expect((await recordAttendance(db, ctx, { member_id: 'm1', attendance_method: 'manual' })).ok).toBe(true);
    expect(await listOutbox(db)).toHaveLength(3);
  });

  it('double-tap guard is per member', async () => {
    await recordAttendance(db, ctx, { member_id: 'm1', attendance_method: 'manual' });
    expect((await recordAttendance(db, ctx, { member_id: 'm2', attendance_method: 'manual' })).ok).toBe(true);
  });

  it('class rule: one per (member, class_session) against pending events', async () => {
    const a = await recordAttendance(db, ctx, { member_id: 'm1', attendance_method: 'manual', class_session_id: 'cs1' });
    expect(a.ok).toBe(true);
    clock += 10 * 60_000;
    const b = await recordAttendance(db, ctx, { member_id: 'm1', attendance_method: 'staff_qr', class_session_id: 'cs1', qr: { raw: 'x' } });
    expect(b).toMatchObject({ ok: false, reason: 'already_checked_in' });
    // a different session is fine
    expect((await recordAttendance(db, ctx, { member_id: 'm1', attendance_method: 'manual', class_session_id: 'cs2' })).ok).toBe(true);
  });

  it('class rule: checks cached recent_attendance from the server', async () => {
    await db.put('recent_attendance', {
      attendance_id: 'att-9',
      gym_member_id: 'm1',
      class_session_id: 'cs1',
      branch_id: null,
      check_in_at: '2026-11-26T07:00:00Z',
    });
    const res = await recordAttendance(db, ctx, { member_id: 'm1', attendance_method: 'manual', class_session_id: 'cs1' });
    expect(res).toMatchObject({ ok: false, reason: 'already_checked_in', existingAttendanceId: 'att-9' });
  });

  it('class rule ignores rejected events', async () => {
    const a = await recordAttendance(db, ctx, { member_id: 'm1', attendance_method: 'manual', class_session_id: 'cs1' });
    if (!a.ok) throw new Error('expected ok');
    await db.put('outbox', { ...a.event, sync_status: 'rejected' });
    clock += 60_000;
    expect((await recordAttendance(db, ctx, { member_id: 'm1', attendance_method: 'manual', class_session_id: 'cs1' })).ok).toBe(true);
  });

  it('refuses when offline attendance is disabled by policy', async () => {
    await enablePolicy(db, { enabled: false });
    expect(await recordAttendance(db, ctx, { member_id: 'm1', attendance_method: 'manual' })).toEqual({
      ok: false,
      reason: 'offline_disabled',
    });
  });

  it('refuses a method the policy does not allow', async () => {
    await enablePolicy(db, { allow_staff_qr_offline: false });
    const res = await recordAttendance(db, ctx, { member_id: 'm1', attendance_method: 'staff_qr', qr: { raw: 'x' } });
    expect(res).toEqual({ ok: false, reason: 'method_not_allowed' });
  });

  it('refuses members that are not in the cache', async () => {
    expect(await recordAttendance(db, ctx, { member_id: 'ghost', attendance_method: 'manual' })).toMatchObject({
      ok: false,
      reason: 'member_not_cached',
    });
  });

  it('validates staff_qr needs qr.raw and metadata ≤ 4 KB', async () => {
    expect(await recordAttendance(db, ctx, { member_id: 'm1', attendance_method: 'staff_qr' })).toMatchObject({
      reason: 'invalid_input',
    });
    expect(
      await recordAttendance(db, ctx, { member_id: 'm1', attendance_method: 'manual', metadata: { big: 'x'.repeat(5000) } }),
    ).toMatchObject({ reason: 'invalid_input' });
  });

  it('two concurrent taps produce exactly one event', async () => {
    const [a, b] = await Promise.all([
      recordAttendance(db, ctx, { member_id: 'm1', attendance_method: 'manual' }),
      recordAttendance(db, ctx, { member_id: 'm1', attendance_method: 'manual' }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(await listOutbox(db)).toHaveLength(1);
  });
});
