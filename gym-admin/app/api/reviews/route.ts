import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export async function GET() {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const res = await laravelApi('/reviews', token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Failed' }, { status: res.status });

  const rawReviews = json.data ?? json ?? [];

  // Build profile lookup from nested gym_member.user data
  const profiles: Record<string, string> = {};

  // Remap Laravel relationship names to the shape the frontend expects
  const reviews = rawReviews.map((r: any) => {
    const session = r.session ?? r.class_sessions ?? null;
    const cls = session?.class_model ?? session?.classes ?? null;
    const member = r.gym_member ?? r.gym_members ?? null;
    const user = member?.user ?? null;

    if (user?.id) {
      profiles[user.id] = user.full_name ?? 'Member';
    }

    return {
      id: r.id,
      session_rating: r.session_rating,
      trainer_rating: r.trainer_rating,
      review: r.review,
      created_at: r.created_at,
      class_sessions: session ? {
        id: session.id,
        session_date: session.session_date,
        start_time: session.start_time,
        classes: cls ? {
          id: cls.id,
          name: cls.name,
          class_type: cls.class_type ?? null,
          color: cls.color ?? null,
          instructor: session?.instructor ?? cls.instructor ?? null,
        } : null,
      } : null,
      gym_members: member ? {
        id: member.id,
        user_id: member.user_id,
        member_number: member.member_number ?? null,
      } : null,
    };
  });

  return NextResponse.json({ reviews, profiles });
}
