import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/**
 * Resolve and verify that the current user is a super_admin.
 * Returns { token } on success, or a 401/403 NextResponse on failure.
 */
export async function resolveSuperAdmin(): Promise<
  | { token: string; response?: never }
  | { response: NextResponse; token?: never }
> {
  const cookieStore = await cookies();
  const raw = cookieStore.get('auth_token')?.value ?? '';
  const token = raw.includes('%') ? decodeURIComponent(raw) : raw;

  if (!token) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/super-admin/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const profile = await res.json();

    if (profile.role !== 'super_admin') {
      return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { token };
  } catch {
    return { response: NextResponse.json({ error: 'Service unavailable' }, { status: 503 }) };
  }
}
