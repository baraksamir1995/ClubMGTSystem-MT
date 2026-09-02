import { NextRequest, NextResponse } from 'next/server';
import { resolveSuperAdmin } from '@/lib/resolve-super-admin';

export const dynamic = 'force-dynamic';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function POST(req: NextRequest) {
  const auth = await resolveSuperAdmin();
  if (auth.response) return auth.response;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const laravelFormData = new FormData();
  laravelFormData.append('file', file);

  const res = await fetch(`${BACKEND_URL}/api/super-admin/client-logos/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' },
    body: laravelFormData,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) return NextResponse.json({ error: json?.message ?? json?.error ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json?.data ?? json ?? {});
}
