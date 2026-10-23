import { NextResponse } from 'next/server';
import { createRateLimiter } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

const resetLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

/**
 * Public — consumes the single-use token from a gym-owner setup email (or a
 * password-reset email) via the API's POST /auth/reset-password. No session
 * cookie is set; the owner signs in normally afterwards.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!resetLimiter.check(`reset:${ip}`).allowed) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const res = await fetch(`${BACKEND_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      token: body?.token,
      password: body?.password,
      password_confirmation: body?.password_confirmation,
    }),
  });
  const data = await res.json().catch(() => ({ error: 'Failed' }));
  return NextResponse.json(data, { status: res.status });
}
