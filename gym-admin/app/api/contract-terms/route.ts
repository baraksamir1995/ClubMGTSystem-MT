import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

// Contract Terms & Conditions for the active gym. The gym is derived
// server-side from the session by resolveGymId()/the Laravel token —
// never from the request body — so there is no gym_id for a client to
// tamper with here.

export async function GET() {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const res = await laravelApi('/contract-terms', token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? null);
}

export async function PUT(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const body = await req.json();

  const res = await laravelApi('/contract-terms', token, {
    method: 'PUT',
    body: JSON.stringify({
      contract_terms_conditions: body.contract_terms_conditions ?? '',
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json(
      { error: json.error ?? json.message ?? 'Failed' },
      { status: res.status },
    );
  }
  return NextResponse.json(json.data ?? json);
}
