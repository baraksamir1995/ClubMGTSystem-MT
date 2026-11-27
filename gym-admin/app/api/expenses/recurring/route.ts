import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';
import { denyUnlessPermitted } from '@/lib/get-permissions';

const FORWARD = ['status', 'search'];

export async function GET(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  for (const key of FORWARD) {
    const v = searchParams.get(key);
    if (v) params.set(key, v);
  }
  const res = await laravelApi(`/expenses/recurring${params.toString() ? `?${params}` : ''}`, token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json);
}

export async function POST(req: Request) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const denied = await denyUnlessPermitted(token, 'payments', 'create');
  if (denied) return denied;

  const body = await req.json();
  const res = await laravelApi('/expenses/recurring', token, { method: 'POST', body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed', errors: json.errors }, { status: res.status });
  return NextResponse.json(json.data ?? json, { status: 201 });
}
