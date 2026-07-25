import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/**
 * Catch-all proxy for the Sales & Leads module.
 *
 * Forwards /api/sales/<path>?<query> verbatim to the Laravel backend with
 * the caller's Sanctum token. Row-level scoping (rep vs manager vs admin)
 * and module permissions are enforced backend-side by SalesAccess +
 * permission:sales,* middleware, so this proxy stays thin on purpose.
 *
 * Status codes are passed through untouched — the UI relies on them
 * (e.g. 409 duplicate-lead responses carry an `existing_lead` payload,
 * 422 carries validation errors).
 */
async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const cookieStore = await cookies();
  // Handle URL-encoded pipe character (Sanctum tokens contain |)
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = `${BACKEND_URL}/api/sales/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };

  const init: RequestInit = { method: req.method, headers, cache: 'no-store' };

  // Forward the request body on mutating methods.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const body = await req.text();
    if (body) {
      init.body = body;
      headers['Content-Type'] = req.headers.get('content-type') ?? 'application/json';
    }
  }

  try {
    const res = await fetch(url, init);
    const text = await res.text();
    return new NextResponse(text || null, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}

export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
