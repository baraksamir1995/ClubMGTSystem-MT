import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enablePolicy, fakeTransport, freshIndexedDb, noLock, seedMembers } from './helpers';
import { signOutWithOfflineCleanup } from '@/lib/offline/sign-out';
import { getActiveOfflineSession, getOfflineSession } from '@/lib/offline/session';
import { countOutbox, openOfflineDb } from '@/lib/offline/db';
import type { TransportOutcome } from '@/lib/offline/sync-engine';

const me = { id: 'u1', gym_id: 'g1', role: 'staff' };

function fetchMock(calls: string[]) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url === '/api/me') return new Response(JSON.stringify(me), { status: 200 });
    return new Response('{}', { status: 200 });
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

describe('sign-out with offline cleanup (logout hook ordering)', () => {
  beforeEach(() => {
    freshIndexedDb();
    getActiveOfflineSession()?.close();
  });

  it('sync attempt → confirm → wipe cache → POST /api/auth/logout, in that order; outbox kept', async () => {
    const order: string[] = [];
    const calls: string[] = [];
    const s = await sessionWithPending({ type: 'network', error: 'offline' });
    const syncSpy = vi.spyOn(s.engine, 'syncNow').mockImplementation(async () => {
      order.push('sync');
      return { ran: true, batches: 0, sent: 0, synced: 0, rejected: 0, retrying: 0, recovered: 0 };
    });
    const f = fetchMock(calls);
    const wrapped = (async (url: string, init?: RequestInit) => {
      if (url === '/api/auth/logout') order.push(`logout (members cached: ${await (await openOfflineDb('g1', 'u1')).count('members')})`);
      return f(url, init);
    }) as unknown as typeof fetch;

    const res = await signOutWithOfflineCleanup({
      fetchImpl: wrapped,
      confirmPending: (n) => {
        order.push(`confirm ${n}`);
        return true;
      },
    });
    expect(res).toBe('signed_out');
    expect(order).toEqual(['sync', 'confirm 1', 'logout (members cached: 0)']);
    expect(calls).toEqual(['POST /api/auth/logout']);
    syncSpy.mockRestore();
    const db = await openOfflineDb('g1', 'u1');
    expect(await countOutbox(db)).toMatchObject({ pending: 1 });
    expect(getActiveOfflineSession()).toBeNull();
  });

  it('cancel at the warning → no logout call, cache and outbox untouched', async () => {
    const calls: string[] = [];
    const s = await sessionWithPending({ type: 'network', error: 'offline' });
    const res = await signOutWithOfflineCleanup({ fetchImpl: fetchMock(calls), confirmPending: () => false });
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
    expect(await signOutWithOfflineCleanup({ fetchImpl: fetchMock(calls), confirmPending })).toBe('signed_out');
    expect(confirmPending).not.toHaveBeenCalled();
    expect(calls).toEqual(['POST /api/auth/logout']);
    expect(await (await openOfflineDb('g1', 'u1')).count('members')).toBe(0);
  });

  it('no session in this tab but an existing DB for this user → opened via /api/me and cleaned up', async () => {
    const db = await openOfflineDb('g1', 'u1');
    await seedMembers(db, ['m1']);
    db.close();
    const calls: string[] = [];
    expect(await signOutWithOfflineCleanup({ fetchImpl: fetchMock(calls), confirmPending: () => true })).toBe('signed_out');
    expect(calls).toEqual(['GET /api/me', 'POST /api/auth/logout']);
    expect(await (await openOfflineDb('g1', 'u1')).count('members')).toBe(0);
  });

  it('no offline database for this user → never creates one; just logs out', async () => {
    const calls: string[] = [];
    expect(await signOutWithOfflineCleanup({ fetchImpl: fetchMock(calls), confirmPending: () => true })).toBe('signed_out');
    expect(calls).toEqual(['GET /api/me', 'POST /api/auth/logout']);
    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).not.toContain('clby-offline:g1:u1');
  });

  it('offline cleanup failures never block signing out', async () => {
    const calls: string[] = [];
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url === '/api/me') throw new TypeError('Failed to fetch');
      return new Response('{}');
    }) as unknown as typeof fetch;
    expect(await signOutWithOfflineCleanup({ fetchImpl: f, confirmPending: () => true })).toBe('signed_out');
    expect(calls).toEqual(['GET /api/me', 'POST /api/auth/logout']);
  });
});
