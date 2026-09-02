import { NextRequest, NextResponse } from 'next/server';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  // sourceMonth/targetMonth are 'YYYY-MM'. Omitting BOTH keeps the original
  // current-month -> next-month behaviour; sending only one is a caller bug.
  // Forward them as-is rather than dropping a lone value — silently falling
  // back to next-month would copy months the caller never asked for and
  // report success, and it would also hide the partial request from
  // Laravel's required_with validation.
  const { branchId, sourceMonth, targetMonth } = await req.json().catch(() => ({}));

  if ((sourceMonth == null) !== (targetMonth == null)) {
    return NextResponse.json(
      { error: 'Both sourceMonth and targetMonth are required, or neither.' },
      { status: 422 },
    );
  }

  const res = await laravelApi('/sessions/copy-to-next-month', token, {
    method: 'POST',
    body: JSON.stringify({
      branch_id: branchId ?? null,
      ...(sourceMonth != null && targetMonth != null
        ? { source_month: sourceMonth, target_month: targetMonth }
        : {}),
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json(
      {
        error: json.error ?? 'Failed to copy schedule',
        reason: json.reason,
        existing_count: json.existing_count,
        source_start: json.source_start,
        target_start: json.target_start,
        target_end: json.target_end,
      },
      { status: res.status },
    );
  }
  return NextResponse.json(json);
}
