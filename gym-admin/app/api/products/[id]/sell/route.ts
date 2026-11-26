import { proxyJson, readJson } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return proxyJson(`/products/${encodeURIComponent(params.id)}/sell`, { method: 'POST', body: await readJson(req) });
}
