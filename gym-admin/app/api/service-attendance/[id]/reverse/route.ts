import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

/**
 * Reverse a recorded service attendance: restores the session to the
 * package and removes the paired Services → Service Logs row, keeping the
 * attendance row for audit.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const res = await laravelApi(`/service-attendance/${params.id}/reverse`, token, {
    method: 'POST',
  });
  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  }
  return NextResponse.json(json);
}
