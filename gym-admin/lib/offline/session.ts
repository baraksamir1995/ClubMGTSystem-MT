/**
 * Offline attendance — per-user session + logout policy (D9).
 *
 *  - Each authenticated (gym, user) gets its own database; a different user on
 *    the same browser opens a different database and the app never opens one
 *    it did not derive from the current identity, so it can't read another
 *    user's outbox.
 *  - Logout: attempt a sync (bounded), then wipe cached operational data
 *    (members, memberships, branches, sessions, recent attendance) and KEEP the
 *    outbox. Pending/rejected events stay in that user's database and are only
 *    sent with that user's token after they log in again.
 */
import {
  countOutbox,
  getDeviceId,
  getMeta,
  openOfflineDb,
  setMeta,
  wipeCache,
  type OfflineDB,
} from './db';
import { runBootstrap, createFetchBootstrapper, type BootstrapResult } from './bootstrap';
import { recordAttendance, type RecordAttendanceInput, type RecordResult } from './recorder';
import { createSyncEngine, type SyncEngine, type SyncEngineOptions } from './sync-engine';
import type { ActorType, SyncCounts } from './types';

export interface OfflineIdentity {
  userId: string;
  gymId: string;
  role: string;
}

const ACTOR_ROLES: Record<string, ActorType> = {
  gym_admin: 'gym_admin',
  staff: 'staff',
  trainer: 'trainer',
};

export function actorTypeForRole(role: string): ActorType | null {
  return ACTOR_ROLES[role] ?? null;
}

/** Current identity from the same-origin `/api/me` proxy; null when not authenticated. */
export async function fetchIdentity(fetchImpl?: typeof fetch): Promise<OfflineIdentity | null> {
  const f = fetchImpl ?? globalThis.fetch.bind(globalThis);
  try {
    const res = await f('/api/me', {
      credentials: 'same-origin',
      redirect: 'manual',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok || res.redirected || res.type === 'opaqueredirect') return null;
    const me = (await res.json()) as { id?: string; gym_id?: string; role?: string };
    if (!me.id || !me.gym_id || !me.role) return null;
    return { userId: me.id, gymId: me.gym_id, role: me.role };
  } catch {
    return null;
  }
}

export interface OfflineSession {
  identity: OfflineIdentity;
  deviceId: string;
  db: OfflineDB;
  engine: SyncEngine;
  record(input: RecordAttendanceInput): Promise<RecordResult>;
  bootstrap(opts?: { limit?: number }): Promise<BootstrapResult>;
  close(): void;
}

export type SessionEngineOverrides = Omit<SyncEngineOptions, 'db' | 'deviceId'>;

export async function openOfflineSession(
  identity: OfflineIdentity,
  overrides: SessionEngineOverrides & { fetchImpl?: typeof fetch } = {},
): Promise<OfflineSession> {
  const actorType = actorTypeForRole(identity.role);
  if (!actorType) throw new Error(`offline attendance: role "${identity.role}" cannot record attendance`);

  const deviceId = await getDeviceId();
  const db = await openOfflineDb(identity.gymId, identity.userId);

  const stored = await getMeta(db, 'identity');
  if (stored && (stored.user_id !== identity.userId || stored.gym_id !== identity.gymId)) {
    // Should be impossible (name is derived from the ids) — refuse rather than mix users.
    db.close();
    throw new Error('offline attendance: database identity mismatch');
  }
  await setMeta(db, 'identity', { user_id: identity.userId, gym_id: identity.gymId, role: identity.role });
  await setMeta(db, 'device_id', deviceId);

  const { fetchImpl, ...engineOverrides } = overrides;
  const engine = createSyncEngine({ db, deviceId, ...engineOverrides });
  await engine.refresh();

  const session: OfflineSession = {
    identity,
    deviceId,
    db,
    engine,
    record: (input) =>
      recordAttendance(db, { gymId: identity.gymId, userId: identity.userId, actorType, deviceId }, input),
    bootstrap: (opts = {}) =>
      runBootstrap(db, {
        gymId: identity.gymId,
        fetcher: createFetchBootstrapper(deviceId, { fetchImpl, clientInfo: engineOverrides.clientInfo }),
        limit: opts.limit,
      }),
    close() {
      engine.dispose();
      db.close();
      // a closed session must never be handed out again
      if (active === session) active = null;
    },
  };
  return session;
}

// ── module-level active session (one per tab) ───────────────────────────────

let active: OfflineSession | null = null;
let opening: Promise<OfflineSession> | null = null;

/** Open (or reuse) the session for `identity`; switching user closes the previous one. */
export async function getOfflineSession(
  identity: OfflineIdentity,
  overrides?: SessionEngineOverrides & { fetchImpl?: typeof fetch },
): Promise<OfflineSession> {
  if (opening) await opening.catch(() => undefined);
  if (active && active.identity.userId === identity.userId && active.identity.gymId === identity.gymId) {
    return active;
  }
  if (active) {
    active.close();
    active = null;
  }
  opening = openOfflineSession(identity, overrides);
  try {
    active = await opening;
    return active;
  } finally {
    opening = null;
  }
}

export function getActiveOfflineSession(): OfflineSession | null {
  return active;
}

export interface LogoutReport {
  syncAttempted: boolean;
  syncTimedOut: boolean;
  /** outbox counts left in the user's database after logout */
  remaining: SyncCounts;
}

/**
 * Logout policy (D9). Call BEFORE `/api/auth/logout` clears the cookie (the
 * sync needs it). Never deletes events.
 */
export async function logoutOffline(
  session: OfflineSession,
  opts: { syncTimeoutMs?: number; skipSync?: boolean } = {},
): Promise<LogoutReport> {
  const timeoutMs = opts.syncTimeoutMs ?? 5_000;
  let syncTimedOut = false;
  let syncAttempted = false;
  const before = await countOutbox(session.db);
  if (before.pending > 0 && !opts.skipSync) {
    syncAttempted = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), timeoutMs);
    });
    const outcome = await Promise.race([session.engine.syncNow().catch(() => null), timeout]);
    clearTimeout(timer);
    syncTimedOut = outcome === 'timeout';
  }

  // If a sync is still in flight its rows may be `syncing`; they are recovered
  // to `pending` by the next engine run for this same user (crash recovery).
  await wipeCache(session.db);
  const remaining = await countOutbox(session.db);
  session.close();
  if (active === session) active = null;
  return { syncAttempted, syncTimedOut, remaining };
}
