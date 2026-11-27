/**
 * Offline attendance — sync engine (dashboard).
 *
 * Contract: docs/offline-attendance/CONTRACT.md §2 + §5.
 *  - single-flight per database: in-tab promise memo + cross-tab Web Lock
 *    (`navigator.locks`), falling back to an IndexedDB lease when Web Locks
 *    are unavailable;
 *  - crash recovery: rows stuck in `syncing` go back to `pending` (only ever
 *    done while holding the lock, so it can't steal another tab's batch);
 *  - ordering by device_recorded_at then created_at; batches ≤ policy.max_batch (≤50);
 *  - accepted/duplicate → synced, rejected → rejected (kept, never deleted),
 *    error / network / timeout / 5xx / 429 → pending with exponential backoff + jitter;
 *  - 401 (or a redirect to /login) → pause `auth_required`, 403 → pause
 *    (`device_revoked` / `device_mismatch` / `forbidden`, §6.1); paused
 *    batches are restored exactly as they were (attempts not counted);
 *  - 422 envelope errors (§6.5): events the 422 body names are rejected
 *    `invalid_envelope`; otherwise the batch is re-sent one event at a time to
 *    isolate the culprit, and a single event that keeps getting 422 is backed
 *    off and, after `maxEnvelopeAttempts`, put on hold (stays `pending`, not
 *    auto-retried, counted in `state.held`, status `failed`);
 *  - the engine NEVER deletes an event.
 *
 * Transport, lock, clock and randomness are injectable for tests.
 */
import {
  countOutbox,
  getMeta,
  listDueOutbox,
  listOutboxByStatus,
  pendingSummary,
  recoverSyncingRows,
  setMeta,
  type OfflineDB,
} from './db';
import { defaultMonoNow, recordServerTime } from './server-clock';
import {
  DEFAULT_POLICY,
  EVENT_WIRE_KEYS,
  SERVER_MAX_BATCH,
  type OfflineEvent,
  type OfflinePolicy,
  type OutboxRow,
  type PauseReason,
  type SyncEngineState,
  type SyncRequest,
  type SyncResponse,
  type SyncResult,
} from './types';

// ── client identity headers (CONTRACT "Headers") ────────────────────────────

export interface ClientInfo {
  app: 'admin';
  appVersion: string;
  appBuild: string;
  platform: string;
}

export function defaultClientInfo(): ClientInfo {
  return {
    app: 'admin',
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
    appBuild: process.env.NEXT_PUBLIC_APP_BUILD || 'dev',
    platform: 'web',
  };
}

export function clientHeaders(deviceId: string, info: ClientInfo = defaultClientInfo()): Record<string, string> {
  return {
    'X-Device-Id': deviceId,
    'X-App': info.app,
    'X-App-Version': info.appVersion,
    'X-App-Build': info.appBuild,
    'X-App-Platform': info.platform,
  };
}

// ── transport ───────────────────────────────────────────────────────────────

export type TransportOutcome =
  | { type: 'ok'; response: SyncResponse }
  | { type: 'http'; status: number; body: unknown; retryAfterSeconds: number | null }
  /** the request was redirected (e.g. middleware → /login): treat as auth_required */
  | { type: 'auth_redirect' }
  | { type: 'network'; error: string }
  | { type: 'timeout' };

export interface SyncTransport {
  send(request: SyncRequest, opts: { timeoutMs: number }): Promise<TransportOutcome>;
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  if (Number.isFinite(n) && n >= 0) return n;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, Math.round((date - Date.now()) / 1000));
}

function isSyncResponse(body: unknown): body is SyncResponse {
  return (
    typeof body === 'object' &&
    body !== null &&
    Array.isArray((body as SyncResponse).results)
  );
}

/** Same-origin fetch transport → Next proxy `/api/attendance/sync` (httpOnly cookie auth). */
export function createFetchTransport(
  opts: { endpoint?: string; fetchImpl?: typeof fetch; clientInfo?: ClientInfo } = {},
): SyncTransport {
  const endpoint = opts.endpoint ?? '/api/attendance/sync';
  return {
    async send(request, { timeoutMs }) {
      const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      try {
        const res = await fetchImpl(endpoint, {
          method: 'POST',
          credentials: 'same-origin',
          redirect: 'manual',
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...clientHeaders(request.device_id, opts.clientInfo),
          },
          body: JSON.stringify(request),
        });
        if (res.type === 'opaqueredirect' || res.redirected || (res.status >= 300 && res.status < 400)) {
          return { type: 'auth_redirect' };
        }
        const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
        const body: unknown = isJson ? await res.json().catch(() => null) : null;
        if (res.ok) {
          if (isSyncResponse(body)) return { type: 'ok', response: body };
          return { type: 'network', error: 'invalid_response' };
        }
        return {
          type: 'http',
          status: res.status,
          body,
          retryAfterSeconds: parseRetryAfter(res.headers.get('retry-after')),
        };
      } catch (err) {
        if (timedOut) return { type: 'timeout' };
        return { type: 'network', error: err instanceof Error ? err.message : String(err) };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

// ── single-flight lock ──────────────────────────────────────────────────────

export type LockRun<T> = { acquired: true; value: T } | { acquired: false };

export interface SyncLock {
  run<T>(fn: () => Promise<T>): Promise<LockRun<T>>;
}

interface LockManagerLike {
  request<T>(
    name: string,
    options: { ifAvailable: boolean },
    cb: (lock: unknown) => Promise<T>,
  ): Promise<T>;
}

function getLockManager(): LockManagerLike | null {
  const nav = (globalThis as { navigator?: { locks?: LockManagerLike } }).navigator;
  return nav?.locks && typeof nav.locks.request === 'function' ? nav.locks : null;
}

/** Cross-tab lock via the Web Locks API (released automatically if the tab dies). */
export function createWebLock(name: string, locks: LockManagerLike): SyncLock {
  return {
    run<T>(fn: () => Promise<T>) {
      return locks.request<LockRun<T>>(name, { ifAvailable: true }, async (lock) => {
        if (!lock) return { acquired: false };
        return { acquired: true, value: await fn() };
      });
    },
  };
}

/**
 * Fallback lock: a lease record in the `meta` store. Acquire is a single
 * readwrite transaction (IndexedDB serializes those per store), the lease is
 * renewed while running and expires if the holder crashes.
 */
export function createLeaseLock(
  db: OfflineDB,
  opts: { ttlMs?: number; owner?: string; now?: () => number } = {},
): SyncLock {
  const ttlMs = opts.ttlMs ?? 60_000;
  const owner = opts.owner ?? globalThis.crypto.randomUUID();
  const now = opts.now ?? (() => Date.now());

  async function tryAcquire(): Promise<boolean> {
    const tx = db.transaction('meta', 'readwrite');
    const lease = (await tx.store.get('sync_lease')) as { owner: string; expires_at: number } | undefined;
    if (lease && lease.owner !== owner && lease.expires_at > now()) {
      await tx.done;
      return false;
    }
    await tx.store.put({ owner, expires_at: now() + ttlMs }, 'sync_lease');
    await tx.done;
    return true;
  }

  async function release(): Promise<void> {
    const tx = db.transaction('meta', 'readwrite');
    const lease = (await tx.store.get('sync_lease')) as { owner: string } | undefined;
    if (lease?.owner === owner) await tx.store.delete('sync_lease');
    await tx.done;
  }

  return {
    async run<T>(fn: () => Promise<T>): Promise<LockRun<T>> {
      if (!(await tryAcquire())) return { acquired: false };
      const renew = setInterval(() => {
        void tryAcquire().catch(() => undefined);
      }, Math.max(1_000, Math.floor(ttlMs / 3)));
      try {
        return { acquired: true, value: await fn() };
      } finally {
        clearInterval(renew);
        await release().catch(() => undefined);
      }
    },
  };
}

export function createDefaultLock(db: OfflineDB): SyncLock {
  const locks = getLockManager();
  return locks ? createWebLock(`clby-attendance-sync:${db.name}`, locks) : createLeaseLock(db);
}

// ── backoff ─────────────────────────────────────────────────────────────────

/**
 * Exponential backoff with "equal jitter": delay = d/2 + random·d/2 where
 * d = min(max, base·2^(attempt-1)). `attempt` is ≥1 (attempts already made).
 */
export function computeBackoffMs(
  attempt: number,
  policy: Pick<OfflinePolicy, 'retry_base_seconds' | 'retry_max_seconds'>,
  random: () => number = Math.random,
): number {
  const base = Math.max(1, policy.retry_base_seconds) * 1000;
  const max = Math.max(base, policy.retry_max_seconds * 1000);
  const exp = Math.min(max, base * 2 ** Math.max(0, attempt - 1));
  return Math.round(exp / 2 + random() * (exp / 2));
}

// ── engine ──────────────────────────────────────────────────────────────────

export interface SyncEngineOptions {
  db: OfflineDB;
  deviceId: string;
  transport?: SyncTransport;
  lock?: SyncLock;
  now?: () => number;
  /** monotonic clock for the server-time anchor (default performance.now) */
  monoNow?: () => number;
  random?: () => number;
  clientInfo?: ClientInfo;
  /** request timeout; a timeout leaves events pending (default 30 s) */
  timeoutMs?: number;
  isOnline?: () => boolean;
  /** cross-tab change notifications via BroadcastChannel (default true when available) */
  broadcast?: boolean;
  /** 422s a single event may get before it is put on hold (default 5, §6.5) */
  maxEnvelopeAttempts?: number;
}

export interface SyncRunSummary {
  ran: boolean;
  skipped?: 'paused' | 'busy' | 'offline';
  batches: number;
  sent: number;
  synced: number;
  rejected: number;
  retrying: number;
  recovered: number;
  /** last transport problem, if the run stopped early */
  stoppedBy?: string;
}

export interface LifecycleOptions {
  intervalMs?: number;
  /** run immediately on start (default true) */
  immediate?: boolean;
}

export interface SyncEngine {
  /**
   * `force`: manual "sync now" — every pending row, ignoring backoff AND holds.
   * `ignoreBackoff`: e.g. on reconnect — pending rows due or backing off, but
   * rows on hold (capped 422s) stay held.
   */
  syncNow(opts?: { force?: boolean; ignoreBackoff?: boolean }): Promise<SyncRunSummary>;
  getState(): SyncEngineState;
  subscribe(listener: (state: SyncEngineState) => void): () => void;
  /** recompute counts / data age from the database and notify subscribers */
  refresh(): Promise<SyncEngineState>;
  /** clear a pause (call after the SAME user re-authenticates) and sync */
  resume(): Promise<SyncRunSummary>;
  pause(reason: PauseReason): void;
  /** wire online / visibilitychange / interval triggers; returns a stop function */
  startSyncLifecycle(opts?: LifecycleOptions): () => void;
  dispose(): void;
}

function toWireEvent(row: OutboxRow): OfflineEvent {
  const out = {} as Record<string, unknown>;
  for (const k of EVENT_WIRE_KEYS) out[k] = row[k];
  return out as unknown as OfflineEvent;
}

/** CONTRACT §6.1: device_mismatch and device_revoked are distinct pause reasons. */
export function pauseReasonFor403(body: unknown): PauseReason {
  const code = (body as { code?: unknown } | null)?.code;
  if (code === 'device_revoked') return 'device_revoked';
  if (code === 'device_mismatch') return 'device_mismatch';
  return 'forbidden';
}

/**
 * Event ids a 422 body explicitly blames (§6.5): either
 * `{ code: 'invalid_envelope', event_ids: [...] }` or Laravel validation
 * `errors` keyed `events.<index>[.field]`. Returns id → message.
 */
export function envelopeRejectedIds(body: unknown, batch: { event_id: string }[]): Map<string, string> {
  const out = new Map<string, string>();
  if (!body || typeof body !== 'object') return out;
  const b = body as { code?: unknown; event_ids?: unknown; errors?: unknown; message?: unknown };
  const fallback = typeof b.message === 'string' ? b.message : 'invalid_envelope';
  const inBatch = new Set(batch.map((r) => r.event_id));
  if (b.code === 'invalid_envelope' && Array.isArray(b.event_ids)) {
    for (const id of b.event_ids) if (typeof id === 'string' && inBatch.has(id)) out.set(id, fallback);
  }
  if (b.errors && typeof b.errors === 'object') {
    for (const [key, msgs] of Object.entries(b.errors as Record<string, unknown>)) {
      const m = /^events\.(\d+)(?:\.|$)/.exec(key);
      if (!m) continue;
      const row = batch[Number(m[1])];
      if (!row) continue;
      const msg = Array.isArray(msgs) && typeof msgs[0] === 'string' ? msgs[0] : fallback;
      if (!out.has(row.event_id)) out.set(row.event_id, msg);
    }
  }
  return out;
}

export function createSyncEngine(options: SyncEngineOptions): SyncEngine {
  const { db, deviceId } = options;
  const transport = options.transport ?? createFetchTransport({ clientInfo: options.clientInfo });
  const lock = options.lock ?? createDefaultLock(db);
  const now = options.now ?? (() => Date.now());
  const random = options.random ?? Math.random;
  const monoNow = options.monoNow ?? defaultMonoNow;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const clientInfo = options.clientInfo ?? defaultClientInfo();
  const maxEnvelopeAttempts = Math.max(1, options.maxEnvelopeAttempts ?? 5);
  /** event ids to send one at a time after an unspecific 422 on a multi-event batch */
  const isolate = new Set<string>();
  const isOnline =
    options.isOnline ??
    (() => {
      const nav = (globalThis as { navigator?: { onLine?: boolean } }).navigator;
      return nav?.onLine ?? true;
    });

  let inflight: Promise<SyncRunSummary> | null = null;
  let paused: PauseReason | null = null;
  let running = false;
  let lastError: string | null = null;
  let disposed = false;
  const listeners = new Set<(s: SyncEngineState) => void>();

  let state: SyncEngineState = {
    status: 'online',
    online: isOnline(),
    running: false,
    paused: null,
    counts: { pending: 0, syncing: 0, synced: 0, rejected: 0 },
    last_successful_sync_at: null,
    last_attempt_at: null,
    last_error: null,
    data_as_of: null,
    data_age_ms: null,
    data_expired: true,
    next_retry_at: null,
    held: 0,
    clock_offset_ms: null,
  };

  const channelName = `clby-offline-sync:${db.name}`;
  const channel: BroadcastChannel | null =
    options.broadcast !== false && typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(channelName)
      : null;
  if (channel) {
    channel.onmessage = () => {
      void refresh().catch(() => undefined);
    };
  }

  function emit() {
    for (const l of listeners) {
      try {
        l(state);
      } catch {
        // a broken listener must not break the engine
      }
    }
  }

  async function refresh(): Promise<SyncEngineState> {
    const [counts, policy, asOf, lastOk, lastAttempt, pend, offset] = await Promise.all([
      countOutbox(db),
      getMeta(db, 'policy'),
      getMeta(db, 'as_of'),
      getMeta(db, 'last_successful_sync_at'),
      getMeta(db, 'last_sync_attempt_at'),
      pendingSummary(db),
      getMeta(db, 'server_clock_offset_ms'),
    ]);
    const p = policy ?? DEFAULT_POLICY;
    const online = isOnline();
    const asOfMs = asOf ? Date.parse(asOf) : NaN;
    const age = Number.isNaN(asOfMs) ? null : Math.max(0, now() - asOfMs);
    const expired = age == null || age > p.max_data_age_hours * 3_600_000;

    let status: SyncEngineState['status'];
    if (running) status = 'syncing';
    else if (!online) status = 'offline';
    else if (paused || pend.held > 0 || (lastError && counts.pending > 0)) status = 'failed';
    else if (expired) status = 'expired';
    else if (counts.pending > 0 || counts.syncing > 0) status = 'pending';
    else status = 'online';

    state = {
      status,
      online,
      running,
      paused,
      counts,
      last_successful_sync_at: lastOk ?? null,
      last_attempt_at: lastAttempt ?? null,
      last_error: lastError,
      data_as_of: asOf ?? null,
      data_age_ms: age,
      data_expired: expired,
      next_retry_at: pend.nextRetryAt,
      held: pend.held,
      clock_offset_ms: offset ?? null,
    };
    emit();
    return state;
  }

  async function markSyncing(batch: OutboxRow[]): Promise<OutboxRow[]> {
    const tx = db.transaction('outbox', 'readwrite');
    const taken: OutboxRow[] = [];
    for (const row of batch) {
      const current = await tx.store.get(row.event_id);
      if (!current || current.sync_status !== 'pending') continue;
      taken.push(current);
      await tx.store.put({ ...current, sync_status: 'syncing', sync_started_at: now() });
    }
    await tx.done;
    return taken;
  }

  /** Put rows back exactly as they were before markSyncing (pause paths). */
  async function restore(rows: OutboxRow[]): Promise<void> {
    const tx = db.transaction('outbox', 'readwrite');
    for (const row of rows) await tx.store.put(row);
    await tx.done;
  }

  async function backoffAll(rows: OutboxRow[], policy: OfflinePolicy, error: string, minDelayMs = 0) {
    const tx = db.transaction('outbox', 'readwrite');
    for (const row of rows) {
      const attempts = row.sync_attempts + 1;
      const delay = Math.max(minDelayMs, computeBackoffMs(attempts, policy, random));
      await tx.store.put({
        ...row,
        sync_status: 'pending',
        sync_started_at: null,
        sync_attempts: attempts,
        next_attempt_at: now() + delay,
        last_sync_error: error,
      });
    }
    await tx.done;
  }

  async function applyResults(rows: OutboxRow[], results: SyncResult[], policy: OfflinePolicy) {
    const byId = new Map<string, SyncResult>();
    for (const r of results) if (r && typeof r.event_id === 'string') byId.set(r.event_id, r);
    const tally = { synced: 0, rejected: 0, retrying: 0 };

    const tx = db.transaction('outbox', 'readwrite');
    for (const row of rows) {
      const r = byId.get(row.event_id);
      const attempts = row.sync_attempts + 1;
      const base = { ...row, sync_started_at: null, sync_attempts: attempts, sync_hold: null, envelope_failures: 0 };
      if (r && (r.status === 'accepted' || r.status === 'duplicate')) {
        tally.synced++;
        await tx.store.put({
          ...base,
          sync_status: 'synced',
          next_attempt_at: null,
          last_sync_error: null,
          result_status: r.status,
          result_code: r.code ?? null,
          result_message: r.message ?? null,
          official_id: r.attendance_id ?? r.service_log_id ?? row.official_id,
          flags: Array.isArray(r.flags) ? r.flags : [],
          server_received_at: r.server_received_at ?? null,
          processed_at: r.processed_at ?? null,
        });
      } else if (r && r.status === 'rejected') {
        tally.rejected++;
        await tx.store.put({
          ...base,
          sync_status: 'rejected',
          next_attempt_at: null,
          last_sync_error: null,
          result_status: 'rejected',
          result_code: r.code ?? null,
          result_message: r.message ?? null,
          flags: Array.isArray(r.flags) ? r.flags : [],
          server_received_at: r.server_received_at ?? null,
          processed_at: r.processed_at ?? null,
        });
      } else {
        // status `error`, unknown status, or no result for this event → retry later
        tally.retrying++;
        await tx.store.put({
          ...base,
          sync_status: 'pending',
          next_attempt_at: now() + computeBackoffMs(attempts, policy, random),
          last_sync_error: r ? `${r.status}:${r.code ?? 'unknown'}` : 'missing_result',
          result_status: r ? r.status : row.result_status,
          result_code: r ? r.code ?? null : row.result_code,
          result_message: r ? r.message ?? null : row.result_message,
          server_received_at: r?.server_received_at ?? row.server_received_at,
        });
      }
    }
    await tx.done;
    return tally;
  }

  /** Keep order; an isolated row (after an unspecific 422) goes alone. */
  function pickBatch(due: OutboxRow[], size: number): OutboxRow[] {
    if (isolate.has(due[0].event_id)) return [due[0]];
    const out: OutboxRow[] = [];
    for (const r of due) {
      if (out.length >= size || isolate.has(r.event_id)) break;
      out.push(r);
    }
    return out;
  }

  async function rejectEnvelope(rows: OutboxRow[], messages: Map<string, string>) {
    const tx = db.transaction('outbox', 'readwrite');
    for (const row of rows) {
      await tx.store.put({
        ...row,
        sync_status: 'rejected',
        sync_started_at: null,
        sync_attempts: row.sync_attempts + 1,
        next_attempt_at: null,
        last_sync_error: null,
        result_status: 'rejected',
        result_code: 'invalid_envelope',
        result_message: messages.get(row.event_id) ?? 'invalid_envelope',
        sync_hold: null,
      });
      isolate.delete(row.event_id);
    }
    await tx.done;
  }

  /** A single event got an unspecific 422: back off; after the cap, hold it. Returns true if held. */
  async function envelopeFailure(row: OutboxRow, policy: OfflinePolicy, body: unknown): Promise<boolean> {
    const failures = (row.envelope_failures ?? 0) + 1;
    const attempts = row.sync_attempts + 1;
    const hold = failures >= maxEnvelopeAttempts;
    const message = (body as { message?: unknown } | null)?.message;
    await db.put('outbox', {
      ...row,
      sync_status: 'pending',
      sync_started_at: null,
      sync_attempts: attempts,
      envelope_failures: failures,
      sync_hold: hold ? 'invalid_envelope' : null,
      next_attempt_at: hold ? null : now() + computeBackoffMs(attempts, policy, random),
      last_sync_error: 'invalid_envelope',
      result_message: typeof message === 'string' ? message : row.result_message,
    });
    return hold;
  }

  async function runLocked(force: boolean, ignoreBackoff = false): Promise<SyncRunSummary> {
    const summary: SyncRunSummary = {
      ran: true,
      batches: 0,
      sent: 0,
      synced: 0,
      rejected: 0,
      retrying: 0,
      recovered: 0,
    };
    summary.recovered = await recoverSyncingRows(db);
    const policy = (await getMeta(db, 'policy')) ?? DEFAULT_POLICY;
    const batchSize = Math.max(1, Math.min(SERVER_MAX_BATCH, Math.floor(policy.max_batch) || SERVER_MAX_BATCH));

    const pendingNow = force || ignoreBackoff ? await listOutboxByStatus(db, 'pending') : null;
    const initial = force
      ? pendingNow!
      : ignoreBackoff
        ? pendingNow!.filter((r) => !r.sync_hold)
        : await listDueOutbox(db, now());
    // both modes pin the run to the rows that were eligible when it started
    const pinned = force || ignoreBackoff;
    // + initial.length: 422 isolation may re-send every row once on its own
    const maxBatches = Math.ceil(initial.length / batchSize) + initial.length + 1;
    // `force` ignores backoff for the rows that were pending when the run started.
    const forced = new Set(pinned ? initial.map((r) => r.event_id) : []);
    lastError = null;

    while (summary.batches < maxBatches) {
      const due = pinned
        ? (await listOutboxByStatus(db, 'pending')).filter((r) => forced.has(r.event_id))
        : await listDueOutbox(db, now());
      if (due.length === 0) break;
      const batch = await markSyncing(pickBatch(due, batchSize));
      for (const r of batch) forced.delete(r.event_id);
      if (batch.length === 0) break;

      summary.batches++;
      summary.sent += batch.length;
      await setMeta(db, 'last_sync_attempt_at', new Date(now()).toISOString());
      void refresh().catch(() => undefined);

      const outcome = await transport.send(
        {
          device_id: deviceId,
          app: clientInfo.app,
          app_version: clientInfo.appVersion,
          events: batch.map(toWireEvent),
        },
        { timeoutMs },
      );
      const receivedAt = { wall: now(), mono: monoNow() };

      if (outcome.type === 'ok') {
        const t = await applyResults(batch, outcome.response.results, policy);
        summary.synced += t.synced;
        summary.rejected += t.rejected;
        summary.retrying += t.retrying;
        await setMeta(db, 'last_successful_sync_at', new Date(now()).toISOString());
        await recordServerTime(db, outcome.response.server_time, receivedAt);
        continue;
      }

      // Pause paths: auth problems never consume attempts or alter events.
      if (outcome.type === 'auth_redirect' || (outcome.type === 'http' && outcome.status === 401)) {
        await restore(batch);
        paused = 'auth_required';
        lastError = 'auth_required';
        summary.stoppedBy = 'auth_required';
        break;
      }
      if (outcome.type === 'http' && outcome.status === 403) {
        await restore(batch);
        paused = pauseReasonFor403(outcome.body);
        lastError = paused;
        summary.stoppedBy = paused;
        break;
      }

      if (outcome.type === 'http' && outcome.status === 422) {
        lastError = 'invalid_envelope';
        const blamed = envelopeRejectedIds(outcome.body, batch);
        if (blamed.size > 0) {
          await rejectEnvelope(batch.filter((r) => blamed.has(r.event_id)), blamed);
          const rest = batch.filter((r) => !blamed.has(r.event_id));
          await restore(rest);
          if (pinned) for (const r of rest) forced.add(r.event_id);
          summary.rejected += blamed.size;
          continue;
        }
        if (batch.length > 1) {
          // Unspecific 422: re-send these one at a time to find the culprit.
          for (const r of batch) isolate.add(r.event_id);
          await restore(batch);
          if (pinned) for (const r of batch) forced.add(r.event_id);
          continue;
        }
        const held = await envelopeFailure(batch[0], policy, outcome.body);
        summary.retrying++;
        if (held) summary.stoppedBy = 'invalid_envelope';
        continue;
      }

      // Transient: keep pending, back off, stop this run.
      let error: string;
      let minDelay = 0;
      if (outcome.type === 'timeout') error = 'timeout';
      else if (outcome.type === 'network') error = `network:${outcome.error}`;
      else {
        error = `http_${outcome.status}`;
        if (outcome.status === 429 && outcome.retryAfterSeconds != null) {
          minDelay = outcome.retryAfterSeconds * 1000;
        }
      }
      await backoffAll(batch, policy, error, minDelay);
      summary.retrying += batch.length;
      lastError = error;
      summary.stoppedBy = error;
      break;
    }
    return summary;
  }

  function notifyOtherTabs() {
    try {
      channel?.postMessage({ type: 'changed' });
    } catch {
      // channel closed
    }
  }

  async function syncNow(opts: { force?: boolean; ignoreBackoff?: boolean } = {}): Promise<SyncRunSummary> {
    const empty = { batches: 0, sent: 0, synced: 0, rejected: 0, retrying: 0, recovered: 0 };
    if (disposed) return { ran: false, skipped: 'paused', ...empty };
    if (inflight) {
      // A routine run is in flight: honour an explicit "now" request right after it.
      if (opts.force || opts.ignoreBackoff) return inflight.then(() => syncNow(opts));
      return inflight;
    }
    if (paused) {
      await refresh();
      return { ran: false, skipped: 'paused', ...empty };
    }
    if (!isOnline()) {
      await refresh();
      return { ran: false, skipped: 'offline', ...empty };
    }

    inflight = (async () => {
      try {
        const res = await lock.run(async () => {
          running = true;
          try {
            return await runLocked(!!opts.force, !!opts.ignoreBackoff);
          } finally {
            running = false;
          }
        });
        if (!res.acquired) return { ran: false, skipped: 'busy' as const, ...empty };
        notifyOtherTabs();
        return res.value;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        inflight = null;
        await refresh().catch(() => undefined);
      }
    })();
    return inflight;
  }

  function startSyncLifecycle(opts: LifecycleOptions = {}): () => void {
    const intervalMs = opts.intervalMs ?? 60_000;
    const g = globalThis as unknown as {
      addEventListener?: (t: string, l: () => void) => void;
      removeEventListener?: (t: string, l: () => void) => void;
      document?: { visibilityState?: string; addEventListener?: (t: string, l: () => void) => void; removeEventListener?: (t: string, l: () => void) => void };
    };
    const trigger = () => {
      void syncNow().catch(() => undefined);
    };
    // Reconnect: sync straight away, ignoring backoff once (PHASE2-VERIFICATION
    // LOW-MED-6) — the wait was caused by being offline, not by the server.
    const onOnline = () => {
      void syncNow({ ignoreBackoff: true }).catch(() => undefined);
    };
    const onOffline = () => {
      void refresh().catch(() => undefined);
    };
    const onVisible = () => {
      if (!g.document || g.document.visibilityState === 'visible') trigger();
    };
    g.addEventListener?.('online', onOnline);
    g.addEventListener?.('offline', onOffline);
    g.document?.addEventListener?.('visibilitychange', onVisible);
    const timer = setInterval(trigger, intervalMs);
    if (opts.immediate !== false) trigger();
    return () => {
      g.removeEventListener?.('online', onOnline);
      g.removeEventListener?.('offline', onOffline);
      g.document?.removeEventListener?.('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }

  return {
    syncNow,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    refresh,
    async resume() {
      paused = null;
      lastError = null;
      return syncNow();
    },
    pause(reason) {
      paused = reason;
      void refresh().catch(() => undefined);
    },
    startSyncLifecycle,
    dispose() {
      disposed = true;
      listeners.clear();
      channel?.close();
    },
  };
}
