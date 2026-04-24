import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';
import { denyUnlessPermitted } from '@/lib/get-permissions';

export async function GET() {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const res = await laravelApi('/payments', token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}

export async function POST(req: Request) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const denied = await denyUnlessPermitted(token, 'payments', 'create');
  if (denied) return denied;

  const body = await req.json();
  const res = await laravelApi('/payments', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json, { status: 201 });
}
