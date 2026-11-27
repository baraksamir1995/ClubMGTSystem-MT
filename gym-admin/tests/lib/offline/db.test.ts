import { describe, it, expect, beforeEach } from 'vitest';
import { freshIndexedDb, openTestDb, putRows, row, seedMembers, member } from './helpers';
import {
  DB_VERSION,
  countOutbox,
  dbNameFor,
  getDeviceId,
  getMeta,
  listDueOutbox,
  listOutbox,
  listOutboxByStatus,
  openOfflineDb,
  recoverSyncingRows,
  replaceSnapshot,
  searchMembers,
  setMeta,
  wipeCache,
} from '@/lib/offline/db';

describe('offline db', () => {
  beforeEach(() => freshIndexedDb());

  it('names the database per (gym, user) and rejects bad ids', () => {
    expect(dbNameFor('g1', 'u1')).toBe('clby-offline:g1:u1');
    expect(() => dbNameFor('', 'u1')).toThrow();
    expect(() => dbNameFor('g:1', 'u1')).toThrow();
  });

  it('creates every store + index at the current version', async () => {
    const db = await openTestDb();
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(
      ['branches', 'class_sessions', 'members', 'memberships', 'meta', 'outbox', 'recent_attendance'].sort(),
    );
    const outbox = db.transaction('outbox').store;
    expect([...outbox.indexNames]).toEqual(
      expect.arrayContaining(['sync_status', 'device_recorded_at', 'recorded_at_ms', 'member_id', 'member_session']),
    );
    db.close();
  });

  it('isolates two users: user B cannot see user A outbox or cache', async () => {
    const a = await openOfflineDb('g1', 'userA');
    const b = await openOfflineDb('g1', 'userB');
    await putRows(a, [row({ event_id: 'a-1' })]);
    await seedMembers(a, ['m1']);
    expect(await listOutbox(b)).toEqual([]);
    expect(await b.count('members')).toBe(0);
    expect((await listOutbox(a)).map((r) => r.event_id)).toEqual(['a-1']);
    a.close();
    b.close();
  });

  it('isolates the same user across gyms', async () => {
    const g1 = await openOfflineDb('g1', 'u');
    const g2 = await openOfflineDb('g2', 'u');
    await putRows(g1, [row()]);
    expect(await countOutbox(g2)).toEqual({ pending: 0, syncing: 0, synced: 0, rejected: 0 });
  });

  it('pending events survive closing and reopening the database', async () => {
    const db = await openTestDb();
    await putRows(db, [row({ event_id: 'keep-me' })]);
    db.close();
    const again = await openTestDb();
    expect((await listOutbox(again)).map((r) => r.event_id)).toEqual(['keep-me']);
  });

  it('device id is per browser, shared by users (fine: server binds per device+user, CONTRACT §6.1) and stable', async () => {
    const id1 = await getDeviceId();
    const id2 = await getDeviceId();
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[0-9a-f-]{36}$/);
    await openOfflineDb('g1', 'userA');
    expect(await getDeviceId()).toBe(id1);
  });

  it('orders by device_recorded_at instant (not string), then created_at', async () => {
    const db = await openTestDb();
    // 08:00+02:00 (= 06:00Z) is EARLIER than 07:00Z although it sorts later as a string
    await putRows(db, [
      row({ event_id: 'z', device_recorded_at: '2026-11-26T07:00:00.000Z', recorded_at_ms: Date.parse('2026-11-26T07:00:00Z'), created_at: '2026-11-26T07:00:00.000Z' }),
      row({ event_id: 'y', device_recorded_at: '2026-11-26T08:00:00.000+02:00', recorded_at_ms: Date.parse('2026-11-26T06:00:00Z'), created_at: '2026-11-26T06:00:00.000Z' }),
      row({ event_id: 'b', recorded_at_ms: 1000, created_at: '2026-11-26T00:00:02.000Z' }),
      row({ event_id: 'a', recorded_at_ms: 1000, created_at: '2026-11-26T00:00:01.000Z' }),
    ]);
    expect((await listOutboxByStatus(db, 'pending')).map((r) => r.event_id)).toEqual(['a', 'b', 'y', 'z']);
  });

  it('listDueOutbox honours next_attempt_at', async () => {
    const db = await openTestDb();
    await putRows(db, [
      row({ event_id: 'due-null' }),
      row({ event_id: 'due-past', next_attempt_at: 500 }),
      row({ event_id: 'later', next_attempt_at: 5000 }),
      row({ event_id: 'done', sync_status: 'synced' }),
    ]);
    expect((await listDueOutbox(db, 1000)).map((r) => r.event_id).sort()).toEqual(['due-null', 'due-past']);
  });

  it('recoverSyncingRows moves syncing → pending', async () => {
    const db = await openTestDb();
    await putRows(db, [row({ event_id: 's1', sync_status: 'syncing', sync_started_at: 1 }), row({ event_id: 'p1' })]);
    expect(await recoverSyncingRows(db)).toBe(1);
    expect(await countOutbox(db)).toMatchObject({ pending: 2, syncing: 0 });
  });

  it('replaceSnapshot replaces all cache stores atomically and wipeCache keeps the outbox', async () => {
    const db = await openTestDb();
    await seedMembers(db, ['old']);
    await putRows(db, [row({ event_id: 'e1' })]);
    await setMeta(db, 'device_id', 'dev');
    await replaceSnapshot(db, {
      members: [member('m1', 'Sara Ali'), member('m2', 'Omar Hany')],
      memberships: [],
      branches: [{ id: 'b1', name: 'Main', is_active: true }],
      class_sessions: [],
      recent_attendance: [],
      meta: { as_of: '2026-11-26T08:00:00Z' },
    });
    expect((await db.getAllKeys('members')).sort()).toEqual(['m1', 'm2']);
    expect(await getMeta(db, 'as_of')).toBe('2026-11-26T08:00:00Z');
    expect((await searchMembers(db, 'sara')).map((m) => m.gym_member_id)).toEqual(['m1']);
    expect((await searchMembers(db, '2')).map((m) => m.gym_member_id)).toEqual(['m2']);

    await wipeCache(db);
    expect(await db.count('members')).toBe(0);
    expect(await db.count('branches')).toBe(0);
    expect(await getMeta(db, 'as_of')).toBeUndefined();
    expect(await getMeta(db, 'device_id')).toBe('dev');
    expect(await db.count('outbox')).toBe(1);
  });

  it('a failing snapshot write leaves the previous snapshot intact', async () => {
    const db = await openTestDb();
    await seedMembers(db, ['old']);
    await expect(
      replaceSnapshot(db, {
        // missing keyPath value → DataError → whole transaction aborts
        members: [member('new'), { ...member('x'), gym_member_id: undefined as unknown as string }],
        memberships: [],
        branches: [],
        class_sessions: [],
        recent_attendance: [],
        meta: {},
      }),
    ).rejects.toBeTruthy();
    expect(await db.getAllKeys('members')).toEqual(['old']);
  });

  it('wipeCache also removes the legacy pass_keys meta key', async () => {
    const db = await openTestDb();
    await db.put('meta', [{ kid: 'k' }], 'pass_keys' as never);
    await wipeCache(db);
    expect(await db.get('meta', 'pass_keys' as never)).toBeUndefined();
  });
});
