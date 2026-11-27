/**
 * Sign-out with the offline logout policy (D9):
 *   0. offline → refuse (`'offline'`): the server-side logout can't run, so the
 *      computer would stay signed in while the UI pretends otherwise
 *      (PHASE2-VERIFICATION MEDIUM-3);
 *   1. find this user's offline session (active in this tab, or an existing
 *      database for the current identity) — never creates a new database;
 *   2. try to sync (bounded) while the auth cookie still works;
 *   3. if events are still unsynced, ask the user (they stay saved on this
 *      device for this user and sync on their next sign-in) — cancel aborts
 *      and changes nothing;
 *   4. POST /api/auth/logout — a network failure returns `'offline'` and
 *      changes nothing locally;
 *   5. only then wipe cached member data (outbox kept).
 * Local storage problems never block signing out.
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
  /** progress for the UI (the sync wait can take a few seconds) */
  onProgress?: (phase: 'syncing' | 'signing_out') => void;
  isOnline?: () => boolean;
}

export type SignOutResult = 'signed_out' | 'cancelled' | 'offline';

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

export async function signOutWithOfflineCleanup(deps: SignOutDeps): Promise<SignOutResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const online = deps.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  if (!online()) return 'offline';

  let found: { session: OfflineSession; opened: boolean } | null = null;
  try {
    found = await findSession(fetchImpl);
  } catch {
    found = null;
  }
  const release = () => {
    if (found?.opened) found.session.close();
  };

  if (found) {
    try {
      deps.onProgress?.('syncing');
      await withTimeout(found.session.engine.syncNow().catch(() => null), deps.syncTimeoutMs ?? 5_000);
      const counts = await countOutbox(found.session.db);
      const unsynced = counts.pending + counts.syncing;
      if (unsynced > 0 && !(await deps.confirmPending(unsynced))) {
        release();
        return 'cancelled';
      }
    } catch {
      // local storage problems never block sign-out
    }
  }

  deps.onProgress?.('signing_out');
  try {
    const res = await fetchImpl('/api/auth/logout', { method: 'POST' });
    if (!res.ok && res.status >= 500) {
      release();
      return 'offline';
    }
  } catch {
    // network failure: the cookie was NOT cleared — don't pretend
    release();
    return 'offline';
  }

  if (found) {
    try {
      await logoutOffline(found.session, { skipSync: true });
    } catch {
      // ignore: the server-side session is already gone
    }
  }
  return 'signed_out';
}
