import type { NextRequest } from 'next/server';
import { proxyToLaravel } from '@/lib/attendance-offline-proxy';

export const dynamic = 'force-dynamic';

const RESULTS = new Set(['rejected', 'accepted', 'duplicate', 'error']);
const MAX_LIMIT = 200;

/**
 * GET /api/attendance/offline/events?result=&needs_review=1&cursor=&limit= → clby-api
 * (PHASE2-CONTRACT staff review endpoint; read-only). Only known params are forwarded.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  const result = searchParams.get('result');
  if (result && RESULTS.has(result)) params.set('result', result);
  if (searchParams.get('needs_review') === '1') params.set('needs_review', '1');
  const cursor = searchParams.get('cursor');
  if (cursor && cursor.length <= 200) params.set('cursor', cursor);
  const limit = searchParams.get('limit');
  if (limit && /^\d{1,4}$/.test(limit) && Number(limit) >= 1) params.set('limit', String(Math.min(Number(limit), MAX_LIMIT)));
  const qs = params.toString();
  return proxyToLaravel(req, `/attendance/offline/events${qs ? `?${qs}` : ''}`, { method: 'GET' });
}
