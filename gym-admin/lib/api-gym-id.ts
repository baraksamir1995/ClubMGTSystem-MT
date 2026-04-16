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
const meCache = new Map<string, { data: any; expiresAt: number }>();
const ME_CACHE_TTL = 5_000; // 5 seconds

async function fetchMe(token: string) {
  const cached = meCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const res = await fetch(`${BACKEND_URL}/api/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    meCache.delete(token);
    return null;
  }

  const data = await res.json();
  meCache.set(token, { data, expiresAt: Date.now() + ME_CACHE_TTL });

  // Evict stale entries to prevent memory leak
  if (meCache.size > 100) {
    const now = Date.now();
    for (const [key, val] of meCache) {
      if (val.expiresAt < now) meCache.delete(key);
    }
  }

  return data;
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
  const raw = cookieStore.get('auth_token')?.value ?? '';
  // Handle URL-encoded pipe character (Sanctum tokens contain |)
  const token = raw.includes('%') ? decodeURIComponent(raw) : raw;

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
