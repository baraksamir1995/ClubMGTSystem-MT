import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/**
 * Streams the CSV response straight through from the Laravel side so a
 * gym with months of session history doesn't have to be buffered in
 * the Next process. Same filter set as `/api/service-logs`.
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const raw = cookieStore.get('auth_token')?.value ?? '';
  const token = raw.includes('%') ? decodeURIComponent(raw) : raw;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const qs = new URLSearchParams();
  for (const key of ['q', 'trainer_id', 'branch_id']) {
    const v = req.nextUrl.searchParams.get(key);
    if (v) qs.set(key, v);
  }
  const url = `${BACKEND_URL}/api/service-logs/export${qs.toString() ? `?${qs}` : ''}`;

  const upstream = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/csv' },
    cache: 'no-store',
  });
  if (!upstream.ok) {
    const body = await upstream.text();
    return new NextResponse(body, { status: upstream.status });
  }

  // Pipe the response body through; preserve Content-Type +
  // Content-Disposition so the browser opens a download dialog with
  // the right filename.
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type':        upstream.headers.get('content-type')        ?? 'text/csv; charset=UTF-8',
      'Content-Disposition': upstream.headers.get('content-disposition') ?? 'attachment; filename="services-log.csv"',
      'Cache-Control':       'no-store',
    },
  });
}
