import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId } from '@/lib/api-gym-id';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const laravelFormData = new FormData();
  laravelFormData.append('file', file);

  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
  const res = await fetch(`${BACKEND_URL}/api/branches/${params.id}/upload-image`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: laravelFormData,
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}
