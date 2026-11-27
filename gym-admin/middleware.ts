import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;

  // Helper: redirect
  const redirect = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    return NextResponse.redirect(url);
  };

  // Public pages: /set-password is opened from the gym-owner approval email
  // before the owner has ever signed in.
  if (pathname === '/set-password') {
    return NextResponse.next();
  }

  // Offline-attendance sync APIs are called by background code (sync engine,
  // later a service worker) that must see a real 401 — a redirect to the
  // /login HTML would look like a 200. Still unauthenticated → still blocked;
  // the route handlers additionally verify the token via resolveGymId().
  if (!token && isOfflineAttendanceApi(pathname)) {
    return NextResponse.json({ error: 'Unauthorized', code: 'auth_required' }, { status: 401 });
  }

  // Redirect unauthenticated users to /login
  if (!token && pathname !== '/login') {
    return redirect('/login');
  }

  // Allow super-admin routes (they have their own layout auth check)
  if (pathname.startsWith('/super-admin')) {
    return NextResponse.next();
  }

  // Don't redirect /login → /dashboard. Let the login page handle it.
  // This prevents redirect loops when the token exists but is invalid.

  // Pass the current URL to server components via header
  const response = NextResponse.next();
  response.headers.set('x-pathname', pathname);
  return response;
}

/** Exact paths only — no prefix match on /api/attendance or /api/members itself. */
function isOfflineAttendanceApi(pathname: string): boolean {
  return (
    pathname === '/api/attendance/sync' ||
    pathname.startsWith('/api/attendance/offline/') ||
    /^\/api\/members\/[^/]+\/member-pass$/.test(pathname) ||
    /^\/api\/branches\/[^/]+\/qr(?:\/rotating-batch)?$/.test(pathname)
  );
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/webhooks|api/auth).*)',
  ],
};
