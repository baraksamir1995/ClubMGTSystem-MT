import type { NextRequest } from 'next/server';
import { proxyToLaravel } from '@/lib/attendance-offline-proxy';

export const dynamic = 'force-dynamic';

/** GET /api/attendance/offline/status?device_id= → clby-api (CONTRACT §3). */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('device_id') ?? req.headers.get('x-device-id');
  const params = new URLSearchParams();
  if (deviceId && deviceId.length <= 128) params.set('device_id', deviceId);
  const qs = params.toString();
  return proxyToLaravel(req, `/attendance/offline/status${qs ? `?${qs}` : ''}`, { method: 'GET' });
}
