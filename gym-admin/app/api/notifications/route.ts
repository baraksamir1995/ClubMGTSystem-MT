import { NextRequest, NextResponse } from 'next/server';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  // Forward whitelisted query params so the client can paginate per tab
  // (e.g. ?status=scheduled&page=2&per_page=10). Raw passthrough would
  // expose any backend filter the user happened to know about — explicit
  // allowlist keeps surface area honest.
  const inUrl = new URL(req.url);
  const allowed = ['status', 'page', 'per_page'];
  const params = new URLSearchParams();
  for (const key of allowed) {
    const v = inUrl.searchParams.get(key);
    if (v != null && v !== '') params.set(key, v);
  }
  const qs = params.toString();
  const path = qs ? `/notifications?${qs}` : '/notifications';

  const res = await laravelApi(path, token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Failed' }, { status: res.status });
  // Preserve the full envelope ({data, pagination}) so the client can read
  // total / page-count, not just the items.
  return NextResponse.json(json);
}

export async function POST(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const body = await req.json();
  const res = await laravelApi('/notifications', token, {
    method: 'POST',
    body: JSON.stringify({
      title: body.title,
      body: body.body,
      recipient_type: body.recipientType ?? body.recipient_type ?? null,
      recipient_filter: body.recipientFilter ?? body.recipient_filter ?? null,
      scheduled_at: body.scheduledAt ?? body.scheduled_at ?? null,
      target_audience: body.targetAudience ?? body.target_audience ?? null,
    }),
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}
