/**
 * Connectivity for the Attendance & Access page (PHASE3-CONTRACT Amendment 3):
 * Online / Offline / Reconnecting.
 *
 * `navigator.onLine === false` is trusted immediately (offline). `true` is not
 * proof of a working connection, so going back online — and any failed page
 * request reported via `reportFailure()` — triggers a probe of a same-origin
 * proxy (`/api/me`): success → online (+ `onReconnect`), failure → offline,
 * re-probed with backoff while the browser claims to be online.
 *
 * Framework-free; timers, fetch and the online flag are injectable for tests.
 */

export type ConnectivityState = 'online' | 'offline' | 'reconnecting';

export interface ConnectivityOptions {
  probe?: () => Promise<boolean>;
  isBrowserOnline?: () => boolean;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /** re-probe delays while the browser says online but the probe fails */
  retryDelaysMs?: number[];
}

export const DEFAULT_RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 30_000];

/** Default probe: the page's own same-origin proxy. Any HTTP answer < 500 = reachable. */
export async function defaultProbe(fetchImpl: typeof fetch = fetch, timeoutMs = 5_000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl('/api/me', { cache: 'no-store', redirect: 'manual', signal: controller.signal });
    // 401/redirect still means the server answered (auth is handled elsewhere)
    return res.type === 'opaqueredirect' || res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export interface Connectivity {
  getState(): ConnectivityState;
  subscribe(fn: (s: ConnectivityState) => void): () => void;
  /** a page request failed at the network level: verify and maybe go offline */
  reportFailure(): void;
  /** called on every offline → online transition (after a successful probe) */
  onReconnect(fn: () => void): () => void;
  /** attach window online/offline listeners; returns detach */
  start(target?: Pick<Window, 'addEventListener' | 'removeEventListener'>): () => void;
  /** for tests / manual retry */
  check(): Promise<ConnectivityState>;
}

export function createConnectivity(opts: ConnectivityOptions = {}): Connectivity {
  const probe = opts.probe ?? (() => defaultProbe());
  const isBrowserOnline =
    opts.isBrowserOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const setTimer = opts.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const delays = opts.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;

  let state: ConnectivityState = isBrowserOnline() ? 'online' : 'offline';
  let attempt = 0;
  let retry: unknown = null;
  let probing: Promise<ConnectivityState> | null = null;
  const listeners = new Set<(s: ConnectivityState) => void>();
  const reconnectListeners = new Set<() => void>();

  const set = (next: ConnectivityState) => {
    if (next === state) return;
    const wasDown = state !== 'online';
    state = next;
    for (const l of listeners) l(state);
    if (wasDown && next === 'online') for (const l of reconnectListeners) l();
  };

  const cancelRetry = () => {
    if (retry != null) clearTimer(retry);
    retry = null;
  };

  const scheduleRetry = () => {
    cancelRetry();
    if (!isBrowserOnline()) return;
    const ms = delays[Math.min(attempt, delays.length - 1)];
    attempt++;
    retry = setTimer(() => {
      retry = null;
      void check();
    }, ms);
  };

  function check(): Promise<ConnectivityState> {
    if (probing) return probing;
    if (!isBrowserOnline()) {
      cancelRetry();
      set('offline');
      return Promise.resolve(state);
    }
    if (state !== 'online') set('reconnecting');
    probing = (async () => {
      const ok = await probe().catch(() => false);
      probing = null;
      if (ok) {
        attempt = 0;
        cancelRetry();
        set('online');
      } else {
        set('offline');
        scheduleRetry();
      }
      return state;
    })();
    return probing;
  }

  return {
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      fn(state);
      return () => listeners.delete(fn);
    },
    reportFailure() {
      void check();
    },
    onReconnect(fn) {
      reconnectListeners.add(fn);
      return () => reconnectListeners.delete(fn);
    },
    start(target = window) {
      const onOffline = () => {
        cancelRetry();
        set('offline');
      };
      const onOnline = () => {
        attempt = 0;
        void check();
      };
      target.addEventListener('offline', onOffline);
      target.addEventListener('online', onOnline);
      return () => {
        target.removeEventListener('offline', onOffline);
        target.removeEventListener('online', onOnline);
        cancelRetry();
      };
    },
    check,
  };
}
