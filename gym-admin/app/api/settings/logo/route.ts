import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export async function POST(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  // Forward the file upload to Laravel
  const laravelFormData = new FormData();
  laravelFormData.append('file', file);

  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
  const res = await fetch(`${BACKEND_URL}/api/settings/logo`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: laravelFormData,
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  const result = json.data ?? json;
  return NextResponse.json({ logo_url: result.url ?? result.logo_url ?? null });
}
