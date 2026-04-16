import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export async function GET() {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const res = await laravelApi('/promo-codes', token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Failed' }, { status: res.status });
  return NextResponse.json({ promos: json.data ?? json });
}

export async function POST(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const body = await req.json();
  const res = await laravelApi('/promo-codes', token, {
    method: 'POST',
    body: JSON.stringify({
      code: body.code,
      name: body.name,
      discount_type: body.discountType === 'percent' ? 'percentage' : body.discountType ?? body.discount_type,
      discount_value: body.discountValue ?? body.discount_value,
      valid_from: body.validFrom ?? body.valid_from ?? null,
      valid_until: body.validUntil ?? body.valid_until ?? null,
      max_uses: body.maxUses ?? body.max_uses ?? null,
      max_uses_per_member: body.maxUsesPerMember ?? body.max_uses_per_member ?? null,
    }),
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}
