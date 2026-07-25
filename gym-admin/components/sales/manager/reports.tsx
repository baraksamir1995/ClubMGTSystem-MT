'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Filter, Megaphone, Trophy } from 'lucide-react';
import {
  Button, DataTable, EmptyState, FilterDropdown, Input,
  type DataTableColumn,
} from '@/components/ui';
import type { SalesContext, TeamMember } from '@/lib/sales-types';
import {
  asPercent, Card, fmtMinutes, fmtPercent, isoDay, salesGet, stageLabel,
  type FunnelReport, type LeaderboardRow, type SourceReportRow,
} from './lib';

interface Props {
  context: SalesContext;
}

const currentMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

export default function Reports({ context }: Props) {
  /* ----------------------------- Filters --------------------------- */
  const [from, setFrom] = useState(isoDay(-30));
  const [to, setTo] = useState(isoDay(0));
  const [branchId, setBranchId] = useState('');
  const [repId, setRepId] = useState('');
  const [month, setMonth] = useState(currentMonth());

  // Rep options come from the sales team endpoint (Reports only
  // receives `context`, so fetch the roster here).
  const [team, setTeam] = useState<TeamMember[]>([]);
  useEffect(() => {
    salesGet<TeamMember[]>('team')
      .then((res) => setTeam(res.data ?? []))
      .catch(() => { /* rep filter simply stays empty */ });
  }, []);

  /* ------------------------------ Funnel ---------------------------- */
  const [funnel, setFunnel] = useState<FunnelReport | null>(null);
  const [funnelLoading, setFunnelLoading] = useState(true);
  const [funnelError, setFunnelError] = useState<string | null>(null);

  const loadFunnel = useCallback(async () => {
    setFunnelLoading(true);
    setFunnelError(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (branchId) params.set('branch_id', branchId);
      if (repId) params.set('rep_id', repId);
      const res = await salesGet<FunnelReport>(`reports/funnel?${params.toString()}`);
      setFunnel(res.data ?? null);
    } catch (e) {
      setFunnelError(e instanceof Error ? e.message : 'Failed to load funnel');
    } finally {
      setFunnelLoading(false);
    }
  }, [from, to, branchId, repId]);

  useEffect(() => { loadFunnel(); }, [loadFunnel]);

  /* --------------------------- Leaderboard -------------------------- */
  const [leaders, setLeaders] = useState<LeaderboardRow[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(true);
  const [leadersError, setLeadersError] = useState<string | null>(null);

  const loadLeaders = useCallback(async () => {
    setLeadersLoading(true);
    setLeadersError(null);
    try {
      const res = await salesGet<LeaderboardRow[]>(`reports/leaderboard?month=${month}`);
      setLeaders(res.data ?? []);
    } catch (e) {
      setLeadersError(e instanceof Error ? e.message : 'Failed to load leaderboard');
    } finally {
      setLeadersLoading(false);
    }
  }, [month]);

  useEffect(() => { loadLeaders(); }, [loadLeaders]);

  /* ------------------------------ Sources --------------------------- */
  const [sources, setSources] = useState<SourceReportRow[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  const loadSources = useCallback(async () => {
    setSourcesLoading(true);
    setSourcesError(null);
    try {
      const res = await salesGet<SourceReportRow[]>(`reports/sources?from=${from}&to=${to}`);
      setSources(res.data ?? []);
    } catch (e) {
      setSourcesError(e instanceof Error ? e.message : 'Failed to load source report');
    } finally {
      setSourcesLoading(false);
    }
  }, [from, to]);

  useEffect(() => { loadSources(); }, [loadSources]);

  /* --------------------------- Funnel render ------------------------ */

  const funnelStages = funnel?.stages ?? [];
  const mainStages = funnelStages.filter((s) => s.stage !== 'lost');
  const lostStage = funnelStages.find((s) => s.stage === 'lost');
  const maxCount = Math.max(1, ...funnelStages.map((s) => s.count));
  const totalFunnel = funnelStages.reduce((sum, s) => sum + s.count, 0);

  const conversionFor = (fromStage: string, toStage: string): number | null => {
    const c = (funnel?.conversion ?? []).find((x) => x.from === fromStage && x.to === toStage);
    return c ? asPercent(c.rate) : null;
  };

  const showRate = useMemo(() => {
    if (!funnel) return null;
    const total = (funnel.showed_count ?? 0) + (funnel.no_show_count ?? 0);
    return total === 0 ? null : Math.round((funnel.showed_count / total) * 100);
  }, [funnel]);

  /* --------------------------- Table columns ------------------------ */

  const leaderColumns: DataTableColumn<LeaderboardRow>[] = [
    {
      key: 'rank',
      header: '#',
      width: 44,
      cell: (r) => {
        const rank = leaders.indexOf(r) + 1;
        return (
          <span className={rank === 1 ? 'text-brand font-bold' : 'text-fg-muted'}>{rank}</span>
        );
      },
    },
    { key: 'name', header: 'Rep', cell: (r) => <span className="text-fg font-medium">{r.name}</span> },
    { key: 'leads', header: 'Leads', align: 'right', cell: (r) => <span className="text-fg-muted">{r.leads}</span> },
    {
      key: 'speed',
      header: 'Speed to lead',
      align: 'right',
      hideOnMobile: true,
      cell: (r) => <span className="text-fg-muted">{fmtMinutes(r.avg_speed_to_lead_minutes)}</span>,
    },
    { key: 'show', header: 'Show rate', align: 'right', hideOnMobile: true, cell: (r) => <span className="text-fg-muted">{fmtPercent(r.show_rate)}</span> },
    { key: 'close', header: 'Close rate', align: 'right', cell: (r) => <span className="text-fg-muted">{fmtPercent(r.close_rate)}</span> },
    { key: 'conversions', header: 'Conversions', align: 'right', cell: (r) => <span className="text-success font-semibold">{r.conversions}</span> },
  ];

  const maxSourceLeads = Math.max(1, ...sources.map((s) => s.leads));
  const sourceColumns: DataTableColumn<SourceReportRow>[] = [
    { key: 'name', header: 'Source', cell: (s) => <span className="text-fg font-medium">{s.name}</span> },
    { key: 'leads', header: 'Leads', align: 'right', cell: (s) => <span className="text-fg-muted">{s.leads}</span> },
    { key: 'converted', header: 'Converted', align: 'right', cell: (s) => <span className="text-fg-muted">{s.converted}</span> },
    {
      key: 'rate',
      header: 'Conversion',
      width: 220,
      cell: (s) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-surface-3 overflow-hidden min-w-[60px]">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.min(100, asPercent(s.conversion_rate))}%` }}
            />
          </div>
          <span className="text-fg text-xs font-medium w-10 text-right">{fmtPercent(s.conversion_rate)}</span>
        </div>
      ),
    },
    {
      key: 'volume',
      header: 'Volume',
      width: 160,
      hideOnMobile: true,
      cell: (s) => (
        <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
          <div
            className="h-full rounded-full bg-accent/70"
            style={{ width: `${Math.round((s.leads / maxSourceLeads) * 100)}%` }}
          />
        </div>
      ),
    },
  ];

  /* ------------------------------- UI ------------------------------- */

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex items-end gap-3 flex-wrap bg-surface-2 border border-line rounded-xl px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs text-fg-muted uppercase tracking-wide me-1">
          <Filter className="w-3.5 h-3.5" /> Filters
        </div>
        <div>
          <label className="block text-xs text-fg-muted mb-1">From</label>
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="block text-xs text-fg-muted mb-1">To</label>
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <FilterDropdown
          label="Branch"
          value={branchId}
          onChange={setBranchId}
          options={[
            { value: '', label: 'All branches' },
            ...(context.branches ?? []).map((b) => ({ value: String(b.id), label: b.name })),
          ]}
        />
        <FilterDropdown
          label="Rep"
          value={repId}
          onChange={setRepId}
          options={[
            { value: '', label: 'All reps' },
            ...team.map((m) => ({ value: String(m.user_id), label: m.full_name })),
          ]}
        />
      </div>

      {/* (a) Funnel */}
      <Card padding="none">
        <Card.Header>
          <div className="flex items-center justify-between gap-3 text-sm font-semibold text-fg">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-fg-muted" />
              <span>Funnel</span>
            </div>
            {funnel && (
              <div className="flex items-center gap-3 text-xs text-fg-muted font-normal">
                <span>Showed <span className="text-success font-semibold">{funnel.showed_count}</span></span>
                <span>No-show <span className="text-danger font-semibold">{funnel.no_show_count}</span></span>
                {showRate !== null && <span>Show rate <span className="text-fg font-semibold">{showRate}%</span></span>}
              </div>
            )}
          </div>
        </Card.Header>
        <Card.Body>
          {funnelLoading ? (
            <div className="space-y-3 animate-pulse py-2">
              {[92, 74, 58, 40, 26, 14].map((w, i) => (
                <div key={i} className="h-8 rounded-lg bg-surface-3" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : funnelError ? (
            <EmptyState
              size="sm"
              icon={BarChart3}
              title="Couldn't load the funnel"
              description={funnelError}
              action={<Button variant="secondary" size="sm" onClick={loadFunnel}>Retry</Button>}
            />
          ) : !funnel || totalFunnel === 0 ? (
            <EmptyState
              size="sm"
              icon={BarChart3}
              title="No leads in this range"
              description="Widen the date range or clear the filters."
            />
          ) : (
            <div className="space-y-1">
              {mainStages.map((s, i) => {
                const prev = i > 0 ? mainStages[i - 1] : null;
                const conv = prev ? conversionFor(prev.stage, s.stage) : null;
                const pct = Math.max(2, Math.round((s.count / maxCount) * 100));
                const isConverted = s.stage === 'converted';
                return (
                  <div key={s.stage}>
                    {conv !== null && (
                      <div className="flex items-center gap-2 ps-36 py-0.5">
                        <span className="text-[11px] text-fg-faint">↓ {conv.toFixed(0)}%</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="w-32 shrink-0 text-sm text-fg-muted text-end">{stageLabel(s.stage)}</span>
                      <div className="flex-1 h-8 rounded-lg bg-surface-3/50 overflow-hidden">
                        <div
                          className={`h-full rounded-lg flex items-center px-2.5 ${isConverted ? 'bg-success/80' : 'bg-brand/80'}`}
                          style={{ width: `${pct}%` }}
                        >
                          <span className={`text-xs font-semibold ${isConverted ? 'text-surface' : 'text-brand-ink'}`}>{s.count}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {lostStage && (
                <div className="flex items-center gap-3 pt-2 mt-2 border-t border-line">
                  <span className="w-32 shrink-0 text-sm text-fg-muted text-end">Lost</span>
                  <div className="flex-1 h-6 rounded-lg bg-surface-3/50 overflow-hidden">
                    <div
                      className="h-full rounded-lg bg-danger/60 flex items-center px-2.5"
                      style={{ width: `${Math.max(2, Math.round((lostStage.count / maxCount) * 100))}%` }}
                    >
                      <span className="text-xs font-semibold text-fg">{lostStage.count}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card.Body>
      </Card>

      {/* (b) Leaderboard */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
            <Trophy className="w-4 h-4 text-fg-muted" /> Leaderboard
          </h2>
          <Input
            type="month"
            value={month}
            max={currentMonth()}
            onChange={(e) => setMonth(e.target.value)}
            className="w-44"
            aria-label="Leaderboard month"
          />
        </div>
        {leadersError ? (
          <div className="bg-surface-2 border border-line rounded-xl">
            <EmptyState
              size="sm"
              icon={Trophy}
              title="Couldn't load the leaderboard"
              description={leadersError}
              action={<Button variant="secondary" size="sm" onClick={loadLeaders}>Retry</Button>}
            />
          </div>
        ) : (
          <DataTable
            columns={leaderColumns}
            rows={leaders}
            rowKey={(r) => String(r.user_id)}
            loading={leadersLoading}
            empty={
              <EmptyState
                icon={Trophy}
                title="No activity this month"
                description="Once reps start working leads, their numbers show up here."
              />
            }
          />
        )}
      </div>

      {/* (c) Source ROI */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
          <Megaphone className="w-4 h-4 text-fg-muted" /> Source performance
        </h2>
        {sourcesError ? (
          <div className="bg-surface-2 border border-line rounded-xl">
            <EmptyState
              size="sm"
              icon={Megaphone}
              title="Couldn't load sources"
              description={sourcesError}
              action={<Button variant="secondary" size="sm" onClick={loadSources}>Retry</Button>}
            />
          </div>
        ) : (
          <DataTable
            columns={sourceColumns}
            rows={sources}
            rowKey={(s) => String(s.source_id)}
            loading={sourcesLoading}
            empty={
              <EmptyState
                icon={Megaphone}
                title="No source data in this range"
                description="Leads attributed to a source in the selected dates will appear here."
              />
            }
          />
        )}
      </div>
    </div>
  );
}
