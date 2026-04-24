import { NextRequest, NextResponse } from 'next/server';
import { resolveSuperAdmin } from '@/lib/resolve-super-admin';

export const dynamic = 'force-dynamic';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function GET(req: NextRequest) {
  const auth = await resolveSuperAdmin();
  if (auth.response) return auth.response;

  const qs = new URL(req.url).searchParams.toString();
  const res = await fetch(`${BACKEND_URL}/api/super-admin/leads${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json);
}
