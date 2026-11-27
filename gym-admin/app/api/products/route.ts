import { proxyJson, readJson } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export async function GET() {
  return proxyJson('/products');
}

export async function POST(req: Request) {
  return proxyJson('/products', { method: 'POST', body: await readJson(req) });
}
