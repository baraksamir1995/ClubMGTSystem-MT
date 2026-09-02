import { NextResponse } from 'next/server';
import { resolveGymId } from '@/lib/api-gym-id';

export const dynamic = 'force-dynamic';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/** Badge count of unread product updates. */
export async function GET() {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;

  const res = await fetch(`${BACKEND_URL}/api/announcements/unread-count`, {
    headers: { Authorization: `Bearer ${resolved.token}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json);
}
