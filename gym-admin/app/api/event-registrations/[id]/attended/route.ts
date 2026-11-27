import { proxyJson, readJson } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return proxyJson(`/admin/event-registrations/${encodeURIComponent(params.id)}/attended`, { method: 'POST', body: await readJson(req) });
}
