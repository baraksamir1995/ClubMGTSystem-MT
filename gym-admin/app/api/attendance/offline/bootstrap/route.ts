import type { NextRequest } from 'next/server';
import { proxyToLaravel } from '@/lib/attendance-offline-proxy';

export const dynamic = 'force-dynamic';

/** GET /api/attendance/offline/bootstrap?cursor=&limit= → clby-api (CONTRACT §3). */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  const cursor = searchParams.get('cursor');
  const limit = searchParams.get('limit');
  if (cursor) params.set('cursor', cursor);
  if (limit && /^\d{1,5}$/.test(limit)) params.set('limit', limit);
  const qs = params.toString();
  return proxyToLaravel(req, `/attendance/offline/bootstrap${qs ? `?${qs}` : ''}`, { method: 'GET' });
}
