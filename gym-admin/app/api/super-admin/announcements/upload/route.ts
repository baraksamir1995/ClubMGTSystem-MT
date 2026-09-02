import { NextRequest, NextResponse } from 'next/server';
import { resolveSuperAdmin } from '@/lib/resolve-super-admin';
import { IMAGE_MIME_TO_EXT, validateImageUpload } from '@/lib/upload-validation';

export const dynamic = 'force-dynamic';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/**
 * Announcement media. Extends the shared image allowlist with the video
 * containers a browser can play inline, since a "What's New" update is
 * often a short screen capture.
 *
 * The ceiling is 10 MB, not the images-only 5 MB: php-fpm in the API
 * image caps the request body at 12 MB (see the Dockerfile), so anything
 * larger is refused by the server before it reaches Laravel anyway.
 * Longer videos belong on YouTube/Vimeo — the form takes a URL for that.
 */
const ANNOUNCEMENT_MIME_TO_EXT: Record<string, string> = {
  ...IMAGE_MIME_TO_EXT,
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const auth = await resolveSuperAdmin();
  if (auth.response) return auth.response;

  const formData = await req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const check = validateImageUpload(file, ANNOUNCEMENT_MIME_TO_EXT, MAX_MEDIA_BYTES);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const res = await fetch(`${BACKEND_URL}/api/super-admin/announcements/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' },
    body: formData,
  });

  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: json.message ?? json.error ?? 'Upload failed' }, { status: res.status });
  }
  return NextResponse.json(json);
}
