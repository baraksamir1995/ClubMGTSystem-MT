/**
 * Offline attendance — IndexedDB storage (via `idb`).
 *
 * One database per (gym, user): `clby-offline:{gymId}:{userId}`. The api base is
 * implicit: IndexedDB is per-origin and the dashboard only talks to its own
 * origin (Next proxies). Another account on the same browser opens a different
 * database and the app never opens a database whose name it did not derive from
 * the currently authenticated identity (D9).
 *
 * The device id is per browser profile, not per user, so it lives in its own
 * tiny database `clby-offline-device`.
 *
 * UI code must go through the functions here (or recorder/engine/bootstrap),
 * never touch IndexedDB directly.
 */
import { openDB, deleteDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  CachedBranch,
  CachedClassSession,
  CachedMember,
  CachedMembership,
  MetaKey,
  MetaValues,
  OutboxRow,
  RecentAttendance,
  SyncCounts,
  SyncStatus,
} from './types';

export const DB_VERSION = 1;
export const DB_PREFIX = 'clby-offline';
export const DEVICE_DB_NAME = 'clby-offline-device';

export interface OfflineDBSchema extends DBSchema {
  meta: { key: MetaKey; value: unknown };
  members: {
    key: string; // gym_member_id
    value: CachedMember;
    indexes: { member_number: string; name_lc: string };
  };
  memberships: {
    key: string; // membership_id
    value: CachedMembership;
    indexes: { gym_member_id: string };
  };
  branches: { key: string; value: CachedBranch };
  class_sessions: {
    key: string;
    value: CachedClassSession;
    indexes: { starts_at: string; branch_id: string };
  };
  recent_attendance: {
    key: string; // attendance_id
    value: RecentAttendance;
    indexes: { gym_member_id: string; member_session: [string, string] };
  };
  outbox: {
    key: string; // event_id
    value: OutboxRow;
    indexes: {
      sync_status: SyncStatus;
      device_recorded_at: string;
      recorded_at_ms: number;
      member_id: string;
      member_session: [string, string];
    };
  };
}

export type OfflineDB = IDBPDatabase<OfflineDBSchema>;

/** Stores holding cached operational data (wiped on logout / revoked access). */
export const CACHE_STORES = [
  'members',
  'memberships',
  'branches',
  'class_sessions',
  'recent_attendance',
] as const;
export type CacheStore = (typeof CACHE_STORES)[number];

/** meta keys describing the cached snapshot (wiped together with CACHE_STORES). */
export const SNAPSHOT_META_KEYS: MetaKey[] = [
  'as_of',
  'snapshot_stored_at',
  'bootstrap_cursor',
  'gym',
  'pass_keys',
  'permissions_snapshot',
  'branch_qrs',
  'qr_branches',
];

export function dbNameFor(gymId: string, userId: string): string {
  if (!gymId || !userId) throw new Error('offline db: gymId and userId are required');
  if (gymId.includes(':') || userId.includes(':')) {
    throw new Error('offline db: ids must not contain ":"');
  }
  return `${DB_PREFIX}:${gymId}:${userId}`;
}

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

/**
 * Open (creating/upgrading) the per-user database. Versioned upgrade path: each
 * `if (oldVersion < N)` block migrates from N-1 to N; never edit a shipped block.
 */
export async function openOfflineDb(gymId: string, userId: string): Promise<OfflineDB> {
  const db = await openDB<OfflineDBSchema>(dbNameFor(gymId, userId), DB_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore('meta');

        const members = database.createObjectStore('members', { keyPath: 'gym_member_id' });
        members.createIndex('member_number', 'member_number');
        members.createIndex('name_lc', 'name_lc');

        const memberships = database.createObjectStore('memberships', { keyPath: 'membership_id' });
        memberships.createIndex('gym_member_id', 'gym_member_id');

        database.createObjectStore('branches', { keyPath: 'id' });

        const sessions = database.createObjectStore('class_sessions', { keyPath: 'id' });
        sessions.createIndex('starts_at', 'starts_at');
        sessions.createIndex('branch_id', 'branch_id');

        const recent = database.createObjectStore('recent_attendance', { keyPath: 'attendance_id' });
        recent.createIndex('gym_member_id', 'gym_member_id');
        // rows with a null class_session_id are simply not in this index
        recent.createIndex('member_session', ['gym_member_id', 'class_session_id']);

        const outbox = database.createObjectStore('outbox', { keyPath: 'event_id' });
        outbox.createIndex('sync_status', 'sync_status');
        outbox.createIndex('device_recorded_at', 'device_recorded_at');
        outbox.createIndex('recorded_at_ms', 'recorded_at_ms');
        outbox.createIndex('member_id', 'member_id');
        outbox.createIndex('member_session', ['member_id', 'class_session_id']);
      }
    },
    blocking() {
      // A newer version is waiting in another tab: let it upgrade.
      db.close();
    },
  });
  return db;
}

/** Permanently delete a user's database (explicit, logged discard only — D9). */
export async function deleteOfflineDb(gymId: string, userId: string): Promise<void> {
  await deleteDB(dbNameFor(gymId, userId));
}

// ── device id (per browser, not per user) ───────────────────────────────────

interface DeviceDBSchema extends DBSchema {
  kv: { key: string; value: string };
}

function randomUuid(): string {
  return globalThis.crypto.randomUUID();
}

/** Stable per-browser device id. Created once, never regenerated on read errors silently. */
export async function getDeviceId(): Promise<string> {
  const db = await openDB<DeviceDBSchema>(DEVICE_DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore('kv');
    },
  });
  try {
    const tx = db.transaction('kv', 'readwrite');
    const existing = await tx.store.get('device_id');
    if (existing) {
      await tx.done;
      return existing;
    }
    const id = randomUuid();
    await tx.store.put(id, 'device_id');
    await tx.done;
    return id;
  } finally {
    db.close();
  }
}

// ── meta ────────────────────────────────────────────────────────────────────

export async function getMeta<K extends MetaKey>(db: OfflineDB, key: K): Promise<MetaValues[K] | undefined> {
  return (await db.get('meta', key)) as MetaValues[K] | undefined;
}

export async function setMeta<K extends MetaKey>(db: OfflineDB, key: K, value: MetaValues[K]): Promise<void> {
  await db.put('meta', value, key);
}

// ── outbox ──────────────────────────────────────────────────────────────────

export async function putOutboxRow(db: OfflineDB, row: OutboxRow): Promise<void> {
  await db.put('outbox', row);
}

/** Insert a new event; fails if the event_id already exists (ids are never reused). */
export async function addOutboxRow(db: OfflineDB, row: OutboxRow): Promise<void> {
  await db.add('outbox', row);
}

export async function getOutboxRow(db: OfflineDB, eventId: string): Promise<OutboxRow | undefined> {
  return db.get('outbox', eventId);
}

export function compareOutbox(a: OutboxRow, b: OutboxRow): number {
  if (a.recorded_at_ms !== b.recorded_at_ms) return a.recorded_at_ms - b.recorded_at_ms;
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
  return a.event_id < b.event_id ? -1 : a.event_id > b.event_id ? 1 : 0;
}

/** All rows with the given status, ordered by device_recorded_at then created_at. */
export async function listOutboxByStatus(db: OfflineDB, status: SyncStatus): Promise<OutboxRow[]> {
  const rows = await db.getAllFromIndex('outbox', 'sync_status', status);
  return rows.sort(compareOutbox);
}

/** Every outbox row (for the Phase 2 inspector), newest device time first. */
export async function listOutbox(db: OfflineDB): Promise<OutboxRow[]> {
  const rows = await db.getAll('outbox');
  return rows.sort(compareOutbox).reverse();
}

/** Pending rows whose backoff has elapsed and that are not on hold, in sync order. */
export async function listDueOutbox(db: OfflineDB, nowMs: number): Promise<OutboxRow[]> {
  const rows = await listOutboxByStatus(db, 'pending');
  return rows.filter((r) => !r.sync_hold && (r.next_attempt_at == null || r.next_attempt_at <= nowMs));
}

export async function countOutbox(db: OfflineDB): Promise<SyncCounts> {
  const tx = db.transaction('outbox');
  const idx = tx.store.index('sync_status');
  const [pending, syncing, synced, rejected] = await Promise.all([
    idx.count('pending'),
    idx.count('syncing'),
    idx.count('synced'),
    idx.count('rejected'),
  ]);
  await tx.done;
  return { pending, syncing, synced, rejected };
}

/** Earliest scheduled retry among pending, non-held rows (epoch ms), or null. */
export async function nextRetryAt(db: OfflineDB): Promise<number | null> {
  return (await pendingSummary(db)).nextRetryAt;
}

/** One pass over pending rows: earliest retry + how many are on hold (§6.5). */
export async function pendingSummary(db: OfflineDB): Promise<{ nextRetryAt: number | null; held: number }> {
  const rows = await db.getAllFromIndex('outbox', 'sync_status', 'pending');
  let min: number | null = null;
  let held = 0;
  for (const r of rows) {
    if (r.sync_hold) {
      held++;
      continue;
    }
    if (r.next_attempt_at != null && (min == null || r.next_attempt_at < min)) min = r.next_attempt_at;
  }
  return { nextRetryAt: min, held };
}

/** Crash recovery: rows stuck in `syncing` go back to `pending`. Returns count. */
export async function recoverSyncingRows(db: OfflineDB): Promise<number> {
  const tx = db.transaction('outbox', 'readwrite');
  const rows = await tx.store.index('sync_status').getAll('syncing');
  for (const row of rows) {
    await tx.store.put({ ...row, sync_status: 'pending', sync_started_at: null });
  }
  await tx.done;
  return rows.length;
}

// ── cache ───────────────────────────────────────────────────────────────────

export interface SnapshotData {
  members: CachedMember[];
  memberships: CachedMembership[];
  branches: CachedBranch[];
  class_sessions: CachedClassSession[];
  recent_attendance: RecentAttendance[];
  meta: Partial<MetaValues>;
}

/** Atomically replace every cache store + snapshot meta in ONE transaction. */
export async function replaceSnapshot(db: OfflineDB, data: SnapshotData): Promise<void> {
  const tx = db.transaction([...CACHE_STORES, 'meta'], 'readwrite');
  const ops: Promise<unknown>[] = [];
  try {
    for (const name of CACHE_STORES) ops.push(tx.objectStore(name).clear());
    for (const m of data.members) ops.push(tx.objectStore('members').put(m));
    for (const m of data.memberships) ops.push(tx.objectStore('memberships').put(m));
    for (const b of data.branches) ops.push(tx.objectStore('branches').put(b));
    for (const s of data.class_sessions) ops.push(tx.objectStore('class_sessions').put(s));
    for (const a of data.recent_attendance) ops.push(tx.objectStore('recent_attendance').put(a));
    for (const [k, v] of Object.entries(data.meta)) ops.push(tx.objectStore('meta').put(v, k as MetaKey));
  } catch (err) {
    // A synchronous throw (e.g. DataError: bad key) does NOT abort the
    // transaction by itself — the clears would commit. Abort explicitly.
    tx.abort();
    await Promise.allSettled([...ops, tx.done]);
    throw err;
  }
  ops.push(tx.done);
  await Promise.all(ops);
}

/** Wipe cached operational data (keeps outbox, device id, identity, policy). */
export async function wipeCache(db: OfflineDB): Promise<void> {
  const tx = db.transaction([...CACHE_STORES, 'meta'], 'readwrite');
  const ops: Promise<unknown>[] = [];
  for (const name of CACHE_STORES) ops.push(tx.objectStore(name).clear());
  for (const k of SNAPSHOT_META_KEYS) ops.push(tx.objectStore('meta').delete(k));
  ops.push(tx.done);
  await Promise.all(ops);
}

export async function getCachedMember(db: OfflineDB, gymMemberId: string): Promise<CachedMember | undefined> {
  return db.get('members', gymMemberId);
}

export async function getMemberMemberships(db: OfflineDB, gymMemberId: string): Promise<CachedMembership[]> {
  return db.getAllFromIndex('memberships', 'gym_member_id', gymMemberId);
}

export async function listBranches(db: OfflineDB): Promise<CachedBranch[]> {
  return db.getAll('branches');
}

export async function listClassSessions(db: OfflineDB): Promise<CachedClassSession[]> {
  return db.getAllFromIndex('class_sessions', 'starts_at');
}

export async function countCachedMembers(db: OfflineDB): Promise<number> {
  return db.count('members');
}

/**
 * Local member search (name substring, or member number / phone last-4 prefix).
 * Linear scan: fine for a few thousand members; Phase 2 may add a prefix index.
 */
export async function searchMembers(db: OfflineDB, query: string, limit = 20): Promise<CachedMember[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: CachedMember[] = [];
  let cursor = await db.transaction('members').store.openCursor();
  while (cursor && out.length < limit) {
    const m = cursor.value;
    if (
      m.name_lc.includes(q) ||
      String(m.member_number ?? '').toLowerCase().startsWith(q) ||
      (m.phone_last4 ?? '') === q
    ) {
      out.push(m);
    }
    cursor = await cursor.continue();
  }
  return out;
}
