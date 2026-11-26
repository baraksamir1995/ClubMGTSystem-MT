import { proxyJson, readJson } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export async function GET() {
  return proxyJson('/admin/events');
}

export async function POST(req: Request) {
  return proxyJson('/admin/events', { method: 'POST', body: await readJson(req) });
}
