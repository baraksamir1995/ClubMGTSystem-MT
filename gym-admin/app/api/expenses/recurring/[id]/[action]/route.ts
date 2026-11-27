import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';
import { denyUnlessPermitted } from '@/lib/get-permissions';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Lifecycle transitions → the permission each needs (mirrors routes/api.php).
const ACTIONS: Record<string, 'edit' | 'delete'> = {
  pause: 'edit',
  resume: 'edit',
  end: 'delete',
};

export async function POST(_req: Request, { params }: { params: { id: string; action: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const perm = ACTIONS[params.action];
  if (!perm || !UUID_RE.test(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const denied = await denyUnlessPermitted(token, 'payments', perm);
  if (denied) return denied;

  const res = await laravelApi(`/expenses/recurring/${params.id}/${params.action}`, token, { method: 'POST' });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}
