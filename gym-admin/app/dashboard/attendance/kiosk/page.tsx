import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { MonitorPlay } from 'lucide-react';
import { kioskAccess, loadBranches } from './load-branches';

export const dynamic = 'force-dynamic';

/** Branch picker for the check-in kiosk (PHASE3-CONTRACT §5). */
export default async function KioskIndex() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');
  const access = await kioskAccess(token);
  if (!access) redirect('/dashboard/attendance');

  const t = await getTranslations('attendance.kiosk');
  const branches = (await loadBranches(token)).filter((b) => b.is_active !== false);
  if (branches.length === 1) redirect(`/dashboard/attendance/kiosk/${branches[0].id}`);

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-bold text-fg">{t('title')}</h1>
      <p className="text-sm text-fg-muted">{t('chooseBranch')}</p>
      {branches.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('noBranches')}</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface-2">
          {branches.map((b) => (
            <li key={b.id}>
              <Link
                href={`/dashboard/attendance/kiosk/${b.id}`}
                className="flex items-center gap-3 px-4 py-3 text-fg hover:bg-surface-3 focus:outline-none focus-visible:bg-surface-3"
              >
                <MonitorPlay className="w-4 h-4 text-brand" aria-hidden />
                <span className="flex-1">{b.name}</span>
                <span className="text-xs text-fg-muted">{t('open')}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
