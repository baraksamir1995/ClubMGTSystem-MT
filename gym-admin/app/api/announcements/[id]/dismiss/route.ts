import { NextRequest, NextResponse } from 'next/server';
import { resolveGymId } from '@/lib/api-gym-id';

export const dynamic = 'force-dynamic';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/** Popup closed via the X — persists server-side so the dismissal
 *  follows the user to any other browser or device. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;

  const res = await fetch(`${BACKEND_URL}/api/announcements/${params.id}/dismiss`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${resolved.token}`, Accept: 'application/json' },
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json);
}
