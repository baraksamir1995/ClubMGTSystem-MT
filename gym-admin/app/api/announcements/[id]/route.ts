import { NextRequest, NextResponse } from 'next/server';
import { resolveGymId } from '@/lib/api-gym-id';

export const dynamic = 'force-dynamic';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/** Full detail for one announcement. Marks it read as a side effect. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;

  const res = await fetch(`${BACKEND_URL}/api/announcements/${params.id}`, {
    headers: { Authorization: `Bearer ${resolved.token}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Not found' }, { status: res.status });
  return NextResponse.json(json);
}
