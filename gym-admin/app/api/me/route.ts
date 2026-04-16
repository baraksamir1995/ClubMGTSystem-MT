import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function GET() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const res = await fetch(`${BACKEND_URL}/api/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await res.json();

    // Fetch gym info
    let gym = null;
    if (profile.gym_id) {
      try {
        const gymRes = await fetch(`${BACKEND_URL}/api/settings`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          cache: 'no-store',
        });
        if (gymRes.ok) {
          const gymData = await gymRes.json();
          gym = { name: gymData.name ?? 'Gym', logo_url: gymData.logo_url ?? null };
        }
      } catch {}
      if (!gym) gym = { name: 'Gym', logo_url: null };
    }

    return NextResponse.json({
      ...profile,
      gym,
      mustResetPassword: profile.must_reset_password ?? false,
    });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
