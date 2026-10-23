import { NextRequest, NextResponse } from 'next/server';
import { resolveSuperAdmin } from '@/lib/resolve-super-admin';

export const dynamic = 'force-dynamic';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

// Review transitions exposed by GymRequestController — anything else 404s
// here rather than being forwarded.
const ACTIONS = new Set(['approve', 'decline', 'reopen', 'resend-email']);

export async function POST(req: NextRequest, { params }: { params: { id: string; action: string } }) {
  if (!ACTIONS.has(params.action)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const auth = await resolveSuperAdmin();
  if (auth.response) return auth.response;

  const body = await req.text();
  const res = await fetch(`${BACKEND_URL}/api/super-admin/gym-requests/${encodeURIComponent(params.id)}/${params.action}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body || '{}',
  });
  const json = await res.json().catch(() => ({ error: 'Failed' }));
  return NextResponse.json(json, { status: res.status });
}
