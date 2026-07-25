import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Layers } from 'lucide-react';
import SessionsTracker, {
  type SessionsMember,
} from '@/components/sessions/sessions-tracker';
import { mapSessionMemberRow, mapMeta, mapStats, EMPTY_META, EMPTY_STATS } from '@/lib/sessions-tracker';

export const dynamic = 'force-dynamic';

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
export default async function SessionsPage() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const { getMe } = await import('@/lib/get-permissions');
  const me = await getMe(token);
  if (!me?.gym_id) redirect('/dashboard');

  const t = await getTranslations('classes');

  // First page of session-plan members; the tracker paginates server-side from here.
  const membersData = await fetchApi('/sessions/members?per_page=10', token);
  const members: SessionsMember[] = (membersData?.data ?? []).map(mapSessionMemberRow);
  const meta = membersData?.meta ? mapMeta(membersData.meta) : EMPTY_META;
  const stats = membersData?.stats ? mapStats(membersData.stats) : EMPTY_STATS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-brand/20 rounded-xl flex items-center justify-center">
          <Layers className="w-5 h-5 text-brand" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-bold text-fg">{t('sessionTracker.pageTitle')}</h1>
          <p className="text-sm text-fg-muted">
            {t('sessionTracker.pageSubtitle')}
          </p>
        </div>
      </div>

      <SessionsTracker initialMembers={members} initialMeta={meta} initialStats={stats} />
    </div>
  );
}
