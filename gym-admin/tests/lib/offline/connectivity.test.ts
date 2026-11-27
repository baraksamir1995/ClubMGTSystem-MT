import { describe, it, expect, vi } from 'vitest';
import { createConnectivity, defaultProbe } from '@/lib/offline/connectivity';

/** Manual timers so retry scheduling is deterministic. */
function timers() {
  const queue: { fn: () => void; ms: number }[] = [];
  return {
    queue,
    setTimer: (fn: () => void, ms: number) => {
      const h = { fn, ms };
      queue.push(h);
      return h;
    },
    clearTimer: (h: unknown) => {
      const i = queue.indexOf(h as never);
      if (i >= 0) queue.splice(i, 1);
    },
    runNext: async () => {
      const h = queue.shift();
      h?.fn();
      await Promise.resolve();
    },
  };
}

function target() {
  const l: Record<string, (() => void)[]> = {};
  return {
    addEventListener: (t: string, f: () => void) => ((l[t] ??= []).push(f)),
    removeEventListener: (t: string, f: () => void) => (l[t] = (l[t] ?? []).filter((x) => x !== f)),
    fire: (t: string) => (l[t] ?? []).forEach((f) => f()),
  };
}

describe('connectivity (Online / Offline / Reconnecting)', () => {
  it('browser offline event → offline immediately; online event → reconnecting → probe ok → online + onReconnect', async () => {
    let browserOnline = true;
    let resolveProbe!: (v: boolean) => void;
    const probe = vi.fn(() => new Promise<boolean>((r) => (resolveProbe = r)));
    const tm = timers();
    const c = createConnectivity({ probe, isBrowserOnline: () => browserOnline, setTimer: tm.setTimer, clearTimer: tm.clearTimer });
    const states: string[] = [];
    c.subscribe((s) => states.push(s));
    const reconnected = vi.fn();
    c.onReconnect(reconnected);
    const w = target();
    c.start(w as never);

    browserOnline = false;
    w.fire('offline');
    expect(c.getState()).toBe('offline');

    browserOnline = true;
    w.fire('online');
    expect(c.getState()).toBe('reconnecting');
    resolveProbe(true);
    await vi.waitFor(() => expect(c.getState()).toBe('online'));
    expect(states).toEqual(['online', 'offline', 'reconnecting', 'online']);
    expect(reconnected).toHaveBeenCalledTimes(1);
  });

  it('online flag lies (probe fails) → offline, re-probed with backoff until it works', async () => {
    let ok = false;
    const probe = vi.fn(async () => ok);
    const tm = timers();
    const c = createConnectivity({ probe, isBrowserOnline: () => true, setTimer: tm.setTimer, clearTimer: tm.clearTimer, retryDelaysMs: [1000, 2000] });
    const reconnected = vi.fn();
    c.onReconnect(reconnected);
    c.reportFailure(); // a page request failed
    await vi.waitFor(() => expect(c.getState()).toBe('offline'));
    expect(tm.queue.map((q) => q.ms)).toEqual([1000]);
    await tm.runNext();
    await vi.waitFor(() => expect(probe).toHaveBeenCalledTimes(2));
    expect(tm.queue.map((q) => q.ms)).toEqual([2000]);
    ok = true;
    await tm.runNext();
    await vi.waitFor(() => expect(c.getState()).toBe('online'));
    expect(reconnected).toHaveBeenCalledTimes(1);
    expect(tm.queue).toHaveLength(0);
  });

  it('a failure report while really online keeps it online', async () => {
    const c = createConnectivity({ probe: async () => true, isBrowserOnline: () => true });
    c.reportFailure();
    await c.check();
    expect(c.getState()).toBe('online');
  });

  it('default probe: any answer < 500 (incl. 401/redirect) is reachable; network error / 5xx is not', async () => {
    expect(await defaultProbe(vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))).toBe(true);
    expect(await defaultProbe(vi.fn().mockResolvedValue(new Response(null, { status: 307, headers: { location: '/login' } })))).toBe(true);
    expect(await defaultProbe(vi.fn().mockResolvedValue(new Response('x', { status: 503 })))).toBe(false);
    expect(await defaultProbe(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))).toBe(false);
  });
});
