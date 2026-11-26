import { describe, it, expect, beforeEach, vi } from 'vitest';
import { freshIndexedDb, openTestDb, putRows, row, seedMembers, GYM } from './helpers';
import {
  computeStaleness,
  createFetchBootstrapper,
  fetchOfflineStatus,
  getStaleness,
  runBootstrap,
  type BootstrapFetcher,
  type FetchOutcome,
} from '@/lib/offline/bootstrap';
import { getMeta, getMemberMemberships, type OfflineDB } from '@/lib/offline/db';
import { DEFAULT_POLICY, type AdminBootstrapPage, type BootstrapMember } from '@/lib/offline/types';

function bm(id: string, buckets = 1): BootstrapMember {
  return {
    gym_member_id: id,
    member_number: id,
    full_name: `Name ${id.toUpperCase()}`,
    phone_last4: '0000',
    photo_url: null,
    status: 'active',
    buckets: Array.from({ length: buckets }, (_, i) => ({
      membership_id: `${id}-ms${i}`,
      plan_type: 'duration',
      source_type: 'subscription',
      status: 'active',
      payment_status: 'paid',
      start_date: '2026-11-01',
      end_date: '2026-12-01',
      sessions_remaining: null,
      sessions_total: null,
      freeze_status: null,
      allowed_branch_ids: null,
    })),
  };
}

function page(members: BootstrapMember[], next: string | null, extra: Partial<AdminBootstrapPage> = {}): AdminBootstrapPage {
  return {
    server_time: '2026-11-26T10:00:05.000Z',
    as_of: '2026-11-26T10:00:00.000Z',
    gym: { id: GYM, name: 'Gym', timezone: 'Africa/Cairo' },
    policy: { ...DEFAULT_POLICY, enabled: true, max_data_age_hours: 12 },
    branches: [{ id: 'b1', name: 'Main', is_active: true }],
    members,
    class_sessions: [{ id: 'cs1', class_id: 'c1', name: 'Yoga', branch_id: 'b1', studio_id: null, starts_at: '2026-11-26T12:00:00Z', ends_at: null }],
    recent_attendance: [{ attendance_id: 'a1', gym_member_id: 'm1', class_session_id: 'cs1', branch_id: 'b1', check_in_at: '2026-11-26T09:00:00Z' }],
    next_cursor: next,
    ...extra,
  };
}

function fetcherFrom(pages: Record<string, FetchOutcome<AdminBootstrapPage>>) {
  const calls: (string | null)[] = [];
  const fetcher: BootstrapFetcher = {
    async page(cursor) {
      calls.push(cursor);
      return pages[cursor ?? 'first'];
    },
  };
  return { fetcher, calls };
}

describe('bootstrap', () => {
  let db: OfflineDB;
  beforeEach(async () => {
    freshIndexedDb();
    db = await openTestDb();
  });

  it('follows the cursor across pages and replaces the cache', async () => {
    await seedMembers(db, ['stale-member']);
    const { fetcher, calls } = fetcherFrom({
      first: { ok: true, data: page([bm('m1', 2), bm('m2')], 'c2') },
      c2: { ok: true, data: page([bm('m3')], 'c3', { as_of: '2026-11-26T10:00:09.000Z' }) },
      c3: { ok: true, data: page([], null) },
    });
    const res = await runBootstrap(db, { gymId: GYM, fetcher, now: () => 1234 });
    expect(calls).toEqual([null, 'c2', 'c3']);
    expect(res).toEqual({
      ok: true, as_of: '2026-11-26T10:00:00.000Z', pages: 3, members: 3, memberships: 4, branches: 1, class_sessions: 1, recent_attendance: 1,
    });
    expect((await db.getAllKeys('members')).sort()).toEqual(['m1', 'm2', 'm3']);
    expect((await getMemberMemberships(db, 'm1')).map((m) => m.membership_id).sort()).toEqual(['m1-ms0', 'm1-ms1']);
    expect((await db.get('members', 'm1'))?.name_lc).toBe('name m1');
    expect(await getMeta(db, 'as_of')).toBe('2026-11-26T10:00:00.000Z'); // first page = conservative
    expect(await getMeta(db, 'policy')).toMatchObject({ enabled: true, max_data_age_hours: 12 });
    expect(await getMeta(db, 'snapshot_stored_at')).toBe(1234);
  });

  it('a failure mid-way keeps the previous snapshot intact', async () => {
    await seedMembers(db, ['old']);
    await db.put('meta', '2026-11-25T00:00:00Z', 'as_of');
    const { fetcher } = fetcherFrom({
      first: { ok: true, data: page([bm('m1')], 'c2') },
      c2: { ok: false, reason: 'network' },
    });
    expect(await runBootstrap(db, { gymId: GYM, fetcher })).toEqual({ ok: false, reason: 'network', cacheWiped: false });
    expect(await db.getAllKeys('members')).toEqual(['old']);
    expect(await getMeta(db, 'as_of')).toBe('2026-11-25T00:00:00Z');
  });

  it('403 (revoked access) wipes the cache but keeps the outbox', async () => {
    await seedMembers(db, ['old']);
    await putRows(db, [row({ event_id: 'keep' })]);
    const { fetcher } = fetcherFrom({ first: { ok: false, reason: 'forbidden', status: 403 } });
    expect(await runBootstrap(db, { gymId: GYM, fetcher })).toEqual({ ok: false, reason: 'forbidden', cacheWiped: true });
    expect(await db.count('members')).toBe(0);
    expect(await db.count('outbox')).toBe(1);
  });

  it('401 leaves everything untouched', async () => {
    await seedMembers(db, ['old']);
    const { fetcher } = fetcherFrom({ first: { ok: false, reason: 'auth_required', status: 401 } });
    expect(await runBootstrap(db, { gymId: GYM, fetcher })).toMatchObject({ ok: false, reason: 'auth_required' });
    expect(await db.count('members')).toBe(1);
  });

  it('refuses a snapshot for another gym', async () => {
    const { fetcher } = fetcherFrom({ first: { ok: true, data: page([bm('m1')], null, { gym: { id: 'other', name: 'x', timezone: 'UTC' } }) } });
    expect(await runBootstrap(db, { gymId: GYM, fetcher })).toMatchObject({ ok: false, reason: 'gym_mismatch' });
    expect(await db.count('members')).toBe(0);
  });

  it('stops on a cursor that never ends', async () => {
    const fetcher: BootstrapFetcher = { page: async () => ({ ok: true, data: page([bm('m1')], 'again') }) };
    expect(await runBootstrap(db, { gymId: GYM, fetcher, maxPages: 3 })).toMatchObject({ ok: false, reason: 'too_many_pages' });
  });

  it('fetch bootstrapper: same-origin GET with cursor/limit + contract headers; redirect → auth_required', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(page([], null)), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const f = createFetchBootstrapper('dev-9', { fetchImpl, clientInfo: { app: 'admin', appVersion: '1', appBuild: 'b', platform: 'web' } });
    expect((await f.page('cur', 250)).ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/attendance/offline/bootstrap?limit=250&cursor=cur');
    expect(init).toMatchObject({ credentials: 'same-origin', redirect: 'manual' });
    expect(init.headers).toMatchObject({ 'X-Device-Id': 'dev-9', 'X-App': 'admin' });

    fetchImpl.mockResolvedValueOnce(new Response(null, { status: 307, headers: { location: '/login' } }));
    expect(await f.page(null, 10)).toMatchObject({ ok: false, reason: 'auth_required' });
    fetchImpl.mockResolvedValueOnce(new Response('{}', { status: 403 }));
    expect(await f.page(null, 10)).toMatchObject({ ok: false, reason: 'forbidden' });
  });

  it('fetchOfflineStatus stores the server policy', async () => {
    const body = { server_time: 'x', enabled: true, policy: { ...DEFAULT_POLICY, enabled: true, max_batch: 20 }, device: { registered: true, revoked: false } };
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    const out = await fetchOfflineStatus(db, 'dev-1', { fetchImpl });
    expect(out.ok).toBe(true);
    expect((fetchImpl.mock.calls[0] as [string])[0]).toBe('/api/attendance/offline/status?device_id=dev-1');
    expect(await getMeta(db, 'policy')).toMatchObject({ enabled: true, max_batch: 20 });
  });

  it('staleness vs policy.max_data_age_hours', async () => {
    const p = { ...DEFAULT_POLICY, max_data_age_hours: 24 };
    const now = Date.parse('2026-11-26T12:00:00Z');
    expect(computeStaleness('2026-11-26T00:00:00Z', p, now)).toMatchObject({ stale: false, age_ms: 12 * 3_600_000 });
    expect(computeStaleness('2026-11-25T11:59:00Z', p, now)).toMatchObject({ stale: true });
    expect(computeStaleness(null, p, now)).toMatchObject({ stale: true, age_ms: null });
    expect(await getStaleness(db, now)).toMatchObject({ stale: true, as_of: null });
  });
});
