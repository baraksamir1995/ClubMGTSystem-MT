import { proxyJson } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return proxyJson(`/admin/events/${encodeURIComponent(params.id)}/registrations`);
}
