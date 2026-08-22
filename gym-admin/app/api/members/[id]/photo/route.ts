import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/** Upload / replace a member's profile photo. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const laravelFormData = new FormData();
  laravelFormData.append('file', file);

  const res = await fetch(`${BACKEND_URL}/api/members/${params.id}/photo`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: laravelFormData,
  });

  const json = await res.json();
  if (!res.ok) {
    // Laravel validation failures (bad type, too large) land in errors.file.
    const detail = json.errors?.file?.[0] ?? json.error ?? json.message ?? 'Upload failed';
    return NextResponse.json({ error: detail }, { status: res.status });
  }
  return NextResponse.json(json.data ?? json);
}

/** Remove a member's profile photo. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const res = await laravelApi(`/members/${params.id}/photo`, token, { method: 'DELETE' });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}
