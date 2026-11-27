/**
 * Offline attendance — branch kiosk (PHASE3-CONTRACT §5).
 *
 * The kiosk downloads a batch of consecutive pre-signed rotating branch QR
 * tokens (60 s each) while online, stores it per (user, branch) in IndexedDB,
 * and shows the token valid "now" — where now is the server time estimated
 * from the monotonic-anchored clock (./server-clock), so a device clock that
 * is changed after the last measurement doesn't make the kiosk show the wrong
 * code. It keeps working offline until the batch runs out.
 *
 * Framework-free: the React screen only renders `kioskStatus()`.
 */
import { getKioskBatch, putKioskBatch, type OfflineDB } from './db';
import { recordServerTime, defaultMonoNow } from './server-clock';
import type { KioskBatch, RotatingBatchResponse, RotatingToken } from './types';

/** warn on screen when less than this is left (contract: < 1 h) */
export const KIOSK_WARN_MS = 60 * 60_000;
/** auto-refresh when online and less than this is left */
export const KIOSK_REFRESH_MS = 6 * 60 * 60_000;
/** hours requested per batch (server max 24) */
export const KIOSK_BATCH_HOURS = 12;
/**
 * Members' apps accept a rotating token whose iat is up to future_skew ahead of
 * their scan time; showing the first token a little early is fine, but not
 * more than this.
 */
export const KIOSK_EARLY_TOLERANCE_MS = 60_000;

export type KioskPhase = 'empty' | 'not_started' | 'ok' | 'low' | 'exhausted';

export interface KioskStatus {
  phase: KioskPhase;
  token: RotatingToken | null;
  index: number;
  /** ms until the displayed code changes (0 when nothing is shown) */
  msToNext: number;
  /** ms until the batch runs out (0 when exhausted/empty) */
  remainingMs: number;
  /** batch end (epoch ms), null when empty */
  endsAtMs: number | null;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);

/** Validate + normalise a rotating-batch response; null when unusable. */
export function parseRotatingBatch(body: unknown): RotatingBatchResponse | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Partial<RotatingBatchResponse>;
  if (!Array.isArray(b.tokens) || typeof b.kid !== 'string' || typeof b.generated_at !== 'string') return null;
  const tokens: RotatingToken[] = [];
  for (const t of b.tokens) {
    if (!t || typeof t !== 'object') continue;
    const { qr, iat, exp } = t as RotatingToken;
    if (typeof qr !== 'string' || qr.length === 0 || qr.length > 1024 || !isInt(iat) || !isInt(exp) || exp <= iat) continue;
    tokens.push({ qr, iat, exp });
  }
  if (tokens.length === 0) return null;
  tokens.sort((a, z) => a.iat - z.iat);
  return { tokens, kid: b.kid, generated_at: b.generated_at };
}

/**
 * The token to display at `nowMs` (estimated server time):
 *  - `ok` / `low` (< KIOSK_WARN_MS left): the token with iat ≤ now < exp;
 *  - `not_started`: now is before the first token (beyond the early tolerance);
 *  - `exhausted`: now ≥ the last token's exp — show "connect to refresh";
 *  - gaps between tokens (shouldn't happen) show the next token if it starts
 *    within the early tolerance, else nothing (`not_started`).
 */
export function kioskStatus(batch: Pick<KioskBatch, 'tokens'> | null | undefined, nowMs: number): KioskStatus {
  const none = (phase: KioskPhase, endsAtMs: number | null): KioskStatus => ({
    phase,
    token: null,
    index: -1,
    msToNext: 0,
    remainingMs: 0,
    endsAtMs,
  });
  const tokens = batch?.tokens ?? [];
  if (tokens.length === 0) return none('empty', null);
  const endsAtMs = tokens[tokens.length - 1].exp * 1000;
  if (nowMs >= endsAtMs) return none('exhausted', endsAtMs);

  let index = tokens.findIndex((t) => t.iat * 1000 <= nowMs && nowMs < t.exp * 1000);
  if (index === -1) {
    // before the first token, or in a gap: use the next one if it starts soon
    const next = tokens.findIndex((t) => t.iat * 1000 > nowMs);
    if (next === -1 || tokens[next].iat * 1000 - nowMs > KIOSK_EARLY_TOLERANCE_MS) {
      return { ...none('not_started', endsAtMs), remainingMs: endsAtMs - nowMs };
    }
    index = next;
  }
  const token = tokens[index];
  const remainingMs = endsAtMs - nowMs;
  return {
    phase: remainingMs < KIOSK_WARN_MS ? 'low' : 'ok',
    token,
    index,
    msToNext: Math.max(0, token.exp * 1000 - nowMs),
    remainingMs,
    endsAtMs,
  };
}

/** Refresh policy: only when online; when empty/exhausted/not started or < KIOSK_REFRESH_MS left. */
export function shouldRefreshBatch(status: KioskStatus, online: boolean): boolean {
  if (!online) return false;
  if (status.phase === 'empty' || status.phase === 'exhausted' || status.phase === 'not_started') return true;
  return status.remainingMs < KIOSK_REFRESH_MS;
}

/** Minimum gap between automatic refresh attempts (failures, future-dated batches). */
export const KIOSK_RETRY_MS = 5 * 60_000;

/** Automatic refresh: policy above, throttled so a failing server isn't hammered. */
export function shouldAttemptRefresh(
  status: KioskStatus,
  online: boolean,
  lastAttemptMs: number | null,
  nowMs: number,
): boolean {
  if (!shouldRefreshBatch(status, online)) return false;
  return lastAttemptMs == null || nowMs - lastAttemptMs >= KIOSK_RETRY_MS;
}

export type BatchFetch =
  | { ok: true; batch: KioskBatch }
  | { ok: false; status: number; body: unknown; reason: 'auth_required' | 'forbidden' | 'http' | 'network' | 'invalid_response' };

/**
 * Download a batch through the same-origin proxy, record the server clock from
 * `generated_at` (monotonic anchor), store it, and return it. An existing batch
 * is only replaced by a valid new one.
 */
export async function downloadKioskBatch(
  db: OfflineDB,
  branch: { id: string; name: string | null },
  opts: { hours?: number; fetchImpl?: typeof fetch; now?: () => number; monoNow?: () => number } = {},
): Promise<BatchFetch> {
  const f = opts.fetchImpl ?? fetch;
  const now = opts.now ?? (() => Date.now());
  const monoNow = opts.monoNow ?? defaultMonoNow;
  const hours = Math.min(24, Math.max(1, Math.floor(opts.hours ?? KIOSK_BATCH_HOURS)));
  let res: Response;
  try {
    res = await f(`/api/branches/${encodeURIComponent(branch.id)}/qr/rotating-batch?hours=${hours}`, {
      cache: 'no-store',
      redirect: 'manual',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
  } catch {
    return { ok: false, status: 0, body: null, reason: 'network' };
  }
  const receivedAt = { wall: now(), mono: monoNow() };
  if (res.type === 'opaqueredirect' || res.redirected || (res.status >= 300 && res.status < 400)) {
    return { ok: false, status: res.status, body: null, reason: 'auth_required' };
  }
  const body: unknown = await res.json().catch(() => null);
  if (res.status === 401) return { ok: false, status: 401, body, reason: 'auth_required' };
  if (res.status === 403) return { ok: false, status: 403, body, reason: 'forbidden' };
  if (!res.ok) return { ok: false, status: res.status, body, reason: 'http' };
  const parsed = parseRotatingBatch(body);
  if (!parsed) return { ok: false, status: res.status, body, reason: 'invalid_response' };

  await recordServerTime(db, parsed.generated_at, receivedAt);
  const batch: KioskBatch = {
    branch_id: branch.id,
    branch_name: branch.name,
    kid: parsed.kid,
    generated_at: parsed.generated_at,
    stored_at: receivedAt.wall,
    tokens: parsed.tokens,
  };
  await putKioskBatch(db, batch);
  return { ok: true, batch };
}

export { getKioskBatch };
