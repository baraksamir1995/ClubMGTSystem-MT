'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui';
import { SafeAvatar } from './safe-avatar';
import { activeBuckets } from '@/lib/offline/front-desk';
import type { CachedMember, CachedMembership } from '@/lib/offline/types';

/**
 * Cached member card: photo, name, number and membership summary, always
 * labelled "as of <snapshot time>" — cached validity is never shown as live.
 */
export function MemberSummary({
  member,
  memberships,
  asOf,
  large = false,
}: {
  member: CachedMember;
  memberships: CachedMembership[];
  asOf: string | null;
  large?: boolean;
}) {
  const t = useTranslations('attendance.frontDesk');
  const format = useFormatter();
  const active = activeBuckets(memberships);
  const name = member.full_name ?? '—';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <SafeAvatar name={name} src={member.photo_url} size={large ? 96 : 48} />
        <div className="min-w-0">
          <p className={`${large ? 'text-lg' : 'text-sm'} font-semibold text-fg truncate`}>{name}</p>
          {member.member_number != null && (
            <p className="text-xs text-fg-muted">{t('manual.number', { number: String(member.member_number) })}</p>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        {active.length === 0 ? (
          <p className="text-sm text-warning">{t('scan.noActive')}</p>
        ) : (
          active.map((b) => (
            <div key={b.membership_id} className="flex flex-wrap items-center gap-1.5 text-sm text-fg">
              <Badge variant="neutral" size="sm">{b.plan_type}</Badge>
              {b.sessions_remaining != null && (
                <span>{t('membership.sessionsLeft', { count: b.sessions_remaining })}</span>
              )}
              {b.end_date && (
                <span className="text-fg-muted">
                  {t('membership.until', { date: format.dateTime(new Date(`${b.end_date}T00:00:00`), { dateStyle: 'medium' }) })}
                </span>
              )}
              {b.freeze_status && b.freeze_status !== 'none' && <Badge variant="warning" size="sm">{t('membership.frozen')}</Badge>}
              {b.payment_status && b.payment_status !== 'paid' && (
                <Badge variant="warning" size="sm">{t('membership.unpaid', { status: b.payment_status })}</Badge>
              )}
            </div>
          ))
        )}
        {asOf && (
          <p className="text-xs text-fg-muted">
            {t('notes.asOfWarning', { time: format.dateTime(new Date(asOf), { dateStyle: 'medium', timeStyle: 'short' }) })}
          </p>
        )}
      </div>
    </div>
  );
}
