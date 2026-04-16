import { NextResponse, type NextRequest } from 'next/server';

// SECURITY: MEDIUM-3 — In-memory login attempt rate limiter (per IP, 10 req/min)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_RATE_LIMIT = 10;
const LOGIN_WINDOW_MS = 60_000;

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= LOGIN_RATE_LIMIT;
}

export async function middleware(request: NextRequest) {
  // SECURITY: MEDIUM-3 — Rate limit login page access
  if (request.nextUrl.pathname === '/login' && request.method === 'POST') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (!checkLoginRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 },
      );
    }
  }

  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;

  // Helper: redirect
  const redirect = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    return NextResponse.redirect(url);
  };

  // Redirect unauthenticated users to /login
  if (!token && pathname !== '/login') {
    return redirect('/login');
  }

  // Don't redirect /login → /dashboard. Let the login page handle it.
  // This prevents redirect loops when the token exists but is invalid.

  // Pass the current URL to server components via header
  const response = NextResponse.next();
  response.headers.set('x-pathname', pathname);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/webhooks|api/auth).*)',
  ],
};
