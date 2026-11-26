/**
 * Sign-out with the offline logout policy (D9) applied FIRST, while the auth
 * cookie still works:
 *   1. find this user's offline session (active in this tab, or an existing
 *      database for the current identity) — never creates a new database;
 *   2. try to sync (bounded);
 *   3. if events are still unsynced, ask the user (they stay saved on this
 *      device for this user and sync on their next sign-in) — cancel aborts
 *      the sign-out and changes nothing;
 *   4. wipe cached member data (outbox kept), then 5. POST /api/auth/logout.
 * Offline cleanup failures never block signing out.
 */
import { countOutbox, dbNameFor } from './db';
import {
  fetchIdentity,
  getActiveOfflineSession,
  logoutOffline,
  openOfflineSession,
  type OfflineSession,
} from './session';

export interface SignOutDeps {
  /** asked only when unsynced events remain; resolve true to sign out anyway */
  confirmPending: (count: number) => boolean | Promise<boolean>;
  fetchImpl?: typeof fetch;
  syncTimeoutMs?: number;
}

async function databaseExists(name: string): Promise<boolean> {
  const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (!idb) return false;
  if (typeof idb.databases !== 'function') return true; // can't tell → open (harmless, same user)
  try {
    return (await idb.databases()).some((d) => d.name === name);
  } catch {
    return false;
  }
}

async function findSession(fetchImpl?: typeof fetch): Promise<{ session: OfflineSession; opened: boolean } | null> {
  const active = getActiveOfflineSession();
  if (active) return { session: active, opened: false };
  const identity = await fetchIdentity(fetchImpl);
  if (!identity) return null;
  if (!(await databaseExists(dbNameFor(identity.gymId, identity.userId)))) return null;
  return { session: await openOfflineSession(identity, { broadcast: false }), opened: true };
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), ms);
  });
  try {
    return await Promise.race([p, t]);
  } finally {
    clearTimeout(timer);
  }
}

export async function signOutWithOfflineCleanup(deps: SignOutDeps): Promise<'signed_out' | 'cancelled'> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  let found: { session: OfflineSession; opened: boolean } | null = null;
  try {
    found = await findSession(fetchImpl);
  } catch {
    found = null;
  }

  if (found) {
    const { session } = found;
    try {
      await withTimeout(session.engine.syncNow().catch(() => null), deps.syncTimeoutMs ?? 5_000);
      const counts = await countOutbox(session.db);
      const unsynced = counts.pending + counts.syncing;
      if (unsynced > 0 && !(await deps.confirmPending(unsynced))) {
        if (found.opened) session.close();
        return 'cancelled';
      }
      await logoutOffline(session, { skipSync: true });
    } catch {
      // never block sign-out on local storage problems
    }
  }

  try {
    await fetchImpl('/api/auth/logout', { method: 'POST' });
  } catch {
    // cookie clearing failed (offline); caller still navigates to /login
  }
  return 'signed_out';
}
