import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, User, CreditCard, CalendarDays, Mail, Phone, MapPin, Hash, MailCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import VerifyEmailButton from '@/components/members/verify-email-button';
import MemberDetailActions from '@/components/members/member-detail-actions';
import MemberProfileTabs from '@/components/members/member-profile-tabs';
import OverviewLists from '@/components/members/overview-lists';
import { Avatar, Badge, type BadgeProps } from '@/components/ui';

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
const statusVariant: Record<string, BadgeProps['variant']> = {
  active:    'success',
  inactive:  'neutral',
  expired:   'danger',
  exhausted: 'danger',
  suspended: 'warning',
  cancelled: 'neutral',
  paused:    'neutral',
};

function getDisplayStatus(m: any): string {
  if (m.status === 'active' && m.end_date && new Date(m.end_date) < new Date()) return 'expired';
  return m.status;
}

const fmt = (amount: number, currency?: string | null) => {
  const ccy = currency || 'EGP';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy }).format(amount);
  } catch {
    return `${ccy} ${amount.toFixed(2)}`;
  }
};

export default async function MemberDetailPage({ params }: { params: { id: string } }) {
  const t = await getTranslations('members.detail');

  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  // Fetch member detail + plans from Laravel
  const [memberData, plansData] = await Promise.all([
    fetchApi(`/members/${params.id}`, token),
    fetchApi('/plans', token),
  ]);
  if (!memberData) notFound();

  const member = memberData.data ?? memberData;
  const profile = member.user ?? {};
  const memberships = member.memberships ?? [];
  const payments = memberData.payments ?? [];
  const attendanceLogs = member.attendance_logs ?? [];
  const serviceAssignments = memberData.service_assignments ?? [];
  const freezeLogs = memberData.freeze_logs ?? [];
  const availablePlans = plansData?.data ?? plansData ?? [];
  const gymMembers = memberData.gym_members_for_transfer ?? [];
  const promoMap = {};

  const isLive = (m: any): boolean => {
    if (m.status !== 'active' || m.payment_status !== 'paid') return false;
    if (m.end_date && new Date(m.end_date).getTime() < Date.now() - 86_400_000) return false;
    const planType = (m.plan ?? m.membership_plans)?.plan_type;
    const isSessionPlan = planType === 'sessions' || planType === 'duration_session';
    if (isSessionPlan && m.sessions_total != null && (m.sessions_remaining ?? 0) <= 0) return false;
    return true;
  };

  const currentMembership = memberships.find((m: any) =>
    isLive(m)
    && (m.source_type === 'subscription' || (m.source_type == null && !m.transferred_from))
  ) ?? null;
  const plan = currentMembership?.membership_plans ?? currentMembership?.plan ?? null;

  const transferredBuckets = (memberships ?? []).filter((m: any) =>
    isLive(m)
    && (m.source_type === 'transfer' || (m.source_type == null && m.transferred_from))
  );

  const activeAssignments = (serviceAssignments ?? []).filter(
    (a: any) => a.status === 'active'
  );
  const transferredSessionsTotal = transferredBuckets.reduce(
    (sum: number, b: any) => sum + (Number(b.sessions_total) || 0),
    0,
  );
  const transferredSessionsUsed = transferredBuckets.reduce(
    (sum: number, b: any) => sum + (Number(b.sessions_used) || 0),
    0,
  );

  const aggregateSessionsTotal = currentMembership?.sessions_total != null || transferredBuckets.length > 0
    ? (Number(currentMembership?.sessions_total) || 0) + transferredSessionsTotal
    : null;
  const aggregateSessionsUsed = (Number(currentMembership?.sessions_used) || 0) + transferredSessionsUsed;

  const candidateEndDates = [currentMembership?.end_date, ...transferredBuckets.map((b: any) => b.end_date)]
    .filter(Boolean)
    .map((d: string) => new Date(d));
  const aggregateEndDate = candidateEndDates.length > 0
    ? new Date(Math.min(...candidateEndDates.map((d: Date) => d.getTime())))
    : null;

  const transferredEndDates = transferredBuckets
    .map((b: any) => b.end_date)
    .filter(Boolean)
    .map((d: string) => new Date(d));
  const transferredEarliestExpiry = transferredEndDates.length > 0
    ? new Date(Math.min(...transferredEndDates.map((d: Date) => d.getTime())))
    : null;

  const displayName = profile?.full_name ?? String(member.member_number ?? '---');

  // getMembershipBadge uses translated strings
  function getMembershipBadge(m: any): { label: string; variant: BadgeProps['variant'] } | null {
    if (!m || m.status !== 'active') return null;
    const daysLeft = m.end_date
      ? Math.ceil((new Date(m.end_date).getTime() - Date.now()) / 86_400_000)
      : null;
    const sessionsLeft = m.sessions_total != null
      ? Math.max(0, m.sessions_total - (m.sessions_used ?? 0))
      : null;

    if (daysLeft !== null && daysLeft < 0)
      return { label: t('expiredAgo', { days: Math.abs(daysLeft) }), variant: 'danger' };
    if (daysLeft !== null && daysLeft <= 14)
      return { label: t('expiringIn', { days: daysLeft }), variant: 'warning' };
    if (sessionsLeft !== null && sessionsLeft === 0)
      return { label: t('noSessionsLeft'), variant: 'danger' };
    if (sessionsLeft !== null && sessionsLeft <= 2)
      return {
        label: sessionsLeft === 1
          ? t('sessionsLeftOne', { count: sessionsLeft })
          : t('sessionsLeftMany', { count: sessionsLeft }),
        variant: 'warning',
      };
    return null;
  }

  const personalInfoFields = [
    { icon: Phone,        label: t('phone'),       value: profile?.phone ?? '---', key: 'phone' },
    { icon: MapPin,       label: t('address'),     value: profile?.address ?? '---', key: 'address' },
    { icon: CalendarDays, label: t('dateOfBirth'), value: profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('en-GB') : '---', key: 'dob' },
    { icon: User,         label: t('gender'),      value: profile?.gender ?? '---', key: 'gender' },
    { icon: Hash,         label: t('notes'),       value: member.notes ?? '---', key: 'notes' },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link href="/dashboard/members" className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg transition-colors">
        <ChevronLeft className="w-4 h-4" /> {t('breadcrumb')}
      </Link>

      {/* Header */}
      <div className="bg-surface-2 border border-line rounded-xl p-6">
        <div className="flex items-center gap-4">
          <Avatar name={displayName} src={profile?.photo_url} size={56} />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-fg">{displayName}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-sm text-fg-muted font-mono">{member.member_number}</span>
              <Badge variant={statusVariant[member.status] ?? 'neutral'} className="capitalize">{member.status}</Badge>
              <span className="text-xs text-fg-faint">
                {t('joined', { date: member.joined_at ? new Date(member.joined_at).toLocaleDateString('en-GB') : '---' })}
              </span>
            </div>
          </div>
          <MemberDetailActions
            memberId={member.id}
            memberName={displayName}
            plans={availablePlans}
            currentPlanId={currentMembership?.status === 'active' ? currentMembership.plan_id : null}
            activeMembership={currentMembership?.status === 'active' ? {
              id:                 currentMembership.id,
              plan_name:          plan?.name ?? '---',
              plan_type:          plan?.plan_type ?? '',
              end_date:           currentMembership.end_date,
              sessions_used:      currentMembership.sessions_used ?? 0,
              sessions_total:     currentMembership.sessions_total ?? null,
              sessions_remaining: currentMembership.sessions_remaining,
              freeze_enabled:     plan?.freeze_enabled ?? false,
              freeze_status:      currentMembership.freeze_status ?? null,
              freeze_days_used:   currentMembership.freeze_days_used ?? 0,
              freeze_max_days:    plan?.freeze_max_days ?? null,
              freeze_count:       currentMembership.freeze_count ?? 0,
              freeze_max_count:   plan?.freeze_max_count ?? null,
              frozen_until:       currentMembership.frozen_until ?? null,
            } : null}
            gymMembers={gymMembers}
          />
        </div>
      </div>

      <MemberProfileTabs
        attendanceLogs={attendanceLogs}
        payments={payments}
        memberName={displayName}
        memberNumber={member.member_number ?? '---'}
        gymMemberId={params.id}
        membershipStart={currentMembership?.status === 'active' ? currentMembership.start_date : null}
        membershipEnd={currentMembership?.status === 'active' ? currentMembership.end_date : null}
        planName={plan?.name ?? null}
        overviewContent={<>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Info */}
        <div className="bg-surface-2 border border-line rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-brand" />
            <h2 className="text-sm font-semibold text-fg">{t('personalInfo')}</h2>
          </div>
          <dl className="space-y-3">
            {/* Email with verification status */}
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-fg-faint mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-fg-faint">{t('email')}</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-fg truncate">{profile?.email ?? '---'}</p>
                  {profile?.email && (
                    profile?.email_verified ? (
                      <Badge variant="success" size="sm"><MailCheck className="w-3 h-3" /> {t('verified')}</Badge>
                    ) : (
                      <Badge variant="warning" size="sm">{t('unverified')}</Badge>
                    )
                  )}
                  {profile?.email && !profile?.email_verified && (
                    <VerifyEmailButton memberId={member.id} memberName={displayName} emailVerified={profile?.email_verified} />
                  )}
                </div>
              </div>
            </div>
            {personalInfoFields.map(({ icon: Icon, label, value, key }) => (
              <div key={key} className="flex items-start gap-3">
                <Icon className="w-4 h-4 text-fg-faint mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-fg-faint">{label}</p>
                  <p className="text-sm text-fg truncate">{value}</p>
                </div>
              </div>
            ))}
          </dl>
        </div>

        {/* Active Services */}
        <div className="bg-surface-2 border border-line rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-brand" />
            <h2 className="text-sm font-semibold text-fg">{t('activeServices')}</h2>
          </div>

          {!currentMembership && transferredBuckets.length === 0 && activeAssignments.length === 0 ? (
            <p className="text-sm text-fg-faint">{t('noActiveServices')}</p>
          ) : (
            <div className="space-y-3">
              <div className="bg-surface-3/40 rounded-lg p-4 border border-line">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-fg font-semibold">
                    {currentMembership ? (plan?.name ?? '---') : t('transferredSessionsOnly')}
                  </p>
                  {currentMembership && (
                    <Badge variant={statusVariant[getDisplayStatus(currentMembership)] ?? 'neutral'} className="capitalize">
                      {getDisplayStatus(currentMembership)}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-fg-muted capitalize mb-2">
                  {currentMembership
                    ? t('planType', { type: plan?.plan_type?.replace('_', ' ') ?? '' })
                    : t('noActiveSubscription')}
                </p>
                {currentMembership && (() => {
                  const badge = getMembershipBadge(currentMembership);
                  return badge ? (
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  ) : null;
                })()}
                {currentMembership && plan?.price != null && (
                  <p className="text-sm font-medium text-brand mt-1">{fmt(plan.price, plan.currency)}</p>
                )}
              </div>
              <dl className="space-y-2">
                {[
                  {
                    label: t('startDate'),
                    value: currentMembership?.start_date
                      ? new Date(currentMembership.start_date).toLocaleDateString('en-GB')
                      : '---',
                  },
                  {
                    label: t('expiryDate'),
                    value: aggregateEndDate ? aggregateEndDate.toLocaleDateString('en-GB') : t('noExpiry'),
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <dt className="text-xs text-fg-faint">{label}</dt>
                    <dd className="text-xs text-fg">{value}</dd>
                  </div>
                ))}
                {aggregateSessionsTotal != null && aggregateSessionsTotal > 0 && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-xs text-fg-faint">{t('sessionsUsed')}</dt>
                      <dd className="text-xs text-fg">
                        {aggregateSessionsUsed} / {aggregateSessionsTotal}
                      </dd>
                    </div>
                    <div className="w-full bg-surface-3 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-brand h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.round(aggregateSessionsUsed / aggregateSessionsTotal * 100))}%` }}
                      />
                    </div>
                    {transferredBuckets.length > 0 && (
                      <p className="text-[11px] text-fg-faint italic">
                        {transferredSessionsTotal === 1
                          ? t('includesTransfers', { count: transferredSessionsTotal })
                          : t('includesTransfersPlural', { count: transferredSessionsTotal })}
                        {transferredEarliestExpiry && (
                          transferredBuckets.length > 1
                            ? t('transfersExpireSoonestEarliest', { date: transferredEarliestExpiry.toLocaleDateString('en-GB') })
                            : t('transfersExpireSoonest', { date: transferredEarliestExpiry.toLocaleDateString('en-GB') })
                        )}
                      </p>
                    )}
                  </>
                )}
              </dl>

              {/* Freeze status + history */}
              {currentMembership && plan?.freeze_enabled && (
                <div className="mt-4 pt-4 border-t border-line">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide">{t('freezeHistory')}</p>
                    {currentMembership.freeze_status === 'frozen' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400 text-xs font-medium">
                        {t('frozenUntil', { date: currentMembership.frozen_until ? new Date(currentMembership.frozen_until).toLocaleDateString('en-GB') : '---' })}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 mb-3">
                    <div>
                      <p className="text-xs text-fg-faint">{t('freezeDaysUsed')}</p>
                      <p className="text-sm font-semibold text-fg">{currentMembership.freeze_days_used ?? 0} / {plan.freeze_max_days ?? '...'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-fg-faint">{t('freezesUsed')}</p>
                      <p className="text-sm font-semibold text-fg">{currentMembership.freeze_count ?? 0} / {plan.freeze_max_count ?? '...'}</p>
                    </div>
                  </div>
                  {freezeLogs && freezeLogs.length > 0 ? (
                    <div className="space-y-1.5">
                      {(freezeLogs as any[]).map((log: any, i: number) => (
                        <div key={log.id} className="flex items-center justify-between py-1.5 border-b border-line last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-fg-faint">#{i + 1}</span>
                            <span className="text-xs text-fg">
                              {new Date(log.frozen_at).toLocaleDateString('en-GB')} &rarr; {new Date(log.frozen_until).toLocaleDateString('en-GB')}
                            </span>
                            <span className="text-xs text-blue-400">{log.freeze_days}d</span>
                          </div>
                          {log.resumed_at ? (
                            <span className="text-xs text-emerald-400">{t('freezeResumed')}</span>
                          ) : (
                            <span className="text-xs text-blue-400">{t('freezeActive')}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-fg-faint">{t('noFreezeHistory')}</p>
                  )}
                </div>
              )}

              {/* Active service-assignment rows */}
              {activeAssignments.length > 0 && (
                <div className={`pt-4 ${currentMembership || transferredBuckets.length > 0 ? 'mt-4 border-t border-line' : ''} space-y-3`}>
                  {activeAssignments.map((a: any) => {
                    const used = Number(a.sessions_used) || 0;
                    const total = Number(a.sessions_total) || 0;
                    const left = Math.max(0, total - used);
                    const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
                    const labelMap: Record<string, string> = {
                      personal_trainer: 'Personal Training',
                      nutritionist:     'Nutrition',
                      physiotherapist:  'Physiotherapy',
                    };
                    const label = labelMap[a.service_type] ?? (a.service_type ?? '').toString().replace('_', ' ');
                    return (
                      <div key={a.id} className="bg-surface-3/40 rounded-lg p-4 border border-line">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <div className="min-w-0">
                            <p className="text-fg font-semibold truncate">{a.package_name ?? 'Package'}</p>
                            <p className="text-xs text-fg-muted capitalize mt-0.5">
                              {label}{a.trainer_name ? ` · ${t('withTrainer', { name: a.trainer_name })}` : ''}
                            </p>
                          </div>
                          <Badge variant="success" size="sm" className="shrink-0">{t('freezeActive')}</Badge>
                        </div>
                        {total > 0 && (
                          <>
                            <div className="flex justify-between mt-2">
                              <dt className="text-xs text-fg-faint">{t('sessionsUsed')}</dt>
                              <dd className="text-xs text-fg">{used} / {total}</dd>
                            </div>
                            <div className="w-full bg-surface-3 rounded-full h-1.5 mt-1">
                              <div
                                className="bg-brand h-1.5 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="text-[11px] text-fg-faint mt-1">
                              {left === 1
                                ? t('sessionsLeftOne', { count: left })
                                : t('sessionsLeftMany', { count: left })}
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <OverviewLists
          memberships={memberships}
          promoMap={promoMap}
        />
      </div>

        </>}
      />
    </div>
  );
}
