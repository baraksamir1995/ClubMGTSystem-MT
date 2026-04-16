import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export async function GET() {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const res = await laravelApi('/payment-config/status', token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}

export async function POST(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const body = await req.json();

  // Convert camelCase to snake_case
  const payload: Record<string, any> = {
    secret_key: body.secretKey ?? body.secret_key,
    public_key: body.publicKey ?? body.public_key,
    integration_id: body.integrationId ?? body.integration_id,
    valu_integration_id: body.valuIntegrationId ?? body.valu_integration_id ?? null,
    applepay_integration_id: body.applepayIntegrationId ?? body.applepay_integration_id ?? null,
  };

  const res = await laravelApi('/payment-config', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json({ success: true, ...(json.data ?? json) });
}
