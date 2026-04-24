import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, User, CreditCard, CalendarDays, Mail, Phone, MapPin, Hash, MailCheck } from 'lucide-react';
import VerifyEmailButton from '@/components/members/verify-email-button';
import MemberDetailActions from '@/components/members/member-detail-actions';
import MemberProfileTabs from '@/components/members/member-profile-tabs';
import OverviewLists from '@/components/members/overview-lists';
import ServicePackagesList from '@/components/members/service-packages-list';
import SessionTransfersList from '@/components/members/session-transfers-list';

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
const statusColor: Record<string, string> = {
  active:    'bg-emerald-400/10 text-emerald-400',
  inactive:  'bg-gray-400/10 text-gray-400',
  expired:   'bg-red-400/10 text-red-400',
  exhausted: 'bg-red-400/10 text-red-400',
  suspended: 'bg-amber-400/10 text-amber-400',
  cancelled: 'bg-gray-400/10 text-gray-400',
  paused:    'bg-blue-400/10 text-blue-400',
};

function getMembershipBadge(m: any): { label: string; cls: string } | null {
  if (!m || m.status !== 'active') return null;
  const daysLeft = m.end_date
    ? Math.ceil((new Date(m.end_date).getTime() - Date.now()) / 86_400_000)
    : null;
  const sessionsLeft = m.sessions_total != null
    ? Math.max(0, m.sessions_total - (m.sessions_used ?? 0))
    : null;

  if (daysLeft !== null && daysLeft < 0)
    return { label: `Expired ${Math.abs(daysLeft)}d ago`, cls: 'bg-red-400/10 text-red-400' };
  if (daysLeft !== null && daysLeft <= 14)
    return { label: `Expiring in ${daysLeft}d`, cls: 'bg-amber-400/10 text-amber-400' };
  if (sessionsLeft !== null && sessionsLeft === 0)
    return { label: 'No sessions left', cls: 'bg-red-400/10 text-red-400' };
  if (sessionsLeft !== null && sessionsLeft <= 2)
    return { label: `${sessionsLeft} session${sessionsLeft !== 1 ? 's' : ''} left`, cls: 'bg-orange-400/10 text-orange-400' };
  return null;
}

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

  const currentMembership = memberships.find((m: any) => m.status === 'active') ?? null;
  const plan = currentMembership?.membership_plans ?? currentMembership?.plan ?? null;

  const displayName = profile?.full_name ?? String(member.member_number ?? '---');
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link href="/dashboard/members" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors">
        <ChevronLeft className="w-4 h-4" /> Members
      </Link>

      {/* Header */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-4">
          {profile?.photo_url ? (
            <img src={profile.photo_url} alt={displayName} className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-purple-600/20 flex items-center justify-center text-xl font-bold text-purple-400 flex-shrink-0">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white">{displayName}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-sm text-gray-400 font-mono">{member.member_number}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor[member.status] ?? 'bg-gray-400/10 text-gray-400'}`}>
                {member.status}
              </span>
              <span className="text-xs text-gray-500">
                Joined {member.joined_at ? new Date(member.joined_at).toLocaleDateString('en-GB') : '---'}
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
        membershipStart={currentMembership?.status === 'active' ? currentMembership.start_date : null}
        membershipEnd={currentMembership?.status === 'active' ? currentMembership.end_date : null}
        planName={plan?.name ?? null}
        overviewContent={<>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Info */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Personal Information</h2>
          </div>
          <dl className="space-y-3">
            {/* Email with verification status */}
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">Email</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-white truncate">{profile?.email ?? '---'}</p>
                  {profile?.email && (
                    profile?.email_verified ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-400/10 text-emerald-400">
                        <MailCheck className="w-3 h-3" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-400/10 text-amber-400">
                        Unverified
                      </span>
                    )
                  )}
                  {profile?.email && !profile?.email_verified && (
                    <VerifyEmailButton memberId={member.id} memberName={displayName} emailVerified={profile?.email_verified} />
                  )}
                </div>
              </div>
            </div>
            {[
              { icon: Phone,       label: 'Phone',        value: profile?.phone ?? '---' },
              { icon: MapPin,      label: 'Address',      value: profile?.address ?? '---' },
              { icon: CalendarDays,label: 'Date of Birth',value: profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('en-GB') : '---' },
              { icon: User,        label: 'Gender',       value: profile?.gender ?? '---' },
              { icon: Hash,        label: 'Notes',        value: member.notes ?? '---' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <Icon className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm text-white truncate">{value}</p>
                </div>
              </div>
            ))}
          </dl>
        </div>

        {/* Current Plan */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Current Membership Plan</h2>
          </div>

          {!currentMembership ? (
            <p className="text-sm text-gray-500">No membership plan assigned.</p>
          ) : (
            <div className="space-y-3">
              <div className="bg-gray-700/40 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-white font-semibold">{plan?.name ?? '---'}</p>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor[getDisplayStatus(currentMembership)] ?? 'bg-gray-400/10 text-gray-400'}`}>
                    {getDisplayStatus(currentMembership)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 capitalize mb-2">{plan?.plan_type?.replace('_', ' ') ?? ''} plan</p>
                {(() => {
                  const badge = getMembershipBadge(currentMembership);
                  return badge ? (
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  ) : null;
                })()}
                {plan?.price != null && (
                  <p className="text-sm font-medium text-purple-400 mt-1">{fmt(plan.price, plan.currency)}</p>
                )}
              </div>
              <dl className="space-y-2">
                {[
                  { label: 'Start Date',   value: currentMembership.start_date ? new Date(currentMembership.start_date).toLocaleDateString('en-GB') : '---' },
                  { label: 'Expiry Date',  value: currentMembership.end_date ? new Date(currentMembership.end_date).toLocaleDateString('en-GB') : 'No expiry' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <dt className="text-xs text-gray-500">{label}</dt>
                    <dd className="text-xs text-white">{value}</dd>
                  </div>
                ))}
                {currentMembership.sessions_total != null && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-xs text-gray-500">Sessions Used</dt>
                      <dd className="text-xs text-white">
                        {currentMembership.sessions_used ?? 0} / {currentMembership.sessions_total}
                      </dd>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-purple-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.round((currentMembership.sessions_used ?? 0) / currentMembership.sessions_total * 100))}%` }}
                      />
                    </div>
                  </>
                )}
              </dl>

              {/* Freeze status + history */}
              {currentMembership && plan?.freeze_enabled && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Freeze History</p>
                    {currentMembership.freeze_status === 'frozen' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400 text-xs font-medium">
                        Frozen until {currentMembership.frozen_until ? new Date(currentMembership.frozen_until).toLocaleDateString('en-GB') : '---'}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-500">Days used</p>
                      <p className="text-sm font-semibold text-white">{currentMembership.freeze_days_used ?? 0} / {plan.freeze_max_days ?? '...'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Freezes used</p>
                      <p className="text-sm font-semibold text-white">{currentMembership.freeze_count ?? 0} / {plan.freeze_max_count ?? '...'}</p>
                    </div>
                  </div>
                  {freezeLogs && freezeLogs.length > 0 ? (
                    <div className="space-y-1.5">
                      {(freezeLogs as any[]).map((log: any, i: number) => (
                        <div key={log.id} className="flex items-center justify-between py-1.5 border-b border-gray-700/50 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">#{i + 1}</span>
                            <span className="text-xs text-white">
                              {new Date(log.frozen_at).toLocaleDateString('en-GB')} &rarr; {new Date(log.frozen_until).toLocaleDateString('en-GB')}
                            </span>
                            <span className="text-xs text-blue-400">{log.freeze_days}d</span>
                          </div>
                          {log.resumed_at ? (
                            <span className="text-xs text-emerald-400">Resumed</span>
                          ) : (
                            <span className="text-xs text-blue-400">Active</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600">No freeze history yet.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <OverviewLists
          payments={payments}
          attendanceLogs={attendanceLogs}
          memberships={memberships}
          promoMap={promoMap}
        />
      </div>

      {/* Service Assignments */}
      {(serviceAssignments ?? []).length > 0 && (
        <ServicePackagesList assignments={serviceAssignments} />
      )}

      {/* Session Transfers (sent + received) */}
      <SessionTransfersList gymMemberId={params.id} />

        </>}
      />
    </div>
  );
}
