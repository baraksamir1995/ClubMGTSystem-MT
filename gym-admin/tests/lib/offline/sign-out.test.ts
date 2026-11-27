import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enablePolicy, fakeTransport, freshIndexedDb, noLock, seedMembers } from './helpers';
import { signOutWithOfflineCleanup } from '@/lib/offline/sign-out';
import { getActiveOfflineSession, getOfflineSession } from '@/lib/offline/session';
import { countOutbox, openOfflineDb } from '@/lib/offline/db';
import type { TransportOutcome } from '@/lib/offline/sync-engine';

const me = { id: 'u1', gym_id: 'g1', role: 'staff' };
const online = () => true;

function fetchMock(calls: string[], logout: () => Response | Promise<Response> = () => new Response('{}', { status: 200 })) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url === '/api/me') return new Response(JSON.stringify(me), { status: 200 });
    return logout();
  }) as unknown as typeof fetch;
}

async function sessionWithPending(outcome: TransportOutcome) {
  const s = await getOfflineSession(
    { userId: me.id, gymId: me.gym_id, role: me.role },
    { transport: fakeTransport(() => outcome), lock: noLock, broadcast: false, isOnline: () => true },
  );
  await enablePolicy(s.db);
  await seedMembers(s.db, ['m1']);
  await s.record({ member_id: 'm1', attendance_method: 'manual' });
  return s;
}

const cachedMembers = async () => {
  const db = await openOfflineDb('g1', 'u1');
  const n = await db.count('members');
  db.close();
  return n;
};

describe('sign-out with offline cleanup (logout hook ordering)', () => {
  beforeEach(() => {
    freshIndexedDb();
    getActiveOfflineSession()?.close();
  });

  it('sync → confirm → POST /api/auth/logout → wipe cache, in that order; outbox kept; progress reported', async () => {
    const order: string[] = [];
    const calls: string[] = [];
    const s = await sessionWithPending({ type: 'network', error: 'offline' });
    vi.spyOn(s.engine, 'syncNow').mockImplementation(async () => {
      order.push('sync');
      return { ran: true, batches: 0, sent: 0, synced: 0, rejected: 0, retrying: 0, recovered: 0 };
    });
    const f = fetchMock(calls);
    const wrapped = (async (url: string, init?: RequestInit) => {
      if (url === '/api/auth/logout') order.push(`logout (members cached: ${await s.db.count('members')})`);
      return f(url, init);
    }) as unknown as typeof fetch;
    const phases: string[] = [];

    const res = await signOutWithOfflineCleanup({
      fetchImpl: wrapped,
      isOnline: online,
      onProgress: (p) => phases.push(p),
      confirmPending: (n) => {
        order.push(`confirm ${n}`);
        return true;
      },
    });
    expect(res).toBe('signed_out');
    expect(order).toEqual(['sync', 'confirm 1', 'logout (members cached: 1)']);
    expect(phases).toEqual(['syncing', 'signing_out']);
    expect(calls).toEqual(['POST /api/auth/logout']);
    expect(await cachedMembers()).toBe(0);
    const db = await openOfflineDb('g1', 'u1');
    expect(await countOutbox(db)).toMatchObject({ pending: 1 });
    expect(getActiveOfflineSession()).toBeNull();
  });

  it('MEDIUM-3: offline → refuses without touching anything (no sync, no logout call)', async () => {
    const calls: string[] = [];
    const s = await sessionWithPending({ type: 'network', error: 'offline' });
    const sync = vi.spyOn(s.engine, 'syncNow');
    const confirmPending = vi.fn();
    expect(await signOutWithOfflineCleanup({ fetchImpl: fetchMock(calls), isOnline: () => false, confirmPending })).toBe('offline');
    expect(calls).toEqual([]);
    expect(sync).not.toHaveBeenCalled();
    expect(confirmPending).not.toHaveBeenCalled();
    expect(await s.db.count('members')).toBe(1);
  });

  it('MEDIUM-3: logout request fails for network reasons → "offline", cache NOT wiped, session kept', async () => {
    const calls: string[] = [];
    const s = await sessionWithPending({ type: 'network', error: 'offline' });
    const res = await signOutWithOfflineCleanup({
      fetchImpl: fetchMock(calls, () => Promise.reject(new TypeError('Failed to fetch'))),
      isOnline: online,
      confirmPending: () => true,
    });
    expect(res).toBe('offline');
    expect(calls).toEqual(['POST /api/auth/logout']);
    expect(await s.db.count('members')).toBe(1);
    expect(getActiveOfflineSession()).toBe(s);
  });

  it('logout route itself unreachable (5xx) → "offline"', async () => {
    const calls: string[] = [];
    await sessionWithPending({ type: 'network', error: 'offline' });
    const res = await signOutWithOfflineCleanup({
      fetchImpl: fetchMock(calls, () => new Response('bad gateway', { status: 502 })),
      isOnline: online,
      confirmPending: () => true,
    });
    expect(res).toBe('offline');
    expect(await cachedMembers()).toBe(1);
  });

  it('cancel at the warning → no logout call, cache and outbox untouched', async () => {
    const calls: string[] = [];
    const s = await sessionWithPending({ type: 'network', error: 'offline' });
    const res = await signOutWithOfflineCleanup({ fetchImpl: fetchMock(calls), isOnline: online, confirmPending: () => false });
    expect(res).toBe('cancelled');
    expect(calls).toEqual([]);
    expect(await s.db.count('members')).toBe(1);
    expect(await countOutbox(s.db)).toMatchObject({ pending: 1 });
  });

  it('everything synced → no warning, cache wiped, logout called', async () => {
    const calls: string[] = [];
    const s = await getOfflineSession({ userId: me.id, gymId: me.gym_id, role: me.role }, { lock: noLock, broadcast: false, transport: fakeTransport() });
    await seedMembers(s.db, ['m1']);
    const confirmPending = vi.fn();
    expect(await signOutWithOfflineCleanup({ fetchImpl: fetchMock(calls), isOnline: online, confirmPending })).toBe('signed_out');
    expect(confirmPending).not.toHaveBeenCalled();
    expect(calls).toEqual(['POST /api/auth/logout']);
    expect(await cachedMembers()).toBe(0);
  });

  it('no session in this tab but an existing DB for this user → opened via /api/me and cleaned up', async () => {
    const db = await openOfflineDb('g1', 'u1');
    await seedMembers(db, ['m1']);
    db.close();
    const calls: string[] = [];
    expect(await signOutWithOfflineCleanup({ fetchImpl: fetchMock(calls), isOnline: online, confirmPending: () => true })).toBe('signed_out');
    expect(calls).toEqual(['GET /api/me', 'POST /api/auth/logout']);
    expect(await cachedMembers()).toBe(0);
  });

  it('no offline database for this user → never creates one; just logs out', async () => {
    const calls: string[] = [];
    expect(await signOutWithOfflineCleanup({ fetchImpl: fetchMock(calls), isOnline: online, confirmPending: () => true })).toBe('signed_out');
    expect(calls).toEqual(['GET /api/me', 'POST /api/auth/logout']);
    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).not.toContain('clby-offline:g1:u1');
  });

  it('identity lookup failing (e.g. /api/me error) never blocks signing out', async () => {
    const calls: string[] = [];
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url === '/api/me') return new Response('{}', { status: 500 });
      return new Response('{}');
    }) as unknown as typeof fetch;
    expect(await signOutWithOfflineCleanup({ fetchImpl: f, isOnline: online, confirmPending: () => true })).toBe('signed_out');
    expect(calls).toEqual(['GET /api/me', 'POST /api/auth/logout']);
  });
});
