/**
 * Offline attendance — server clock estimate (CONTRACT §6.6).
 *
 * Problem: an offset (server_time − wall clock) measured once only catches a
 * clock that was ALREADY wrong at measurement time. If the user changes the
 * device clock afterwards, a fresh comparison of wall time vs "wall + offset"
 * says everything is fine.
 *
 * Fix: anchor the server time to a MONOTONIC clock (performance.now(), which
 * the user cannot change and which doesn't jump with the wall clock):
 *
 *   on each measurement:  anchor = { serverMs, mono: performance.now() }
 *   estimated server now = anchor.serverMs + (performance.now() − anchor.mono)
 *
 * The recorder compares the wall-clock time it stamps on the event against
 * that estimate.
 *
 * The anchor lives in memory only (performance.now() restarts per page load),
 * keyed by the open database instance. The wall-clock offset is ALSO persisted
 * in meta `server_clock_offset_ms`; after a reload — until the next status /
 * bootstrap / sync response re-anchors — the estimate falls back to
 * `wall + persisted offset`. That fallback only detects skew that existed when
 * the offset was measured (a clock changed between the last measurement and
 * the reload goes unnoticed until the next measurement, which happens on the
 * first successful request after load). With no measurement at all, no
 * estimate is made and no skew check is applied.
 */
import { getMeta, setMeta, type OfflineDB } from './db';

export interface TimeSource {
  /** wall clock, epoch ms (user-adjustable) */
  wallNow(): number;
  /** monotonic clock, ms since an arbitrary origin (not user-adjustable) */
  monoNow(): number;
}

export function defaultMonoNow(): number {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  return typeof perf?.now === 'function' ? perf.now() : Date.now();
}

export const systemTime: TimeSource = {
  wallNow: () => Date.now(),
  monoNow: defaultMonoNow,
};

interface Anchor {
  serverMs: number;
  mono: number;
}

const anchors = new WeakMap<OfflineDB, Anchor>();

/**
 * Record a server time observed in a response.
 * `wall` / `mono` are the local clock readings taken when the response arrived.
 */
export async function recordServerTime(
  db: OfflineDB,
  serverTime: string | null | undefined,
  at: { wall: number; mono: number },
): Promise<void> {
  const serverMs = Date.parse(serverTime ?? '');
  if (Number.isNaN(serverMs)) return;
  anchors.set(db, { serverMs, mono: at.mono });
  await setMeta(db, 'server_clock_offset_ms', serverMs - at.wall);
}

export type ServerNowSource = 'anchor' | 'persisted_offset' | 'none';

/** Best estimate of the server's current time, or null when never measured. */
export async function estimateServerNow(
  db: OfflineDB,
  time: TimeSource = systemTime,
): Promise<{ serverNowMs: number | null; source: ServerNowSource }> {
  const anchor = anchors.get(db);
  if (anchor) return { serverNowMs: anchor.serverMs + (time.monoNow() - anchor.mono), source: 'anchor' };
  const offset = await getMeta(db, 'server_clock_offset_ms');
  if (typeof offset === 'number' && Number.isFinite(offset)) {
    return { serverNowMs: time.wallNow() + offset, source: 'persisted_offset' };
  }
  return { serverNowMs: null, source: 'none' };
}

/** Test/diagnostic helper: drop the in-memory anchor (simulates a reload). */
export function clearServerClockAnchor(db: OfflineDB): void {
  anchors.delete(db);
}
