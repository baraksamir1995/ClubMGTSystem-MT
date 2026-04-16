import { NextRequest, NextResponse } from 'next/server';
import { resolveGymId } from '@/lib/api-gym-id';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function POST(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const uploadForm = new FormData();
  uploadForm.append('file', file);
  uploadForm.append('folder', 'classes');

  const res = await fetch(`${BACKEND_URL}/api/files/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    body: uploadForm,
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Upload failed' }, { status: res.status });
  return NextResponse.json({ url: json.data?.url });
}
