/**
 * Offline attendance — cache bootstrap (admin-class snapshot).
 *
 * Pulls every page of GET /api/attendance/offline/bootstrap (cursor-paged on
 * members), then replaces all cache stores in ONE transaction: either the full
 * new snapshot is visible or the previous one stays intact. Records `as_of`
 * (of the first page — the conservative, oldest point in time) and the policy.
 *
 * Also: GET /api/attendance/offline/status (policy + device state) and the
 * staleness helpers.
 */
import {
  getMeta,
  replaceSnapshot,
  setMeta,
  wipeCache,
  wipeMemberData,
  type OfflineDB,
} from './db';
import { clientHeaders, type ClientInfo } from './sync-engine';
import { defaultMonoNow, recordServerTime } from './server-clock';
import {
  DEFAULT_POLICY,
  type AdminBootstrapPage,
  type CachedBranch,
  type CachedClassSession,
  type CachedMember,
  type CachedMembership,
  type OfflinePolicy,
  type OfflineStatusResponse,
  type RecentAttendance,
} from './types';

export type FetchOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'auth_required' | 'forbidden' | 'http' | 'network' | 'invalid_response'; status?: number };

export interface BootstrapFetcher {
  page(cursor: string | null, limit: number): Promise<FetchOutcome<AdminBootstrapPage>>;
}

async function getJson<T>(url: string, headers: Record<string, string>, fetchImpl?: typeof fetch): Promise<FetchOutcome<T>> {
  const f = fetchImpl ?? globalThis.fetch.bind(globalThis);
  let res: Response;
  try {
    res = await f(url, {
      method: 'GET',
      credentials: 'same-origin',
      redirect: 'manual',
      cache: 'no-store',
      headers: { Accept: 'application/json', ...headers },
    });
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (res.type === 'opaqueredirect' || res.redirected || (res.status >= 300 && res.status < 400)) {
    return { ok: false, reason: 'auth_required', status: res.status };
  }
  if (res.status === 401) return { ok: false, reason: 'auth_required', status: 401 };
  if (res.status === 403) return { ok: false, reason: 'forbidden', status: 403 };
  if (!res.ok) return { ok: false, reason: 'http', status: res.status };
  try {
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, reason: 'invalid_response', status: res.status };
  }
}

export function createFetchBootstrapper(
  deviceId: string,
  opts: { endpoint?: string; fetchImpl?: typeof fetch; clientInfo?: ClientInfo } = {},
): BootstrapFetcher {
  const endpoint = opts.endpoint ?? '/api/attendance/offline/bootstrap';
  return {
    page(cursor, limit) {
      const qs = new URLSearchParams({ limit: String(limit) });
      if (cursor) qs.set('cursor', cursor);
      return getJson<AdminBootstrapPage>(
        `${endpoint}?${qs}`,
        clientHeaders(deviceId, opts.clientInfo),
        opts.fetchImpl,
      );
    },
  };
}

export type BootstrapResult =
  | {
      ok: true;
      as_of: string;
      pages: number;
      members: number;
      memberships: number;
      branches: number;
      class_sessions: number;
      recent_attendance: number;
    }
  | {
      ok: false;
      reason: 'auth_required' | 'forbidden' | 'http' | 'network' | 'invalid_response' | 'gym_mismatch' | 'too_many_pages';
      /** true when the cache was wiped (revoked access) */
      cacheWiped: boolean;
    };

export interface BootstrapOptions {
  gymId: string;
  fetcher: BootstrapFetcher;
  limit?: number;
  /** safety stop against a server that never ends the cursor */
  maxPages?: number;
  now?: () => number;
  /** monotonic clock for the server-time anchor (default performance.now) */
  monoNow?: () => number;
}

function isPage(x: unknown): x is AdminBootstrapPage {
  const p = x as AdminBootstrapPage;
  return !!p && typeof p === 'object' && typeof p.as_of === 'string' && Array.isArray(p.members) && !!p.gym;
}

export async function runBootstrap(db: OfflineDB, opts: BootstrapOptions): Promise<BootstrapResult> {
  const limit = opts.limit ?? 500;
  const maxPages = opts.maxPages ?? 200;
  const now = opts.now ?? (() => Date.now());

  const members = new Map<string, CachedMember>();
  const memberships = new Map<string, CachedMembership>();
  const branches = new Map<string, CachedBranch>();
  const sessions = new Map<string, CachedClassSession>();
  const recent = new Map<string, RecentAttendance>();
  let first: AdminBootstrapPage | null = null;
  let cursor: string | null = null;
  let pages = 0;
  const monoNow = opts.monoNow ?? defaultMonoNow;
  let clockReading: { serverTime: string; wall: number; mono: number } | null = null;

  do {
    if (pages >= maxPages) return { ok: false, reason: 'too_many_pages', cacheWiped: false };
    const out = await opts.fetcher.page(cursor, limit);
    if (!out.ok) {
      if (out.reason === 'forbidden') {
        // Revoked access: purge cached operational data, keep the outbox.
        await wipeCache(db);
        return { ok: false, reason: 'forbidden', cacheWiped: true };
      }
      return { ok: false, reason: out.reason, cacheWiped: false };
    }
    const receivedWall = now();
    const receivedMono = monoNow();
    const page = out.data;
    if (!isPage(page)) return { ok: false, reason: 'invalid_response', cacheWiped: false };
    // taken per page at receipt (not after paging) so it isn't biased by download time
    if (!Number.isNaN(Date.parse(page.server_time))) {
      clockReading = { serverTime: page.server_time, wall: receivedWall, mono: receivedMono };
    }
    if (page.gym.id !== opts.gymId) return { ok: false, reason: 'gym_mismatch', cacheWiped: false };
    pages++;
    if (!first) first = page;

    for (const m of page.members) {
      const { buckets, ...rest } = m;
      members.set(m.gym_member_id, { ...rest, name_lc: (m.full_name ?? '').toLowerCase() });
      for (const b of buckets ?? []) {
        memberships.set(b.membership_id, {
          ...b,
          gym_member_id: m.gym_member_id,
          start_date: toDateOnly(b.start_date, page.gym.timezone),
          end_date: toDateOnly(b.end_date, page.gym.timezone),
        });
      }
    }
    for (const b of page.branches ?? []) branches.set(b.id, b);
    for (const s of page.class_sessions ?? []) sessions.set(s.id, s);
    for (const a of page.recent_attendance ?? []) recent.set(a.attendance_id, a);
    cursor = page.next_cursor ?? null;
  } while (cursor);

  if (!first) return { ok: false, reason: 'invalid_response', cacheWiped: false };

  await replaceSnapshot(db, {
    members: [...members.values()],
    memberships: [...memberships.values()],
    branches: [...branches.values()],
    class_sessions: [...sessions.values()],
    recent_attendance: [...recent.values()],
    meta: {
      as_of: first.as_of,
      gym: first.gym,
      policy: first.policy ?? DEFAULT_POLICY,
      snapshot_stored_at: now(),
      bootstrap_cursor: null,
    },
  });
  if (clockReading) {
    await recordServerTime(db, clockReading.serverTime, { wall: clockReading.wall, mono: clockReading.mono });
  }

  return {
    ok: true,
    as_of: first.as_of,
    pages,
    members: members.size,
    memberships: memberships.size,
    branches: branches.size,
    class_sessions: sessions.size,
    recent_attendance: recent.size,
  };
}

// ── status endpoint ─────────────────────────────────────────────────────────

export async function fetchOfflineStatus(
  db: OfflineDB,
  deviceId: string,
  opts: {
    endpoint?: string;
    fetchImpl?: typeof fetch;
    clientInfo?: ClientInfo;
    now?: () => number;
    monoNow?: () => number;
  } = {},
): Promise<FetchOutcome<OfflineStatusResponse>> {
  const endpoint = opts.endpoint ?? '/api/attendance/offline/status';
  const now = opts.now ?? (() => Date.now());
  const out = await getJson<OfflineStatusResponse>(
    `${endpoint}?${new URLSearchParams({ device_id: deviceId })}`,
    clientHeaders(deviceId, opts.clientInfo),
    opts.fetchImpl,
  );
  const receivedAt = { wall: now(), mono: (opts.monoNow ?? defaultMonoNow)() };
  if (out.ok && out.data?.policy) {
    await setMeta(db, 'policy', { ...out.data.policy, enabled: out.data.enabled ?? out.data.policy.enabled });
  }
  if (out.ok) {
    // CONTRACT §6.6: offset = server_time − local time
    await recordServerTime(db, out.data?.server_time, receivedAt);
  }
  return out;
}

// ── date-only fields (CONTRACT §6.4) ────────────────────────────────────────

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date in `YYYY-MM-DD` form (rejects 2026-02-30). */
export function isDateOnly(value: string): boolean {
  const m = DATE_ONLY.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * Normalise a date-only field to `YYYY-MM-DD`. Accepts the contract form as-is;
 * tolerates the pre-§6.4 backend form (an ISO instant of local midnight) by
 * taking its calendar date in the gym's timezone. Anything unparseable → null.
 */
export function toDateOnly(value: string | null | undefined, timeZone: string): string | null {
  if (value == null || value === '') return null;
  if (DATE_ONLY.test(value)) return isDateOnly(value) ? value : null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  try {
    // en-CA formats as YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
  } catch {
    return new Date(t).toISOString().slice(0, 10);
  }
}

// ── staleness ───────────────────────────────────────────────────────────────

export interface Staleness {
  as_of: string | null;
  age_ms: number | null;
  max_age_ms: number;
  stale: boolean;
  policy: OfflinePolicy['expired_cache_policy'];
}

/** Pure staleness check: no snapshot at all counts as stale. */
export function computeStaleness(asOf: string | null | undefined, policy: OfflinePolicy, nowMs: number): Staleness {
  const maxAge = policy.max_data_age_hours * 3_600_000;
  const t = asOf ? Date.parse(asOf) : NaN;
  const age = Number.isNaN(t) ? null : Math.max(0, nowMs - t);
  return {
    as_of: asOf ?? null,
    age_ms: age,
    max_age_ms: maxAge,
    stale: age == null || age > maxAge,
    policy: policy.expired_cache_policy,
  };
}

export async function getStaleness(db: OfflineDB, nowMs: number = Date.now()): Promise<Staleness> {
  const [asOf, policy] = await Promise.all([getMeta(db, 'as_of'), getMeta(db, 'policy')]);
  return computeStaleness(asOf, policy ?? DEFAULT_POLICY, nowMs);
}

// ── policy-driven refresh (PHASE3 verification L5 / L10) ────────────────────

export type PolicyRefresh = 'disabled' | 'refreshed' | 'fresh' | 'unavailable';

/**
 * Re-read the policy (status endpoint) and act on it:
 *  - policy off → wipe any cached member/attendance data and download nothing
 *    (the server's snapshot is empty anyway) — the page behaves as today;
 *  - policy on → bootstrap when the cache is missing or stale.
 * Called on page load, on reconnect, and periodically while online.
 */
export async function refreshPolicyAndCache(
  db: OfflineDB,
  deviceId: string,
  opts: { bootstrap: () => Promise<BootstrapResult>; fetchImpl?: typeof fetch; now?: () => number },
): Promise<PolicyRefresh> {
  const status = await fetchOfflineStatus(db, deviceId, { fetchImpl: opts.fetchImpl, now: opts.now });
  if (!status.ok) return 'unavailable';
  const policy = (await getMeta(db, 'policy')) ?? DEFAULT_POLICY;
  if (!policy.enabled) {
    await wipeMemberData(db);
    return 'disabled';
  }
  const staleness = await getStaleness(db, (opts.now ?? Date.now)());
  if (!staleness.stale) return 'fresh';
  const res = await opts.bootstrap();
  return res.ok ? 'refreshed' : 'unavailable';
}
