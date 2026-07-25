import type { SessionsMember } from '@/components/sessions/sessions-tracker';

export interface PageMeta {
  page: number;
  perPage: number;
  total: number;
  lastPage: number;
}

export interface TrackerStats {
  members: number;
  totalSessions: number;
  totalUsed: number;
  totalRemaining: number;
}

export const EMPTY_META: PageMeta = { page: 1, perPage: 10, total: 0, lastPage: 1 };
export const EMPTY_STATS: TrackerStats = { members: 0, totalSessions: 0, totalUsed: 0, totalRemaining: 0 };

export function mapSessionMemberRow(r: any): SessionsMember {
  const sessionCount = Number(r.sessions_total) || 0;
  const sessionsUsed = Number(r.sessions_used) || 0;
  const sessionsRemaining = Math.max(0, sessionCount - sessionsUsed);
  const pctUsed = sessionCount > 0 ? Math.round((sessionsUsed / sessionCount) * 100) : 0;
  return {
    membershipId: r.membership_id ?? '',
    memberId: r.member_id,
    memberNumber: r.member_number ?? '',
    fullName: r.full_name ?? 'Unknown',
    email: r.email ?? null,
    planId: r.plan_id ?? '',
    planName: r.plan_name ?? 'Sessions Plan',
    sessionCount,
    sessionsUsed,
    sessionsRemaining,
    pctUsed,
    status: r.status ?? '',
    startDate: r.start_date ?? null,
    endDate: r.end_date ?? null,
  };
}

export function mapMeta(m: any): PageMeta {
  return {
    page: Number(m?.page) || 1,
    perPage: Number(m?.per_page) || 10,
    total: Number(m?.total) || 0,
    lastPage: Number(m?.last_page) || 1,
  };
}

export function mapStats(s: any): TrackerStats {
  return {
    members: Number(s?.members) || 0,
    totalSessions: Number(s?.total_sessions) || 0,
    totalUsed: Number(s?.total_used) || 0,
    totalRemaining: Number(s?.total_remaining) || 0,
  };
}
