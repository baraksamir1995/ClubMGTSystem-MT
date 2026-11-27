import { describe, it, expect, beforeEach, vi } from 'vitest';
import { accepted, enablePolicy, fakeTransport, freshIndexedDb, noLock, seedMembers } from './helpers';
import {
  actorTypeForRole,
  fetchIdentity,
  getOfflineSession,
  logoutOffline,
  openOfflineSession,
} from '@/lib/offline/session';
import { countOutbox, getMeta, listOutbox, openOfflineDb } from '@/lib/offline/db';
import type { TransportOutcome } from '@/lib/offline/sync-engine';

const alice = { userId: 'alice', gymId: 'g1', role: 'staff' };
const bob = { userId: 'bob', gymId: 'g1', role: 'gym_admin' };
const base = { lock: noLock, broadcast: false, isOnline: () => true };

describe('offline session', () => {
  beforeEach(() => freshIndexedDb());

  it('maps roles to actor types; members cannot open an admin session', async () => {
    expect(actorTypeForRole('gym_admin')).toBe('gym_admin');
    expect(actorTypeForRole('member')).toBeNull();
    await expect(openOfflineSession({ userId: 'm', gymId: 'g1', role: 'member' }, base)).rejects.toThrow();
  });

  it('records into the user database with identity + device metadata', async () => {
    const s = await openOfflineSession(alice, { ...base, transport: fakeTransport() });
    await enablePolicy(s.db);
    await seedMembers(s.db, ['m1']);
    const res = await s.record({ member_id: 'm1', attendance_method: 'manual' });
    expect(res.ok && res.event).toMatchObject({ actor_user_id: 'alice', actor_type: 'staff', gym_id: 'g1', device_id: s.deviceId });
    expect(await getMeta(s.db, 'identity')).toEqual({ user_id: 'alice', gym_id: 'g1', role: 'staff' });
    s.close();
  });

  it('logout: syncs, wipes cached data, keeps unsynced events for the same user only', async () => {
    const offline = fakeTransport((): TransportOutcome => ({ type: 'network', error: 'offline' }));
    const s = await openOfflineSession(alice, { ...base, transport: offline });
    await enablePolicy(s.db);
    await seedMembers(s.db, ['m1', 'm2']);
    await s.record({ member_id: 'm1', attendance_method: 'manual' });

    const report = await logoutOffline(s);
    expect(report).toMatchObject({ syncAttempted: true, syncTimedOut: false, remaining: { pending: 1 } });
    expect(offline.requests).toHaveLength(1);

    // another user on the same browser sees nothing
    const b = await openOfflineSession(bob, base);
    expect(await listOutbox(b.db)).toEqual([]);
    b.close();

    // alice logs back in: cache gone, event still there and syncs with her session
    const ok = fakeTransport((req) => ({ type: 'ok', response: { server_time: '', results: req.events.map((e) => accepted(e.event_id)) } }));
    const again = await openOfflineSession(alice, { ...base, transport: ok });
    expect(await again.db.count('members')).toBe(0);
    expect(await countOutbox(again.db)).toMatchObject({ pending: 1 });
    await again.engine.syncNow({ force: true });
    expect(await countOutbox(again.db)).toMatchObject({ pending: 0, synced: 1 });
    again.close();
  });

  it('logout sync is bounded by a timeout and never loses events', async () => {
    const hang = fakeTransport(() => new Promise<TransportOutcome>(() => undefined));
    const s = await openOfflineSession(alice, { ...base, transport: hang });
    await enablePolicy(s.db);
    await seedMembers(s.db, ['m1']);
    await s.record({ member_id: 'm1', attendance_method: 'manual' });
    const report = await logoutOffline(s, { syncTimeoutMs: 20 });
    expect(report.syncTimedOut).toBe(true);

    // the row was mid-flight (`syncing`); the next run for alice recovers it
    const db = await openOfflineDb('g1', 'alice');
    const rows = await listOutbox(db);
    expect(rows).toHaveLength(1);
    expect(['pending', 'syncing']).toContain(rows[0].sync_status);
    db.close();
  });

  it('getOfflineSession reuses the same user session and switches DB for another user', async () => {
    const a1 = await getOfflineSession(alice, base);
    const a2 = await getOfflineSession(alice, base);
    expect(a2).toBe(a1);
    const b = await getOfflineSession(bob, base);
    expect(b).not.toBe(a1);
    expect(b.db.name).toBe('clby-offline:g1:bob');
    b.close();
  });

  it('fetchIdentity reads /api/me and returns null when unauthenticated', async () => {
    const ok = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'u', gym_id: 'g', role: 'staff' }), { status: 200 }));
    expect(await fetchIdentity(ok)).toEqual({ userId: 'u', gymId: 'g', role: 'staff' });
    const unauth = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }));
    expect(await fetchIdentity(unauth)).toBeNull();
  });
});
