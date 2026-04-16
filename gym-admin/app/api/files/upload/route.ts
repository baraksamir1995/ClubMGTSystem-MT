import { NextRequest, NextResponse } from 'next/server';
import { resolveGymId } from '@/lib/api-gym-id';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function POST(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const formData = await req.formData();

  const res = await fetch(`${BACKEND_URL}/api/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: formData,
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Upload failed' }, { status: res.status });
  return NextResponse.json({ url: json.url ?? json.data?.url, path: json.path ?? json.data?.path });
}
