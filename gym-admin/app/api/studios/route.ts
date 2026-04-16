import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export async function GET(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const branchId = req.nextUrl.searchParams.get('branchId') ?? req.nextUrl.searchParams.get('branch_id');
  const qs = branchId ? `?branch_id=${branchId}` : '';
  const res = await laravelApi(`/studios${qs}`, token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}

export async function POST(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const body = await req.json();
  const res = await laravelApi('/studios', token, {
    method: 'POST',
    body: JSON.stringify({
      name: body.name,
      branch_id: body.branchId ?? body.branch_id,
      capacity: body.capacity ?? null,
    }),
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json, { status: 201 });
}
