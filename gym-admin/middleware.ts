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

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/webhooks|api/auth).*)',
  ],
};
