import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

// Public endpoint — no auth required — for the member-facing app
export async function GET(_req: NextRequest, { params }: { params: { gymId: string } }) {
  const res = await fetch(`${BACKEND_URL}/api/schedule/public/${params.gymId}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}
