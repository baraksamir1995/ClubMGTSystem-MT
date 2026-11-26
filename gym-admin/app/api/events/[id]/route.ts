import { proxyJson, readJson } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export async function PUT(req: Request, { params }: Ctx) {
  return proxyJson(`/admin/events/${encodeURIComponent(params.id)}`, { method: 'PUT', body: await readJson(req) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return proxyJson(`/admin/events/${encodeURIComponent(params.id)}`, { method: 'DELETE' });
}
