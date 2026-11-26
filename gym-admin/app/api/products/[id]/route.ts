import { proxyJson, readJson } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, { params }: Ctx) {
  return proxyJson(`/products/${encodeURIComponent(params.id)}`, { method: 'PATCH', body: await readJson(req) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return proxyJson(`/products/${encodeURIComponent(params.id)}`, { method: 'DELETE' });
}
