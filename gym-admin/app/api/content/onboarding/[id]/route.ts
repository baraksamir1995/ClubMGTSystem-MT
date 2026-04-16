import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId } from '@/lib/api-gym-id';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const formData = await req.formData();

  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
  const res = await fetch(`${BACKEND_URL}/api/content/onboarding/${params.id}`, {
    method: 'POST', // Laravel uses POST with _method=PATCH for multipart
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    body: (() => { formData.append('_method', 'PATCH'); return formData; })(),
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
  const res = await fetch(`${BACKEND_URL}/api/content/onboarding/${params.id}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}
