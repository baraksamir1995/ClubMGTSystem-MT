import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';
import { denyUnlessPermitted } from '@/lib/get-permissions';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const res = await laravelApi(`/expenses/recurring/${params.id}`, token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}

/** "Edit this and future occurrences" — the body's start_date is the effective date. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const denied = await denyUnlessPermitted(token, 'payments', 'edit');
  if (denied) return denied;

  const body = await req.json();
  const res = await laravelApi(`/expenses/recurring/${params.id}`, token, { method: 'PUT', body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed', errors: json.errors }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}
