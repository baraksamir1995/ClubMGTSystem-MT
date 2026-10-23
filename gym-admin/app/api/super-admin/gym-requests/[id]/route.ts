import { NextRequest, NextResponse } from 'next/server';
import { resolveSuperAdmin } from '@/lib/resolve-super-admin';

export const dynamic = 'force-dynamic';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await resolveSuperAdmin();
  if (auth.response) return auth.response;

  const res = await fetch(`${BACKEND_URL}/api/super-admin/gym-requests/${encodeURIComponent(params.id)}`, {
    headers: { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({ error: 'Failed' }));
  return NextResponse.json(json, { status: res.status });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await resolveSuperAdmin();
  if (auth.response) return auth.response;

  const res = await fetch(`${BACKEND_URL}/api/super-admin/gym-requests/${encodeURIComponent(params.id)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${auth.token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: await req.text(),
  });
  const json = await res.json().catch(() => ({ error: 'Failed' }));
  return NextResponse.json(json, { status: res.status });
}
