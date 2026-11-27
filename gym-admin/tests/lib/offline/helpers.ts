import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openOfflineDb, setMeta, type OfflineDB } from '@/lib/offline/db';
import type { SyncLock, SyncTransport, TransportOutcome } from '@/lib/offline/sync-engine';
import {
  DEFAULT_POLICY,
  type CachedMember,
  type OfflinePolicy,
  type OutboxRow,
  type SyncRequest,
  type SyncResult,
} from '@/lib/offline/types';

export const GYM = 'gym-1';
export const USER = 'user-1';
export const DEVICE = 'device-1';

/** Fresh, empty IndexedDB for each test (happy-dom has none). */
export function freshIndexedDb(): void {
  (globalThis as { indexedDB: unknown }).indexedDB = new IDBFactory();
}

export async function openTestDb(gym = GYM, user = USER): Promise<OfflineDB> {
  return openOfflineDb(gym, user);
}

export const ENABLED_POLICY: OfflinePolicy = { ...DEFAULT_POLICY, enabled: true };

export async function enablePolicy(db: OfflineDB, patch: Partial<OfflinePolicy> = {}): Promise<OfflinePolicy> {
  const policy = { ...ENABLED_POLICY, ...patch };
  await setMeta(db, 'policy', policy);
  return policy;
}

export function member(id: string, name = `Member ${id}`): CachedMember {
  return {
    gym_member_id: id,
    member_number: id.replace(/\D/g, '') || '1',
    full_name: name,
    phone_last4: '1234',
    photo_url: null,
    status: 'active',
    name_lc: name.toLowerCase(),
  };
}

export async function seedMembers(db: OfflineDB, ids: string[]): Promise<void> {
  const tx = db.transaction('members', 'readwrite');
  for (const id of ids) await tx.store.put(member(id));
  await tx.done;
}

let seq = 0;
export function row(overrides: Partial<OutboxRow> = {}): OutboxRow {
  seq++;
  const recorded = overrides.recorded_at_ms ?? Date.UTC(2026, 10, 26, 8, 0, seq);
  return {
    event_id: `evt-${String(seq).padStart(4, '0')}`,
    kind: 'attendance',
    attendance_method: 'manual',
    gym_id: GYM,
    branch_id: null,
    member_id: 'm1',
    class_session_id: null,
    studio_id: null,
    service_assignment_id: null,
    device_recorded_at: new Date(recorded).toISOString(),
    device_timezone: 'Africa/Cairo',
    qr: null,
    note: null,
    metadata: {},
    actor_user_id: USER,
    actor_type: 'gym_admin',
    device_id: DEVICE,
    sync_status: 'pending',
    sync_attempts: 0,
    next_attempt_at: null,
    last_sync_error: null,
    result_status: null,
    result_code: null,
    result_message: null,
    official_id: null,
    flags: [],
    server_received_at: null,
    processed_at: null,
    created_at: new Date(recorded).toISOString(),
    recorded_at_ms: recorded,
    sync_started_at: null,
    ...overrides,
  };
}

export async function putRows(db: OfflineDB, rows: OutboxRow[]): Promise<void> {
  const tx = db.transaction('outbox', 'readwrite');
  for (const r of rows) await tx.store.put(r);
  await tx.done;
}

export function accepted(eventId: string, extra: Partial<SyncResult> = {}): SyncResult {
  return {
    event_id: eventId,
    status: 'accepted',
    code: 'created',
    message: 'ok',
    attendance_id: `att-${eventId}`,
    service_log_id: null,
    flags: [],
    server_received_at: '2026-11-26T10:00:00.000Z',
    processed_at: '2026-11-26T10:00:00.100Z',
    retryable: false,
    ...extra,
  };
}

export interface FakeTransport extends SyncTransport {
  requests: SyncRequest[];
}

/** Transport whose outcome is computed per request; default = accept everything. */
export function fakeTransport(
  handler: (req: SyncRequest, n: number) => TransportOutcome | Promise<TransportOutcome> = (req) => ({
    type: 'ok',
    response: { server_time: '2026-11-26T10:00:00.000Z', results: req.events.map((e) => accepted(e.event_id)) },
  }),
): FakeTransport {
  const requests: SyncRequest[] = [];
  return {
    requests,
    async send(req) {
      requests.push(JSON.parse(JSON.stringify(req)) as SyncRequest);
      return handler(req, requests.length);
    },
  };
}

export const noLock: SyncLock = {
  async run(fn) {
    return { acquired: true, value: await fn() };
  },
};

/** Minimal in-memory Web Locks implementation supporting `ifAvailable`. */
export function fakeLockManager() {
  const held = new Set<string>();
  return {
    async request<T>(name: string, opts: { ifAvailable: boolean }, cb: (lock: unknown) => Promise<T>): Promise<T> {
      if (held.has(name)) {
        if (opts.ifAvailable) return cb(null);
        throw new Error('fake lock manager only supports ifAvailable');
      }
      held.add(name);
      try {
        return await cb({ name });
      } finally {
        held.delete(name);
      }
    },
  };
}

export function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
