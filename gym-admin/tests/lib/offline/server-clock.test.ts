import { describe, it, expect, beforeEach } from 'vitest';
import { accepted, enablePolicy, fakeTransport, freshIndexedDb, noLock, openTestDb, putRows, row, seedMembers, GYM, USER, DEVICE } from './helpers';
import { clearServerClockAnchor, estimateServerNow, recordServerTime, type TimeSource } from '@/lib/offline/server-clock';
import { recordAttendance, type RecorderContext } from '@/lib/offline/recorder';
import { createSyncEngine } from '@/lib/offline/sync-engine';
import { fetchOfflineStatus } from '@/lib/offline/bootstrap';
import { getMeta, listOutbox, type OfflineDB } from '@/lib/offline/db';

const SERVER_T0 = Date.parse('2026-11-26T10:00:00.000Z');
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** Wall and monotonic clocks that tests move independently. */
function fakeClocks(wall = SERVER_T0, mono = 1_000) {
  const c = {
    wall,
    mono,
    /** real time passes: both clocks advance */
    tick(ms: number) {
      c.wall += ms;
      c.mono += ms;
    },
    /** the user changes the device clock: only wall time jumps */
    setWall(ms: number) {
      c.wall = ms;
    },
    source: null as unknown as TimeSource,
  };
  c.source = { wallNow: () => c.wall, monoNow: () => c.mono };
  return c;
}

describe('server clock (CONTRACT §6.6)', () => {
  let db: OfflineDB;
  let clocks: ReturnType<typeof fakeClocks>;
  let ctx: RecorderContext;
  const record = () => recordAttendance(db, ctx, { member_id: 'm1', attendance_method: 'manual' });

  beforeEach(async () => {
    freshIndexedDb();
    db = await openTestDb();
    await enablePolicy(db); // future_skew_seconds 300, max_event_age_days 7
    await seedMembers(db, ['m1']);
    clocks = fakeClocks();
    ctx = { gymId: GYM, userId: USER, actorType: 'staff', deviceId: DEVICE, time: clocks.source, doubleTapWindowMs: 0 };
  });

  it('estimate follows the monotonic clock, not later wall-clock changes', async () => {
    await recordServerTime(db, new Date(SERVER_T0).toISOString(), { wall: clocks.wall, mono: clocks.mono });
    clocks.tick(10 * 60_000);
    clocks.setWall(clocks.wall + HOUR);
    expect(await estimateServerNow(db, clocks.source)).toEqual({ serverNowMs: SERVER_T0 + 10 * 60_000, source: 'anchor' });
    expect(await getMeta(db, 'server_clock_offset_ms')).toBe(0);
  });

  it('clock moved +1 h AFTER a correct measurement → clock_skew (device ahead)', async () => {
    await recordServerTime(db, new Date(SERVER_T0).toISOString(), { wall: clocks.wall, mono: clocks.mono });
    expect((await record()).ok).toBe(true); // in sync
    clocks.tick(60_000);
    clocks.setWall(clocks.wall + HOUR);
    const res = await record();
    expect(res).toMatchObject({ ok: false, reason: 'clock_skew' });
    if (!res.ok) expect(res.clockOffsetMs).toBe(-HOUR);
    expect(await listOutbox(db)).toHaveLength(1);
  });

  it('clock moved −8 days AFTER a correct measurement → clock_skew (device behind)', async () => {
    await recordServerTime(db, new Date(SERVER_T0).toISOString(), { wall: clocks.wall, mono: clocks.mono });
    clocks.tick(5_000);
    clocks.setWall(clocks.wall - 8 * DAY);
    expect(await record()).toMatchObject({ ok: false, reason: 'clock_skew', clockOffsetMs: 8 * DAY });
  });

  it('small changes within the server window are allowed (−6 days, +4 min)', async () => {
    await recordServerTime(db, new Date(SERVER_T0).toISOString(), { wall: clocks.wall, mono: clocks.mono });
    clocks.setWall(SERVER_T0 - 6 * DAY);
    expect((await record()).ok).toBe(true);
    clocks.setWall(SERVER_T0 + 4 * 60_000);
    expect((await record()).ok).toBe(true);
  });

  it('30 s margin: refuses at 4m45s ahead (server limit 5 min)', async () => {
    await recordServerTime(db, new Date(SERVER_T0).toISOString(), { wall: clocks.wall, mono: clocks.mono });
    clocks.setWall(SERVER_T0 + 4 * 60_000 + 45_000);
    expect(await record()).toMatchObject({ ok: false, reason: 'clock_skew' });
  });

  it('a clock already wrong at measurement time is caught too', async () => {
    clocks.setWall(SERVER_T0 + HOUR); // device 1 h fast before the measurement
    await recordServerTime(db, new Date(SERVER_T0).toISOString(), { wall: clocks.wall, mono: clocks.mono });
    expect(await getMeta(db, 'server_clock_offset_ms')).toBe(-HOUR);
    expect(await record()).toMatchObject({ ok: false, reason: 'clock_skew' });
  });

  it('a clock that is fixed by the user is accepted again (anchor wins over stale offset)', async () => {
    clocks.setWall(SERVER_T0 + HOUR);
    await recordServerTime(db, new Date(SERVER_T0).toISOString(), { wall: clocks.wall, mono: clocks.mono });
    clocks.setWall(SERVER_T0); // user corrects the clock
    expect((await record()).ok).toBe(true);
  });

  it('after a reload (no anchor) falls back to the persisted offset until re-measured', async () => {
    clocks.setWall(SERVER_T0 + HOUR);
    await recordServerTime(db, new Date(SERVER_T0).toISOString(), { wall: clocks.wall, mono: clocks.mono });
    db.close();
    db = await openTestDb(); // new instance = page reload: anchor gone
    clocks.mono = 5; // performance.now restarts
    expect((await estimateServerNow(db, clocks.source)).source).toBe('persisted_offset');
    expect(await record()).toMatchObject({ ok: false, reason: 'clock_skew' }); // still +1 h

    // documented limitation: a change between measurement and reload is only seen after re-measuring
    clearServerClockAnchor(db);
    await recordServerTime(db, new Date(SERVER_T0 + 60_000).toISOString(), { wall: clocks.wall, mono: clocks.mono });
    clocks.setWall(SERVER_T0 + 60_000);
    expect((await record()).ok).toBe(true);
  });

  it('never measured → no skew check', async () => {
    clocks.setWall(SERVER_T0 + 30 * DAY);
    expect(await estimateServerNow(db, clocks.source)).toEqual({ serverNowMs: null, source: 'none' });
    expect((await record()).ok).toBe(true);
  });

  it('the sync engine anchors from server_time with its injected clocks', async () => {
    await putRows(db, [row({ event_id: 'e1' })]);
    const t = fakeTransport((req) => ({
      type: 'ok',
      response: { server_time: new Date(SERVER_T0).toISOString(), results: req.events.map((e) => accepted(e.event_id)) },
    }));
    const engine = createSyncEngine({
      db, deviceId: DEVICE, transport: t, lock: noLock, broadcast: false, isOnline: () => true,
      now: () => clocks.wall, monoNow: () => clocks.mono,
    });
    await engine.syncNow();
    clocks.tick(1000);
    clocks.setWall(clocks.wall + 2 * HOUR);
    expect(await estimateServerNow(db, clocks.source)).toEqual({ serverNowMs: SERVER_T0 + 1000, source: 'anchor' });
    expect(await record()).toMatchObject({ ok: false, reason: 'clock_skew' });
  });

  it('the status endpoint anchors too', async () => {
    const body = { server_time: new Date(SERVER_T0).toISOString(), enabled: true, policy: (await getMeta(db, 'policy'))!, device: { registered: true, revoked: false } };
    const fetchImpl = async () => new Response(JSON.stringify(body), { status: 200 });
    await fetchOfflineStatus(db, DEVICE, { fetchImpl: fetchImpl as unknown as typeof fetch, now: () => clocks.wall, monoNow: () => clocks.mono });
    clocks.setWall(clocks.wall - 8 * DAY);
    expect(await record()).toMatchObject({ ok: false, reason: 'clock_skew' });
  });
});
