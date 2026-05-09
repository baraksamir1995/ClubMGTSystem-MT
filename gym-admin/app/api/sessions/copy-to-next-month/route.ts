import { NextRequest, NextResponse } from 'next/server';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const { branchId } = await req.json().catch(() => ({}));

  const res = await laravelApi('/sessions/copy-to-next-month', token, {
    method: 'POST',
    body: JSON.stringify({ branch_id: branchId ?? null }),
  });

  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json(
      {
        error: json.error ?? 'Failed to copy schedule',
        existing_count: json.existing_count,
        target_start: json.target_start,
        target_end: json.target_end,
      },
      { status: res.status },
    );
  }
  return NextResponse.json(json);
}
