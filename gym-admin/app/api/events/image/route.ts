import { proxyImageUpload } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return proxyImageUpload(req, '/admin/events/image');
}
