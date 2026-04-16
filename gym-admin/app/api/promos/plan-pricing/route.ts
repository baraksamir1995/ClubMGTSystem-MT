import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export async function GET() {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const res = await laravelApi('/plan-promotions', token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Failed' }, { status: res.status });
  return NextResponse.json({ promotions: json.data ?? json });
}

export async function POST(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const body = await req.json();
  const res = await laravelApi('/plan-promotions', token, {
    method: 'POST',
    body: JSON.stringify({
      plan_id: body.planId ?? body.plan_id,
      promo_price: body.promoPrice ?? body.promo_price,
      valid_from: body.validFrom ?? body.valid_from,
      valid_until: body.validUntil ?? body.valid_until,
    }),
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}
