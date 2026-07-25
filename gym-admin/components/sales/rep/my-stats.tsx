'use client';

import { useEffect, useState } from 'react';
import { Users, Zap, Trophy, CalendarCheck, Loader2 } from 'lucide-react';
import { salesApi, fmtMinutes, type SalesContext } from './lib';

interface Props {
  context: SalesContext;
}

interface Stats {
  leadsThisMonth: number;
  avgSpeedToLead: number | null; // minutes
  conversionsThisMonth: number;
  showRate: number | null;       // 0..1 over decided appointments
  showedCount: number;
  decidedCount: number;
}

/**
 * Personal scoreboard, computed client-side from the rep's own leads
 * (first 100) and this month's appointments. Directional numbers, not
 * accounting — the manager reports own the real funnel.
 */
export default function MyStats({ context }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const userId: string = context?.user_id ?? '';
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    (async () => {
      try {
        const [leadsRes, apptsRes] = await Promise.all([
          salesApi<{ data: any[] }>(`leads?assigned_to=${encodeURIComponent(userId)}&per_page=100`),
          salesApi<{ data: any[] }>(`appointments?from=${encodeURIComponent(monthStart.toISOString())}&to=${encodeURIComponent(new Date().toISOString())}`),
        ]);
        if (cancelled) return;

        const leads = leadsRes.data ?? [];
        const inMonth = (v: string | null | undefined) => Boolean(v) && new Date(v as string) >= monthStart;

        const speeds = leads
          .map((l: any) => l.speed_to_lead_minutes)
          .filter((v: any): v is number => typeof v === 'number' && Number.isFinite(v));

        // Show rate: my appointments (I host them or the lead is mine)
        // that were decided this month.
        const mine = (apptsRes.data ?? []).filter(
          (a: any) => a.host_id === userId || a.lead?.assigned_to === userId,
        );
        const decided = mine.filter((a: any) => a.status === 'showed' || a.status === 'no_show');
        const showed = decided.filter((a: any) => a.status === 'showed');

        setStats({
          leadsThisMonth: leads.filter((l: any) => inMonth(l.created_at)).length,
          avgSpeedToLead: speeds.length
            ? speeds.reduce((sum: number, v: number) => sum + v, 0) / speeds.length
            : null,
          conversionsThisMonth: leads.filter((l: any) => inMonth(l.converted_at)).length,
          showRate: decided.length ? showed.length / decided.length : null,
          showedCount: showed.length,
          decidedCount: decided.length,
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => { cancelled = true; };
  }, [context?.user_id]);

  if (failed) {
    return <p className="text-sm text-fg-muted py-8 text-center">Couldn&apos;t load your stats. Try again later.</p>;
  }
  if (!stats) {
    return <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-fg-muted inline" /></div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatTile
        icon={Users}
        label="Leads this month"
        value={String(stats.leadsThisMonth)}
        hint="New leads assigned to you"
      />
      <StatTile
        icon={Zap}
        label="Avg speed to lead"
        value={stats.avgSpeedToLead != null ? fmtMinutes(stats.avgSpeedToLead) : '—'}
        hint="Creation → first contact"
      />
      <StatTile
        icon={Trophy}
        label="Conversions this month"
        value={String(stats.conversionsThisMonth)}
        hint="Leads you closed"
      />
      <StatTile
        icon={CalendarCheck}
        label="Show rate"
        value={stats.showRate != null ? `${Math.round(stats.showRate * 100)}%` : '—'}
        hint={stats.decidedCount ? `${stats.showedCount} of ${stats.decidedCount} visits showed` : 'No decided visits yet'}
      />
    </div>
  );
}

function StatTile({ icon: Icon, label, value, hint }: {
  icon: typeof Users;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="p-4 bg-surface-2 border border-line rounded-xl">
      <div className="flex items-center gap-2 text-fg-muted">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-fg mt-2">{value}</div>
      <div className="text-xs text-fg-faint mt-1">{hint}</div>
    </div>
  );
}
