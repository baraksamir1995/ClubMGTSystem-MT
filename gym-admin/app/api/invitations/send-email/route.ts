import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { laravelApi } from '@/lib/api-gym-id';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

// POST /api/invitations/send-email
// Public endpoint — authenticated via invitation_token (UUID).
// Called by the Flutter app immediately after creating an invitation.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { invitation_token } = body as { invitation_token: string };

  if (!invitation_token) {
    return NextResponse.json({ error: 'invitation_token is required' }, { status: 400 });
  }

  // This is a public endpoint — try to use auth token if available, otherwise call without
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '') ?? '';

  const res = await fetch(`${BACKEND_URL}/api/invitations/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ invitation_token }),
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}
