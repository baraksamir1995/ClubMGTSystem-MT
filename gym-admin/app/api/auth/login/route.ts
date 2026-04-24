import { NextResponse } from 'next/server';
import { createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

const loginLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

export async function POST(request: Request) {
  // Rate limit by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateCheck = loginLimiter.check(`login:${ip}`);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      { status: 429 },
    );
  }

  const body = await request.json();

  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  // Store the token in an httpOnly cookie
  const response = NextResponse.json(data);
  response.cookies.set('auth_token', data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
