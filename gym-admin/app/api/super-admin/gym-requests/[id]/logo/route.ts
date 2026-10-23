import { NextRequest, NextResponse } from 'next/server';
import { resolveSuperAdmin } from '@/lib/resolve-super-admin';

export const dynamic = 'force-dynamic';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

// Multipart passthrough — replace the logo on a pending gym request.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await resolveSuperAdmin();
  if (auth.response) return auth.response;

  const form = await req.formData();
  const res = await fetch(`${BACKEND_URL}/api/super-admin/gym-requests/${encodeURIComponent(params.id)}/logo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' },
    body: form,
  });
  const json = await res.json().catch(() => ({ error: 'Failed' }));
  return NextResponse.json(json, { status: res.status });
}
