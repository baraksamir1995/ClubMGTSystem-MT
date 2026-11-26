import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/**
 * Roles that are permitted to access gym-admin API routes.
 * A regular member who happens to have a gym_id set must NOT be granted access.
 */
const ADMIN_ROLES = new Set(['gym_admin', 'trainer', 'staff']);

/**
 * Short-lived in-memory cache for /api/me results.
 * Avoids hitting the backend on every API route call within the same second.
 * TTL: 5 seconds — short enough that logout/role changes take effect quickly.
 */
const meCache = new Map<string, { data: any; expiresAt: number }>(); // keyed by token suffix
const ME_CACHE_TTL = 5_000; // 5 seconds

type MeOutcome = { ok: true; data: any } | { ok: false; status: number; retryAfter: string | null };

/**
 * `/api/me` with the upstream status preserved (cached on success).
 * Throws on network errors / invalid JSON, exactly like the original fetchMe.
 */
async function fetchMeDetailed(token: string): Promise<MeOutcome> {
  const cacheKey = token.slice(-16);
  const cached = meCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, data: cached.data };
  }

  const res = await fetch(`${BACKEND_URL}/api/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    meCache.delete(cacheKey);
    return { ok: false, status: res.status, retryAfter: res.headers?.get?.('retry-after') ?? null };
  }

  const data = await res.json();
  meCache.set(cacheKey, { data, expiresAt: Date.now() + ME_CACHE_TTL });

  // Evict stale entries to prevent memory leak
  if (meCache.size > 100) {
    const now = Date.now();
    for (const [key, val] of meCache) {
      if (val.expiresAt < now) meCache.delete(key);
    }
  }

  return { ok: true, data };
}

/** Original contract: profile, or null for ANY non-OK response (kept for existing routes). */
async function fetchMe(token: string) {
  const out = await fetchMeDetailed(token);
  return out.ok ? out.data : null;
}

function readToken(raw: string): string {
  // Handle URL-encoded pipe character (Sanctum tokens contain |)
  return raw.includes('%') ? decodeURIComponent(raw) : raw;
}

/**
 * Shared auth + gym_id resolver for API routes.
 *
 * Security contract:
 *  1. User must be authenticated (valid Laravel Sanctum token).
 *  2. User's profile role must be one of ADMIN_ROLES — prevents regular members
 *     from accessing admin endpoints even if their profile.gym_id is populated.
 *  3. gym_id is sourced from the verified profile row, never from client input.
 *
 * Returns { user, gymId, token } on success, or { response } with a NextResponse error.
 */
export async function resolveGymId(): Promise<
  | { user: { id: string; role: string }; gymId: string; token: string; response?: never }
  | { response: NextResponse; user?: never; gymId?: never; token?: never }
> {
  const cookieStore = await cookies();
  const token = readToken(cookieStore.get('auth_token')?.value ?? '');

  if (!token) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  try {
    const profile = await fetchMe(token);

    if (!profile) {
      return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const userId = profile.id;
    const gymId = profile.gym_id;
    const role = profile.role;

    if (!gymId || !ADMIN_ROLES.has(role)) {
      return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { user: { id: userId, role }, gymId, token };
  } catch {
    return { response: NextResponse.json({ error: 'Service unavailable' }, { status: 503 }) };
  }
}

type ResolveResult =
  | { user: { id: string; role: string }; gymId: string; token: string; response?: never }
  | { response: NextResponse; user?: never; gymId?: never; token?: never };

/**
 * Variant of resolveGymId() for background sync callers (offline attendance
 * proxies). Same security contract, but distinguishes "not logged in" from
 * "backend unavailable" so a sync engine backs off instead of treating an
 * outage as a logout (PHASE1-VERIFICATION MEDIUM-1):
 *  - missing token / `/api/me` 401        → 401 { code: 'auth_required' }
 *  - `/api/me` 403 or non-admin role       → 403 { code: 'forbidden' }
 *  - `/api/me` 429                         → 429 { code: 'upstream_rate_limited', retryable } (+ Retry-After)
 *  - `/api/me` other non-OK / network      → 503 { code: 'upstream_unavailable', retryable }
 * resolveGymId() itself is unchanged for every other route.
 */
export async function resolveGymIdForSync(): Promise<ResolveResult> {
  const cookieStore = await cookies();
  const token = readToken(cookieStore.get('auth_token')?.value ?? '');
  const unavailable = () =>
    NextResponse.json(
      { error: 'Service unavailable', code: 'upstream_unavailable', retryable: true },
      { status: 503 },
    );

  if (!token) {
    return { response: NextResponse.json({ error: 'Unauthorized', code: 'auth_required' }, { status: 401 }) };
  }

  let me: MeOutcome;
  try {
    me = await fetchMeDetailed(token);
  } catch {
    return { response: unavailable() };
  }

  if (!me.ok) {
    if (me.status === 401) {
      return { response: NextResponse.json({ error: 'Unauthorized', code: 'auth_required' }, { status: 401 }) };
    }
    if (me.status === 403) {
      return { response: NextResponse.json({ error: 'Forbidden', code: 'forbidden' }, { status: 403 }) };
    }
    if (me.status === 429) {
      return {
        response: NextResponse.json(
          { error: 'Too many requests', code: 'upstream_rate_limited', retryable: true },
          { status: 429, headers: me.retryAfter ? { 'Retry-After': me.retryAfter } : undefined },
        ),
      };
    }
    return { response: unavailable() };
  }

  const profile = me.data;
  if (!profile?.gym_id || !ADMIN_ROLES.has(profile.role)) {
    return { response: NextResponse.json({ error: 'Forbidden', code: 'forbidden' }, { status: 403 }) };
  }
  return { user: { id: profile.id, role: profile.role }, gymId: profile.gym_id, token };
}

/**
 * Helper to make authenticated requests to the Laravel API from Next.js API routes.
 */
export async function laravelApi(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${BACKEND_URL}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> ?? {}),
    },
    cache: 'no-store',
  });
}
