import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

// Upcoming (not yet due) recurring-expense occurrences. Informational only —
// never part of the overview totals.
export async function GET(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const days = new URL(req.url).searchParams.get('days');
  const qs = days && /^\d{1,3}$/.test(days) ? `?days=${days}` : '';
  const res = await laravelApi(`/expenses/upcoming${qs}`, token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json);
}
