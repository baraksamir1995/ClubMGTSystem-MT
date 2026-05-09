import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/**
 * PATCH supports two payload shapes:
 *   - application/json — used by inline-edit form for text-only changes.
 *   - multipart/form-data — used when replacing the banner image (the
 *     uploaded file rides under "file"; everything else is form fields).
 * Backend ContentController::update() handles both.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const ct = req.headers.get('content-type') ?? '';
  const isMultipart = ct.startsWith('multipart/form-data');

  let res: Response;
  if (isMultipart) {
    // Bypass laravelApi() — its hardcoded JSON content-type would clobber
    // the multipart boundary that fetch sets automatically when given
    // FormData as body.
    //
    // PHP only parses multipart bodies for POST, not PATCH, so spoof the
    // method via Laravel's _method form field — the framework rewrites
    // the request to PATCH downstream.
    const fd = await req.formData();
    fd.set('_method', 'PATCH');
    res = await fetch(`${BACKEND_URL}/api/content/banners/${params.id}`, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: fd,
      cache: 'no-store',
    });
  } else {
    res = await laravelApi(`/content/banners/${params.id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(await req.json()),
    });
  }

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const res = await laravelApi(`/content/banners/${params.id}`, token, { method: 'DELETE' });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}
