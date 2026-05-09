import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId } from '@/lib/api-gym-id';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/**
 * Image-replace endpoint — POST multipart/form-data with the new file under
 * `file`. We hit Laravel directly (not laravelApi) because that helper sets
 * Content-Type: application/json which would clobber the multipart boundary.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const res = await fetch(`${BACKEND_URL}/api/content/banners/${params.id}/image`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    body: await req.formData(),
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}
