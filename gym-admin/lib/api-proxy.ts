import { NextResponse } from 'next/server';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';
import { validateImageUpload } from '@/lib/upload-validation';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/**
 * Thin JSON pass-through proxy for gym-admin API routes.
 *
 * Unlike the older per-route proxies, the error body keeps `code` and the
 * Laravel validation `errors` bag so the client can branch on machine codes
 * (`out_of_stock`, `has_paid_registrations`, …) and `apiErrorMessage()` can
 * surface the most specific message. Laravel itself enforces permissions
 * (`permission:<module>,<action>` middleware) and gym scoping.
 */
export async function proxyJson(
  path: string,
  init: { method?: string; body?: unknown; successStatus?: number } = {},
): Promise<NextResponse> {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;

  let res: Response;
  try {
    res = await laravelApi(path, resolved.token, {
      method: init.method ?? 'GET',
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) return errorResponse(json, res.status);
  return NextResponse.json(json ?? {}, { status: init.successStatus ?? res.status });
}

/** Forward a multipart image upload (`file` field) to a Laravel upload endpoint. */
export async function proxyImageUpload(req: Request, path: string): Promise<NextResponse> {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const check = validateImageUpload(file);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const forward = new FormData();
  forward.append('file', file as File);

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${resolved.token}` },
      body: forward,
    });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) return errorResponse(json, res.status);
  const result = json?.data ?? json ?? {};
  return NextResponse.json({ url: result.url ?? null });
}

/** Parse a JSON request body, tolerating an empty body. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  return (await req.json().catch(() => ({}))) ?? {};
}

function errorResponse(json: unknown, status: number): NextResponse {
  const body = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  return NextResponse.json(
    {
      error: body.error ?? body.message ?? 'Failed',
      ...(body.code ? { code: body.code } : {}),
      ...(body.errors ? { errors: body.errors } : {}),
    },
    { status },
  );
}
