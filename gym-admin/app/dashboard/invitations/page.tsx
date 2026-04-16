import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import InvitationsTable from '@/components/invitations/invitations-table';

export const dynamic = 'force-dynamic';

export interface Invitation {
  id: string;
  guest_name: string | null;
  guest_email: string;
  guest_phone: string;
  status: 'pending' | 'accepted' | 'active' | 'expired' | 'invalidated';
  duration_type: 'per_visit' | 'time_based';
  duration_days: number | null;
  max_visits: number;
  visits_used: number;
  expires_at: string;
  accepted_at: string | null;
  activated_at: string | null;
  pass_expires_at: string | null;
  invalidated_at: string | null;
  created_at: string;
  gym_members: {
    id: string;
    member_number: string | null;
    profiles: { full_name: string } | null;
  } | null;
}

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

async function fetchApi(path: string, token: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
export default async function InvitationsPage() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const invitationsData = await fetchApi('/invitations', token);
  const invitations = (invitationsData?.data ?? invitationsData ?? []) as Invitation[];

  return <InvitationsTable invitations={invitations} />;
}
