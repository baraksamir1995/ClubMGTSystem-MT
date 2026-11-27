import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  accepted,
  deferred,
  DEVICE,
  enablePolicy,
  fakeLockManager,
  fakeTransport,
  freshIndexedDb,
  noLock,
  openTestDb,
  putRows,
  row,
} from './helpers';
import {
  computeBackoffMs,
  createFetchTransport,
  createLeaseLock,
  createSyncEngine,
  createWebLock,
  type SyncEngineOptions,
  type SyncTransport,
  type TransportOutcome,
} from '@/lib/offline/sync-engine';
import { countOutbox, getMeta, getOutboxRow, listOutbox, openOfflineDb, type OfflineDB } from '@/lib/offline/db';
import type { SyncEngineState, SyncRequest } from '@/lib/offline/types';

const T0 = Date.UTC(2026, 10, 26, 10, 0, 0);

describe('sync engine', () => {
  let db: OfflineDB;
  let clock: number;

  function engine(opts: Partial<SyncEngineOptions> = {}) {
    return createSyncEngine({
      db,
      deviceId: DEVICE,
      transport: fakeTransport(),
      lock: noLock,
      now: () => clock,
      random: () => 0.5,
      isOnline: () => true,
      broadcast: false,
      clientInfo: { app: 'admin', appVersion: '9.9.9', appBuild: 'b1', platform: 'web' },
      ...opts,
    });
  }

  beforeEach(async () => {
    freshIndexedDb();
    db = await openTestDb();
    await enablePolicy(db, { retry_base_seconds: 5, retry_max_seconds: 900, max_batch: 50 });
    clock = T0;
  });

  // ── request shape + ordering + batching ──────────────────────────────────

  it('sends the contract envelope with wire-only event fields', async () => {
    await putRows(db, [row({ event_id: 'e1', class_session_id: 'cs1', qr: { raw: 'q' } })]);
    const t = fakeTransport();
    await engine({ transport: t }).syncNow();
    expect(t.requests).toHaveLength(1);
    const req = t.requests[0];
    expect(req).toMatchObject({ device_id: DEVICE, app: 'admin', app_version: '9.9.9' });
    expect(Object.keys(req.events[0]).sort()).toEqual(
      [
        'event_id', 'kind', 'attendance_method', 'gym_id', 'branch_id', 'member_id', 'class_session_id',
        'studio_id', 'service_assignment_id', 'device_recorded_at', 'device_timezone', 'qr', 'note', 'metadata',
      ].sort(),
    );
    expect(req.events[0]).toMatchObject({ event_id: 'e1', class_session_id: 'cs1', qr: { raw: 'q' } });
  });

  it('orders events by device time then created_at across batches of max_batch', async () => {
    await enablePolicy(db, { max_batch: 2 });
    await putRows(db, [
      row({ event_id: 'e5', recorded_at_ms: 500 }),
      row({ event_id: 'e1', recorded_at_ms: 100 }),
      row({ event_id: 'e3b', recorded_at_ms: 300, created_at: '2026-11-26T00:00:02Z' }),
      row({ event_id: 'e3a', recorded_at_ms: 300, created_at: '2026-11-26T00:00:01Z' }),
      row({ event_id: 'e2', recorded_at_ms: 200 }),
    ]);
    const t = fakeTransport();
    const summary = await engine({ transport: t }).syncNow();
    expect(t.requests.map((r) => r.events.map((e) => e.event_id))).toEqual([['e1', 'e2'], ['e3a', 'e3b'], ['e5']]);
    expect(summary).toMatchObject({ ran: true, batches: 3, sent: 5, synced: 5 });
    expect(await countOutbox(db)).toMatchObject({ pending: 0, synced: 5 });
  });

  it('never sends more than the server cap of 50 per request', async () => {
    await enablePolicy(db, { max_batch: 500 });
    await putRows(db, Array.from({ length: 120 }, (_, i) => row({ event_id: `b${i}`, recorded_at_ms: i })));
    const t = fakeTransport();
    await engine({ transport: t }).syncNow();
    expect(t.requests.map((r) => r.events.length)).toEqual([50, 50, 20]);
  });

  // ── result mapping (CONTRACT §5) ─────────────────────────────────────────

  it('maps accepted / duplicate / rejected / error / missing per event', async () => {
    await putRows(db, [
      row({ event_id: 'acc', recorded_at_ms: 1 }),
      row({ event_id: 'rep', recorded_at_ms: 2 }),
      row({ event_id: 'dup', recorded_at_ms: 3 }),
      row({ event_id: 'rej', recorded_at_ms: 4 }),
      row({ event_id: 'err', recorded_at_ms: 5 }),
      row({ event_id: 'mis', recorded_at_ms: 6 }),
    ]);
    const t = fakeTransport(() => ({
      type: 'ok',
      response: {
        server_time: new Date(T0).toISOString(),
        results: [
          accepted('acc', { flags: ['sessions_exhausted'] }),
          { ...accepted('rep'), status: 'duplicate', code: 'event_replayed', attendance_id: 'att-original' },
          { ...accepted('dup'), status: 'duplicate', code: 'already_checked_in', attendance_id: 'att-existing' },
          { event_id: 'rej', status: 'rejected', code: 'membership_frozen', message: 'Frozen', retryable: false, server_received_at: 'x' },
          { event_id: 'err', status: 'error', code: 'server_error', message: 'boom', retryable: true },
          // no result for 'mis'
        ],
      },
    }));
    const summary = await engine({ transport: t }).syncNow();
    expect(summary).toMatchObject({ synced: 3, rejected: 1, retrying: 2 });

    expect(await getOutboxRow(db, 'acc')).toMatchObject({
      sync_status: 'synced', result_status: 'accepted', result_code: 'created', official_id: 'att-acc',
      flags: ['sessions_exhausted'], server_received_at: '2026-11-26T10:00:00.000Z', sync_attempts: 1,
    });
    expect(await getOutboxRow(db, 'rep')).toMatchObject({ sync_status: 'synced', result_code: 'event_replayed', official_id: 'att-original' });
    expect(await getOutboxRow(db, 'dup')).toMatchObject({ sync_status: 'synced', result_code: 'already_checked_in', official_id: 'att-existing' });
    expect(await getOutboxRow(db, 'rej')).toMatchObject({
      sync_status: 'rejected', result_status: 'rejected', result_code: 'membership_frozen', result_message: 'Frozen', next_attempt_at: null,
    });
    // backoff for attempt 1 with random=0.5: d=5s → 2.5s + 0.5·2.5s = 3.75s
    expect(await getOutboxRow(db, 'err')).toMatchObject({
      sync_status: 'pending', last_sync_error: 'error:server_error', result_code: 'server_error', next_attempt_at: T0 + 3750,
    });
    expect(await getOutboxRow(db, 'mis')).toMatchObject({ sync_status: 'pending', last_sync_error: 'missing_result', next_attempt_at: T0 + 3750 });
    // nothing is ever deleted
    expect(await listOutbox(db)).toHaveLength(6);
  });

  it('rejected events stay rejected and are never re-sent', async () => {
    await putRows(db, [row({ event_id: 'r1' })]);
    const t = fakeTransport((req) => ({
      type: 'ok',
      response: { server_time: '', results: req.events.map((e) => ({ event_id: e.event_id, status: 'rejected', code: 'not_a_member', message: '' })) },
    }));
    const e = engine({ transport: t });
    await e.syncNow();
    await e.syncNow({ force: true });
    expect(t.requests).toHaveLength(1);
    expect(await getOutboxRow(db, 'r1')).toMatchObject({ sync_status: 'rejected' });
  });

  // ── backoff ──────────────────────────────────────────────────────────────

  it('backoff schedule: exponential, capped, equal jitter', () => {
    const p = { retry_base_seconds: 5, retry_max_seconds: 900 };
    const lo = (n: number) => computeBackoffMs(n, p, () => 0);
    const hi = (n: number) => computeBackoffMs(n, p, () => 1);
    expect([1, 2, 3, 4, 5].map(hi)).toEqual([5000, 10000, 20000, 40000, 80000]);
    expect([1, 2, 3].map(lo)).toEqual([2500, 5000, 10000]);
    expect(hi(8)).toBe(640000);
    expect(hi(9)).toBe(900000); // capped
    expect(hi(50)).toBe(900000);
    expect(lo(50)).toBe(450000);
  });

  it('transient failures back off per attempt and are retried only when due', async () => {
    await putRows(db, [row({ event_id: 'e1' })]);
    const t = fakeTransport(() => ({ type: 'http', status: 503, body: null, retryAfterSeconds: null }));
    const e = engine({ transport: t, random: () => 1 });
    await e.syncNow();
    expect(await getOutboxRow(db, 'e1')).toMatchObject({ sync_status: 'pending', sync_attempts: 1, last_sync_error: 'http_503', next_attempt_at: T0 + 5000 });

    await e.syncNow(); // not due yet
    expect(t.requests).toHaveLength(1);

    clock = T0 + 5000;
    await e.syncNow();
    expect(t.requests).toHaveLength(2);
    expect(await getOutboxRow(db, 'e1')).toMatchObject({ sync_attempts: 2, next_attempt_at: T0 + 5000 + 10000 });

    await e.syncNow({ force: true }); // manual "sync now" ignores backoff
    expect(t.requests).toHaveLength(3);
  });

  it('429 honours Retry-After when longer than the backoff', async () => {
    await putRows(db, [row({ event_id: 'e1' })]);
    const t = fakeTransport(() => ({ type: 'http', status: 429, body: null, retryAfterSeconds: 60 }));
    await engine({ transport: t }).syncNow();
    expect(await getOutboxRow(db, 'e1')).toMatchObject({ sync_status: 'pending', last_sync_error: 'http_429', next_attempt_at: T0 + 60_000 });
  });

  // ── 422 envelope errors (CONTRACT §6.5) ─────────────────────────────────

  const http422 = (body: unknown): TransportOutcome => ({ type: 'http', status: 422, body, retryAfterSeconds: null });
  const acceptAll = (req: SyncRequest): TransportOutcome => ({
    type: 'ok',
    response: { server_time: '', results: req.events.map((ev) => accepted(ev.event_id)) },
  });

  it('an unspecific 422 on a single event keeps it pending with backoff (never rejects it)', async () => {
    await putRows(db, [row({ event_id: 'e1' })]);
    await engine({ transport: fakeTransport(() => http422({ message: 'bad' })) }).syncNow();
    expect(await getOutboxRow(db, 'e1')).toMatchObject({
      sync_status: 'pending', last_sync_error: 'invalid_envelope', envelope_failures: 1, sync_hold: null,
      result_message: 'bad', next_attempt_at: T0 + 3750,
    });
  });

  it('422 naming events ({code: invalid_envelope, event_ids}) rejects only those; the rest are sent', async () => {
    await putRows(db, [row({ event_id: 'good', recorded_at_ms: 1 }), row({ event_id: 'bad', recorded_at_ms: 2 })]);
    const t = fakeTransport((req) =>
      req.events.some((e) => e.event_id === 'bad')
        ? http422({ code: 'invalid_envelope', event_ids: ['bad'], message: 'Malformed event' })
        : acceptAll(req),
    );
    const s = await engine({ transport: t }).syncNow();
    expect(await getOutboxRow(db, 'bad')).toMatchObject({
      sync_status: 'rejected', result_status: 'rejected', result_code: 'invalid_envelope', result_message: 'Malformed event',
    });
    expect(await getOutboxRow(db, 'good')).toMatchObject({ sync_status: 'synced' });
    expect(s).toMatchObject({ rejected: 1, synced: 1 });
  });

  it('422 with Laravel validation errors keyed events.<i> rejects the indexed event', async () => {
    await putRows(db, [row({ event_id: 'a', recorded_at_ms: 1 }), row({ event_id: 'b', recorded_at_ms: 2 })]);
    const t = fakeTransport((req) =>
      req.events.length === 2
        ? http422({ message: 'invalid', errors: { 'events.1.device_recorded_at': ['The date is invalid.'] } })
        : acceptAll(req),
    );
    await engine({ transport: t }).syncNow();
    expect(await getOutboxRow(db, 'b')).toMatchObject({ sync_status: 'rejected', result_code: 'invalid_envelope', result_message: 'The date is invalid.' });
    expect(await getOutboxRow(db, 'a')).toMatchObject({ sync_status: 'synced' });
  });

  it('an unspecific 422 on a batch isolates the culprit by re-sending one at a time', async () => {
    await putRows(db, [
      row({ event_id: 'g1', recorded_at_ms: 1 }),
      row({ event_id: 'poison', recorded_at_ms: 2 }),
      row({ event_id: 'g2', recorded_at_ms: 3 }),
    ]);
    const t = fakeTransport((req) => (req.events.some((e) => e.event_id === 'poison') ? http422({ message: 'nope' }) : acceptAll(req)));
    await engine({ transport: t }).syncNow();
    expect(t.requests.map((r) => r.events.map((e) => e.event_id))).toEqual([['g1', 'poison', 'g2'], ['g1'], ['poison'], ['g2']]);
    expect(await countOutbox(db)).toMatchObject({ synced: 2, pending: 1 });
    expect(await getOutboxRow(db, 'poison')).toMatchObject({ sync_status: 'pending', envelope_failures: 1 });
  });

  it('capped 422s put the event on hold: not auto-retried, visible as failed, force retries, success clears it', async () => {
    await putRows(db, [row({ event_id: 'p' })]);
    await db.put('meta', new Date(T0 + 4 * 3_600_000).toISOString(), 'as_of'); // fresh snapshot for the whole test
    let fixed = false;
    const t = fakeTransport((req) => (fixed ? acceptAll(req) : http422({ message: 'still bad' })));
    const e = engine({ transport: t, maxEnvelopeAttempts: 3 });
    for (let i = 0; i < 3; i++) {
      await e.syncNow();
      clock += 3_600_000; // past any backoff
    }
    expect(t.requests).toHaveLength(3);
    expect(await getOutboxRow(db, 'p')).toMatchObject({
      sync_status: 'pending', sync_hold: 'invalid_envelope', envelope_failures: 3, next_attempt_at: null,
    });
    expect(e.getState()).toMatchObject({ status: 'failed', held: 1, counts: { pending: 1 }, next_retry_at: null });

    await e.syncNow(); // held → not sent automatically
    expect(t.requests).toHaveLength(3);

    fixed = true;
    await e.syncNow({ force: true }); // manual retry
    expect(t.requests).toHaveLength(4);
    expect(await getOutboxRow(db, 'p')).toMatchObject({ sync_status: 'synced', sync_hold: null, envelope_failures: 0 });
    expect(e.getState()).toMatchObject({ held: 0, status: 'online' });
  });

  // ── timeout / replay ─────────────────────────────────────────────────────

  it('timeout keeps the event pending; replay returns the original result → synced', async () => {
    await putRows(db, [row({ event_id: 'e1' })]);
    let server: 'timeout' | 'replay' = 'timeout';
    const t = fakeTransport((req): TransportOutcome =>
      server === 'timeout'
        ? { type: 'timeout' }
        : {
            type: 'ok',
            response: {
              server_time: '',
              results: req.events.map((ev) => ({ ...accepted(ev.event_id), status: 'duplicate', code: 'event_replayed', attendance_id: 'att-from-first-try' })),
            },
          },
    );
    const e = engine({ transport: t });
    const first = await e.syncNow();
    expect(first.stoppedBy).toBe('timeout');
    expect(await getOutboxRow(db, 'e1')).toMatchObject({ sync_status: 'pending', last_sync_error: 'timeout', sync_attempts: 1 });
    expect(e.getState()).toMatchObject({ status: 'failed', last_error: 'timeout' });

    server = 'replay';
    clock += 3_600_000;
    await e.syncNow();
    expect(t.requests.map((r) => r.events[0].event_id)).toEqual(['e1', 'e1']); // same idempotency key
    expect(await getOutboxRow(db, 'e1')).toMatchObject({ sync_status: 'synced', official_id: 'att-from-first-try', last_sync_error: null });
  });

  it('network errors keep events pending', async () => {
    await putRows(db, [row({ event_id: 'e1' }), row({ event_id: 'e2' })]);
    await engine({ transport: fakeTransport(() => ({ type: 'network', error: 'Failed to fetch' })) }).syncNow();
    expect(await countOutbox(db)).toMatchObject({ pending: 2, syncing: 0 });
    expect(await getOutboxRow(db, 'e1')).toMatchObject({ last_sync_error: 'network:Failed to fetch' });
  });

  // ── auth pauses ──────────────────────────────────────────────────────────

  it.each([
    ['401', { type: 'http', status: 401, body: { error: 'Unauthorized' }, retryAfterSeconds: null } as TransportOutcome, 'auth_required'],
    ['redirect to /login', { type: 'auth_redirect' } as TransportOutcome, 'auth_required'],
    ['403 device revoked', { type: 'http', status: 403, body: { code: 'device_revoked' }, retryAfterSeconds: null } as TransportOutcome, 'device_revoked'],
    ['403 device mismatch', { type: 'http', status: 403, body: { code: 'device_mismatch', error: 'device bound elsewhere' }, retryAfterSeconds: null } as TransportOutcome, 'device_mismatch'],
    ['403 other (message mentions device, no device code)', { type: 'http', status: 403, body: { code: 'permission_denied', message: 'device x' }, retryAfterSeconds: null } as TransportOutcome, 'forbidden'],
    ['403 other', { type: 'http', status: 403, body: { error: 'Forbidden' }, retryAfterSeconds: null } as TransportOutcome, 'forbidden'],
  ])('%s pauses the engine without touching events', async (_label, outcome, reason) => {
    const original = row({ event_id: 'e1', sync_attempts: 2, next_attempt_at: null, last_sync_error: 'http_503' });
    await putRows(db, [original]);
    const t = fakeTransport(() => outcome);
    const e = engine({ transport: t });
    const s = await e.syncNow();
    expect(s.stoppedBy).toBe(reason);
    expect(await getOutboxRow(db, 'e1')).toEqual(original);
    expect(e.getState()).toMatchObject({ paused: reason, status: 'failed' });

    // paused: no further requests until resume()
    expect(await e.syncNow()).toMatchObject({ ran: false, skipped: 'paused' });
    expect(t.requests).toHaveLength(1);
  });

  it('resume() after re-login syncs the kept events', async () => {
    await putRows(db, [row({ event_id: 'e1' })]);
    let authed = false;
    const t = fakeTransport((req) =>
      authed
        ? { type: 'ok', response: { server_time: '', results: req.events.map((ev) => accepted(ev.event_id)) } }
        : { type: 'http', status: 401, body: null, retryAfterSeconds: null },
    );
    const e = engine({ transport: t });
    await e.syncNow();
    authed = true;
    await e.resume();
    expect(await getOutboxRow(db, 'e1')).toMatchObject({ sync_status: 'synced' });
    expect(e.getState().paused).toBeNull();
  });

  it('HIGH-1: two users on one browser share the device id and both sync normally', async () => {
    // Fake server applying CONTRACT §6.1: binding per (device_id, user_id).
    const bindings = new Map<string, string>(); // `${device}|${user}` → gym
    const serverFor = (userId: string, gymId: string) =>
      fakeTransport((req) => {
        const key = `${req.device_id}|${userId}`;
        const bound = bindings.get(key);
        if (bound && bound !== gymId) return { type: 'http', status: 403, body: { code: 'device_mismatch' }, retryAfterSeconds: null };
        bindings.set(key, gymId);
        return acceptAll(req);
      });
    const dbA = await openOfflineDb('gym-1', 'alice');
    const dbB = await openOfflineDb('gym-1', 'bob');
    await enablePolicy(dbA);
    await enablePolicy(dbB);
    await putRows(dbA, [row({ event_id: 'a1' })]);
    await putRows(dbB, [row({ event_id: 'b1', actor_user_id: 'bob' })]);
    const tA = serverFor('alice', 'gym-1');
    const tB = serverFor('bob', 'gym-1');
    const mk = (d: OfflineDB, t: SyncTransport) =>
      createSyncEngine({ db: d, deviceId: DEVICE, transport: t, lock: noLock, now: () => clock, isOnline: () => true, broadcast: false });
    const sA = await mk(dbA, tA).syncNow();
    const sB = await mk(dbB, tB).syncNow();
    expect(sA).toMatchObject({ synced: 1 });
    expect(sB).toMatchObject({ synced: 1 });
    expect(sB.stoppedBy).toBeUndefined();
    expect(tA.requests[0].device_id).toBe(tB.requests[0].device_id);
    expect(await getOutboxRow(dbB, 'b1')).toMatchObject({ sync_status: 'synced' });
    // the same user moving the device to another gym is a mismatch → distinct pause reason
    const tOther = serverFor('alice', 'gym-2');
    const dbA2 = await openOfflineDb('gym-2', 'alice');
    await putRows(dbA2, [row({ event_id: 'a2', gym_id: 'gym-2' })]);
    const e2 = mk(dbA2, tOther);
    expect((await e2.syncNow()).stoppedBy).toBe('device_mismatch');
    expect(e2.getState().paused).toBe('device_mismatch');
    expect(await getOutboxRow(dbA2, 'a2')).toMatchObject({ sync_status: 'pending', sync_attempts: 0 });
  });

  // ── crash recovery ───────────────────────────────────────────────────────

  it('recovers rows stuck in syncing (crash mid-sync) and sends them', async () => {
    await putRows(db, [row({ event_id: 'stuck', sync_status: 'syncing', sync_started_at: T0 - 60_000, sync_attempts: 1 })]);
    const t = fakeTransport();
    const s = await engine({ transport: t }).syncNow();
    expect(s.recovered).toBe(1);
    expect(t.requests[0].events.map((ev) => ev.event_id)).toEqual(['stuck']);
    expect(await getOutboxRow(db, 'stuck')).toMatchObject({ sync_status: 'synced', sync_attempts: 2 });
  });

  it('rows are `syncing` while the request is in flight', async () => {
    await putRows(db, [row({ event_id: 'e1' })]);
    const gate = deferred<TransportOutcome>();
    const t = fakeTransport(() => gate.promise);
    const p = engine({ transport: t }).syncNow();
    await vi.waitFor(() => expect(t.requests).toHaveLength(1));
    expect(await getOutboxRow(db, 'e1')).toMatchObject({ sync_status: 'syncing' });
    gate.resolve({ type: 'ok', response: { server_time: '', results: [accepted('e1')] } });
    await p;
    expect(await getOutboxRow(db, 'e1')).toMatchObject({ sync_status: 'synced' });
  });

  // ── single-flight ────────────────────────────────────────────────────────

  it('single-flight in one tab: concurrent syncNow calls share one run', async () => {
    await putRows(db, [row({ event_id: 'e1' })]);
    const gate = deferred<TransportOutcome>();
    const t = fakeTransport(() => gate.promise);
    const e = engine({ transport: t });
    const a = e.syncNow();
    const b = e.syncNow();
    gate.resolve({ type: 'ok', response: { server_time: '', results: [accepted('e1')] } });
    await Promise.all([a, b]);
    expect(t.requests).toHaveLength(1);
  });

  it('single-flight across tabs via Web Locks: the second engine is skipped (busy)', async () => {
    await putRows(db, [row({ event_id: 'e1' })]);
    const locks = fakeLockManager();
    const gate = deferred<TransportOutcome>();
    const t = fakeTransport(() => gate.promise);
    const tabA = engine({ transport: t, lock: createWebLock('L', locks) });
    const tabB = engine({ transport: t, lock: createWebLock('L', locks) });
    const a = tabA.syncNow();
    await vi.waitFor(() => expect(t.requests).toHaveLength(1));
    expect(await tabB.syncNow()).toMatchObject({ ran: false, skipped: 'busy' });
    gate.resolve({ type: 'ok', response: { server_time: '', results: [accepted('e1')] } });
    await a;
    expect(t.requests).toHaveLength(1);
  });

  it('single-flight across tabs via the IndexedDB lease fallback', async () => {
    await putRows(db, [row({ event_id: 'e1' })]);
    const gate = deferred<TransportOutcome>();
    const t = fakeTransport(() => gate.promise);
    const tabA = engine({ transport: t, lock: createLeaseLock(db, { owner: 'A', now: () => clock }) });
    const tabB = engine({ transport: t, lock: createLeaseLock(db, { owner: 'B', now: () => clock }) });
    const a = tabA.syncNow();
    await vi.waitFor(() => expect(t.requests).toHaveLength(1));
    expect(await tabB.syncNow()).toMatchObject({ ran: false, skipped: 'busy' });
    gate.resolve({ type: 'ok', response: { server_time: '', results: [accepted('e1')] } });
    await a;
    expect(await getMeta(db, 'sync_lease')).toBeUndefined(); // released
  });

  it('lease fallback: an expired lease from a crashed tab can be taken over', async () => {
    await db.put('meta', { owner: 'dead-tab', expires_at: T0 - 1 }, 'sync_lease');
    await putRows(db, [row({ event_id: 'e1' })]);
    const s = await engine({ lock: createLeaseLock(db, { owner: 'B', now: () => clock }) }).syncNow();
    expect(s.ran).toBe(true);
  });

  // ── state / subscribe / lifecycle ────────────────────────────────────────

  it('exposes observable state with counts, last sync, data age and status', async () => {
    await db.put('meta', new Date(T0 - 2 * 3_600_000).toISOString(), 'as_of');
    await putRows(db, [row({ event_id: 'e1' })]);
    const e = engine();
    const seen: SyncEngineState[] = [];
    const unsub = e.subscribe((s) => seen.push(s));
    await e.refresh();
    expect(e.getState()).toMatchObject({ status: 'pending', counts: { pending: 1 }, data_age_ms: 7_200_000, data_expired: false });
    await e.syncNow();
    expect(e.getState()).toMatchObject({
      status: 'online',
      counts: { pending: 0, synced: 1 },
      last_successful_sync_at: new Date(T0).toISOString(),
      held: 0,
      // fake server_time = 10:00:00Z = T0 → offset 0
      clock_offset_ms: 0,
    });
    expect(seen.some((s) => s.status === 'syncing')).toBe(true);
    unsub();
  });

  it('status: offline when the browser is offline (and no request is made)', async () => {
    await putRows(db, [row()]);
    const t = fakeTransport();
    const e = engine({ transport: t, isOnline: () => false });
    expect(await e.syncNow()).toMatchObject({ ran: false, skipped: 'offline' });
    expect(e.getState().status).toBe('offline');
    expect(t.requests).toHaveLength(0);
  });

  it('status: expired when cached data is older than max_data_age_hours', async () => {
    await db.put('meta', new Date(T0 - 25 * 3_600_000).toISOString(), 'as_of');
    const e = engine();
    await e.refresh();
    expect(e.getState()).toMatchObject({ status: 'expired', data_expired: true });
  });

  it('reconnect (`online` event) syncs backing-off rows straight away, but not held rows', async () => {
    await putRows(db, [
      row({ event_id: 'backoff', next_attempt_at: T0 + 600_000, sync_attempts: 3, last_sync_error: 'network:x', recorded_at_ms: 1 }),
      row({ event_id: 'held', sync_hold: 'invalid_envelope', envelope_failures: 5, recorded_at_ms: 2 }),
    ]);
    const t = fakeTransport();
    const e = engine({ transport: t });
    await e.syncNow(); // routine run: nothing due
    expect(t.requests).toHaveLength(0);
    const stop = e.startSyncLifecycle({ intervalMs: 60_000, immediate: false });
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(t.requests).toHaveLength(1));
    expect(t.requests[0].events.map((x) => x.event_id)).toEqual(['backoff']);
    stop();
    await vi.waitFor(async () => expect((await getOutboxRow(db, 'backoff'))?.sync_status).toBe('synced'));
    expect(await getOutboxRow(db, 'held')).toMatchObject({ sync_status: 'pending', sync_hold: 'invalid_envelope' });
  });

  it('an explicit ignoreBackoff request during an in-flight routine run runs right after it', async () => {
    await putRows(db, [row({ event_id: 'due', recorded_at_ms: 1 }), row({ event_id: 'later', next_attempt_at: T0 + 600_000, recorded_at_ms: 2 })]);
    const gate = deferred<TransportOutcome>();
    let n = 0;
    const t = fakeTransport((req) => (++n === 1 ? gate.promise : { type: 'ok', response: { server_time: '', results: req.events.map((x) => accepted(x.event_id)) } }));
    const e = engine({ transport: t });
    const routine = e.syncNow();
    await vi.waitFor(() => expect(t.requests).toHaveLength(1));
    const reconnect = e.syncNow({ ignoreBackoff: true });
    gate.resolve({ type: 'ok', response: { server_time: '', results: [accepted('due')] } });
    await routine;
    await reconnect;
    expect(t.requests.map((r) => r.events.map((x) => x.event_id))).toEqual([['due'], ['later']]);
  });

  it('startSyncLifecycle: syncs immediately, on `online`, on visibilitychange and on interval; stop() detaches', async () => {
    const t = fakeTransport();
    const e = engine({ transport: t });
    await putRows(db, [row({ event_id: 'a' })]);
    const stop = e.startSyncLifecycle({ intervalMs: 60_000 });
    await vi.waitFor(() => expect(t.requests).toHaveLength(1));

    await putRows(db, [row({ event_id: 'b' })]);
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(t.requests).toHaveLength(2));

    await putRows(db, [row({ event_id: 'c' })]);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(t.requests).toHaveLength(3));
    stop();

    // interval trigger (separate lifecycle with a short real interval)
    await putRows(db, [row({ event_id: 'd' })]);
    const stop2 = e.startSyncLifecycle({ intervalMs: 30, immediate: false });
    await vi.waitFor(() => expect(t.requests).toHaveLength(4));
    stop2();
    // under load a run started just before stop() may still be finishing: let it settle
    await vi.waitFor(() => expect(e.getState().running).toBe(false));
    const sentBefore = t.requests.length;

    await putRows(db, [row({ event_id: 'z' })]);
    window.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 100));
    expect(t.requests).toHaveLength(sentBefore); // detached: nothing new is sent
    expect(t.requests.flatMap((r) => r.events.map((x) => x.event_id))).not.toContain('z');
  });
});

describe('fetch transport', () => {
  const req: SyncRequest = { device_id: 'dev-1', app: 'admin', app_version: '1', events: [] };

  it('posts same-origin with manual redirect and the contract headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ server_time: 'x', results: [] }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const t = createFetchTransport({ fetchImpl, clientInfo: { app: 'admin', appVersion: '2.0', appBuild: 'abc', platform: 'web' } });
    expect(await t.send(req, { timeoutMs: 1000 })).toEqual({ type: 'ok', response: { server_time: 'x', results: [] } });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/attendance/sync');
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', redirect: 'manual' });
    expect(init.headers).toMatchObject({
      'X-Device-Id': 'dev-1', 'X-App': 'admin', 'X-App-Version': '2.0', 'X-App-Build': 'abc', 'X-App-Platform': 'web',
    });
  });

  it('treats a redirect (middleware → /login) as auth_redirect', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 307, headers: { location: '/login' } }));
    expect(await createFetchTransport({ fetchImpl }).send(req, { timeoutMs: 1000 })).toEqual({ type: 'auth_redirect' });
  });

  it('returns http outcome with Retry-After', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'slow down' }), { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '30' } }),
    );
    expect(await createFetchTransport({ fetchImpl }).send(req, { timeoutMs: 1000 })).toEqual({
      type: 'http', status: 429, body: { message: 'slow down' }, retryAfterSeconds: 30,
    });
  });

  it('a 200 HTML page (e.g. login page) is not treated as success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    expect(await createFetchTransport({ fetchImpl }).send(req, { timeoutMs: 1000 })).toEqual({ type: 'network', error: 'invalid_response' });
  });

  it('aborts after timeoutMs and reports a timeout', async () => {
    const fetchImpl = vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
    );
    expect(await createFetchTransport({ fetchImpl: fetchImpl as unknown as typeof fetch }).send(req, { timeoutMs: 10 })).toEqual({ type: 'timeout' });
  });

  it('network failure → network outcome', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await createFetchTransport({ fetchImpl }).send(req, { timeoutMs: 1000 })).toEqual({ type: 'network', error: 'Failed to fetch' });
  });
});
