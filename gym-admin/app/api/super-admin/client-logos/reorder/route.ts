import { NextRequest, NextResponse } from 'next/server';
import { resolveSuperAdmin } from '@/lib/resolve-super-admin';

export const dynamic = 'force-dynamic';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function POST(req: NextRequest) {
  const auth = await resolveSuperAdmin();
  if (auth.response) return auth.response;

  const body = await req.json();
  const res = await fetch(`${BACKEND_URL}/api/super-admin/client-logos/reorder`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) return NextResponse.json({ error: json?.message ?? json?.error ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json);
}
