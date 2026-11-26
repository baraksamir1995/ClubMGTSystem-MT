// @vitest-environment node
/**
 * LIVE cross-stack test: the dashboard offline engine (lib/offline/*) against
 * a real clby-api. Skipped unless OFFLINE_LIVE_API is set, e.g.
 *
 *   OFFLINE_LIVE_API=http://localhost:8082/api OFFLINE_LIVE_TOKEN='<admin bearer>' \
 *   OFFLINE_LIVE_TOKEN_OTHER='<another user bearer>' OFFLINE_LIVE_PSQL='clby_offline' \
 *   npx vitest run tests/integration/offline-live.test.ts
 *
 * The API must run with ATTENDANCE_OFFLINE_ENABLED=true. Writes real
 * attendance_logs rows (tagged with source_event_id).
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { execFileSync } from 'node:child_process';
import { describe, expect, it, beforeEach } from 'vitest';
import { runBootstrap, createFetchBootstrapper } from '@/lib/offline/bootstrap';
import { listOutbox, openOfflineDb, putOutboxRow, recoverSyncingRows, type OfflineDB } from '@/lib/offline/db';
import { recordAttendance } from '@/lib/offline/recorder';
import { createFetchTransport, createLeaseLock, createSyncEngine, type SyncTransport } from '@/lib/offline/sync-engine';

const API = process.env.OFFLINE_LIVE_API;
const TOKEN = process.env.OFFLINE_LIVE_TOKEN ?? '';
const OTHER = process.env.OFFLINE_LIVE_TOKEN_OTHER ?? '';
const PSQL_DB = process.env.OFFLINE_LIVE_PSQL ?? 'clby_offline';

function sql(q: string): string {
  return execFileSync('psql', ['-h', 'localhost', '-U', 'rtg', '-d', PSQL_DB, '-Atc', q]).toString().trim();
}
function authFetch(token: string): typeof fetch {
  return (input, init = {}) =>
    fetch(input, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } });
}
async function me(token: string) {
  const r = await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  const j = (await r.json()) as { id: string; gym_id: string; role: string };
  return j;
}
function transportFor(token: string): SyncTransport {
  return createFetchTransport({ endpoint: `${API}/attendance/sync`, fetchImpl: authFetch(token) });
}
function engineFor(db: OfflineDB, deviceId: string, transport: SyncTransport) {
  return createSyncEngine({ db, deviceId, transport, lock: createLeaseLock(db), broadcast: false, isOnline: () => true });
}
async function bootstrap(db: OfflineDB, gymId: string, deviceId: string, token = TOKEN) {
  return runBootstrap(db, {
    gymId,
    fetcher: createFetchBootstrapper(deviceId, { endpoint: `${API}/attendance/offline/bootstrap`, fetchImpl: authFetch(token) }),
    limit: 2, // force paging
  });
}
function rowsFor(eventIds: string[]): Record<string, number> {
  if (eventIds.length === 0) return {};
  const list = eventIds.map((e) => `'${e}'`).join(',');
  const out = sql(`select source_event_id, count(*) from attendance_logs where source_event_id in (${list}) group by 1`);
  const m: Record<string, number> = {};
  for (const line of out.split('\n').filter(Boolean)) {
    const [id, n] = line.split('|');
    m[id] = Number(n);
  }
  return m;
}

/** members with a cached gym-capable bucket that is still in its window (server will accept a gym entry). */
async function eligible(db: OfflineDB) {
  const ms = await db.getAll('memberships');
  const ok = new Set(
    ms.filter((b) => b.plan_type !== 'sessions' && b.freeze_status !== 'frozen' && (!b.end_date || Date.parse(b.end_date) > Date.now()))
      .map((b) => b.gym_member_id),
  );
  return (await db.getAll('members')).filter((m) => ok.has(m.gym_member_id));
}

describe.skipIf(!API)('dashboard offline engine → live clby-api', () => {
  let ident: { id: string; gym_id: string; role: string };
  let db: OfflineDB;
  let deviceId: string;

  beforeEach(async () => {
    (globalThis as { indexedDB: unknown }).indexedDB = new IDBFactory();
    ident = await me(TOKEN);
    db = await openOfflineDb(ident.gym_id, ident.id);
    deviceId = crypto.randomUUID();
  });

  it('bootstrap → record (gym + class) → sync → exactly one row each → resend replays same ids', async () => {
    const b = await bootstrap(db, ident.gym_id, deviceId);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    const dbMembers = Number(sql(`select count(*) from gym_members where gym_id='${ident.gym_id}' and deleted_at is null`));
    expect(b.members).toBe(dbMembers);
    expect(b.pages).toBeGreaterThan(1);

    const members = await db.getAll('members');
    const sessions = await db.getAll('class_sessions');
    const recent = await db.getAll('recent_attendance');
    const ctx = { gymId: ident.gym_id, userId: ident.id, actorType: 'gym_admin' as const, deviceId };
    const events: string[] = [];
    for (const m of members) {
      const r = await recordAttendance(db, ctx, { member_id: m.gym_member_id, attendance_method: 'manual' });
      expect(r.ok).toBe(true);
      if (r.ok) events.push(r.event.event_id);
    }
    // class check-in for a member/session pair not already in the cached recent attendance
    let classEvent: string | null = null;
    outer: for (const s of sessions) {
      for (const m of members) {
        if (recent.some((a) => a.gym_member_id === m.gym_member_id && a.class_session_id === s.id)) continue;
        const r = await recordAttendance(db, { ...ctx, doubleTapWindowMs: 0 }, {
          member_id: m.gym_member_id,
          attendance_method: 'staff_qr',
          qr: { raw: `member:${m.gym_member_id}` },
          class_session_id: s.id,
        });
        if (r.ok) {
          classEvent = r.event.event_id;
          events.push(classEvent);
          break outer;
        }
      }
    }
    expect(classEvent).not.toBeNull();

    const engine = engineFor(db, deviceId, transportFor(TOKEN));
    const sum = await engine.syncNow();
    const rows = await listOutbox(db);
    console.log('sync summary', sum, rows.map((r) => [r.sync_status, r.result_status, r.result_code, r.official_id, r.flags]));
    // every event resolved (synced or rejected by a business rule), none left pending
    expect(rows.every((r) => r.sync_status === 'synced' || r.sync_status === 'rejected')).toBe(true);
    const synced = rows.filter((r) => r.sync_status === 'synced');
    expect(synced.length).toBeGreaterThan(0);
    for (const r of synced) expect(r.official_id).toMatch(/^[0-9a-f-]{36}$/);
    const counts = rowsFor(synced.filter((r) => r.result_code === 'created').map((r) => r.event_id));
    for (const r of synced.filter((x) => x.result_code === 'created')) expect(counts[r.event_id]).toBe(1);
    // official row id == returned id
    for (const r of synced.filter((x) => x.result_code === 'created')) {
      expect(sql(`select id from attendance_logs where source_event_id='${r.event_id}'`)).toBe(r.official_id);
    }

    // client "lost" the response: put rows back to pending and resend
    for (const r of rows) await putOutboxRow(db, { ...r, sync_status: 'pending', next_attempt_at: null });
    await engine.syncNow({ force: true });
    const again = await listOutbox(db);
    for (const r of again) {
      const prev = rows.find((x) => x.event_id === r.event_id)!;
      expect(r.sync_status).toBe(prev.sync_status);
      expect(r.official_id).toBe(prev.official_id);
      if (prev.result_code === 'created') expect(r.result_code).toBe('event_replayed');
    }
    const counts2 = rowsFor(synced.filter((r) => r.result_code === 'created').map((r) => r.event_id));
    expect(counts2).toEqual(counts);
  }, 60_000);

  it('response lost after server commit (transport throws after send) → pending, retry same id, one row', async () => {
    await bootstrap(db, ident.gym_id, deviceId);
    const [m] = await eligible(db);
    const ctx = { gymId: ident.gym_id, userId: ident.id, actorType: 'gym_admin' as const, deviceId };
    const r = await recordAttendance(db, ctx, { member_id: m.gym_member_id, attendance_method: 'manual' });
    if (!r.ok) throw new Error('record failed');
    const real = transportFor(TOKEN);
    const lossy: SyncTransport = {
      async send(req, opts) {
        await real.send(req, opts); // server commits
        return { type: 'timeout' }; // …but the client never sees it
      },
    };
    await engineFor(db, deviceId, lossy).syncNow();
    let row = (await listOutbox(db))[0];
    expect(row.sync_status).toBe('pending');
    expect(rowsFor([row.event_id])[row.event_id]).toBe(1);
    // app "killed" mid-sync: row left in syncing
    await putOutboxRow(db, { ...row, sync_status: 'syncing' });
    expect(await recoverSyncingRows(db)).toBe(1);
    await engineFor(db, deviceId, real).syncNow({ force: true });
    row = (await listOutbox(db))[0];
    expect(row.sync_status).toBe('synced');
    expect(row.result_code).toBe('event_replayed');
    expect(rowsFor([row.event_id])[row.event_id]).toBe(1);
  }, 60_000);

  it('invalid token → paused auth_required, events untouched', async () => {
    await bootstrap(db, ident.gym_id, deviceId);
    const [m] = await db.getAll('members');
    const ctx = { gymId: ident.gym_id, userId: ident.id, actorType: 'gym_admin' as const, deviceId };
    const r = await recordAttendance(db, ctx, { member_id: m.gym_member_id, attendance_method: 'manual' });
    if (!r.ok) throw new Error('record failed');
    const eng = engineFor(db, deviceId, transportFor('1|definitely-not-valid'));
    const s = await eng.syncNow();
    expect(s.stoppedBy).toBe('auth_required');
    const row = (await listOutbox(db))[0];
    expect(row.sync_status).toBe('pending');
    expect(row.sync_attempts).toBe(0);
    expect(rowsFor([row.event_id])[row.event_id]).toBeUndefined();
  }, 60_000);

  it.skipIf(!OTHER)('device_id already bound to another user → 403 → paused, events kept (shared reception browser)', async () => {
    await bootstrap(db, ident.gym_id, deviceId);
    // another account syncs first from this "browser" (same device id)
    const other = await fetch(`${API}/attendance/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${OTHER}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, app: 'admin', events: [{ event_id: crypto.randomUUID(), kind: 'attendance' }] }),
    });
    expect(other.status).toBe(200);
    const [m] = await db.getAll('members');
    const ctx = { gymId: ident.gym_id, userId: ident.id, actorType: 'gym_admin' as const, deviceId };
    const r = await recordAttendance(db, ctx, { member_id: m.gym_member_id, attendance_method: 'manual' });
    if (!r.ok) throw new Error('record failed');
    const eng = engineFor(db, deviceId, transportFor(TOKEN));
    const s = await eng.syncNow();
    console.log('shared-device run', s, eng.getState().paused);
    expect(s.stoppedBy).toBe('device_revoked');
    const row = (await listOutbox(db))[0];
    expect(row.sync_status).toBe('pending'); // kept, but can never sync from this browser
  }, 60_000);

  it('500 events drain in batches ≤ 50, no loss, one row each', async () => {
    await bootstrap(db, ident.gym_id, deviceId);
    const members = await eligible(db);
    let t = Date.now() - 60 * 60_000;
    const ctx = {
      gymId: ident.gym_id, userId: ident.id, actorType: 'gym_admin' as const, deviceId,
      doubleTapWindowMs: 0, now: () => new Date((t += 1000)),
    };
    for (let i = 0; i < 500; i++) {
      const r = await recordAttendance(db, ctx, { member_id: members[i % members.length].gym_member_id, attendance_method: 'manual' });
      if (!r.ok) throw new Error(`record ${i} failed: ${r.reason}`);
    }
    const real = transportFor(TOKEN);
    const sizes: number[] = [];
    const spy: SyncTransport = { send: (req, o) => (sizes.push(req.events.length), real.send(req, o)) };
    const s = await engineFor(db, deviceId, spy).syncNow();
    const rows = await listOutbox(db);
    console.log('large queue', s, 'batch sizes', sizes);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(50);
    expect(rows.filter((r) => r.sync_status === 'synced').length).toBe(500);
    const counts = rowsFor(rows.map((r) => r.event_id));
    expect(Object.keys(counts).length).toBe(500);
    expect(Object.values(counts).every((n) => n === 1)).toBe(true);
  }, 180_000);
});
