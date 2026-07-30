'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { BarChart3, Users, TrendingUp, TrendingDown, DollarSign, AlertCircle, RefreshCw, Download, Dumbbell, LayoutDashboard, FileSpreadsheet, Printer, ScanLine, CalendarDays } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, Cell, PieChart, Pie,
  AreaChart, Area,
} from 'recharts';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const PRESET_DAYS = [30, 90, 180, 365] as const;

const PIE_COLORS = ['var(--chart-1)','var(--chart-2)','var(--chart-3)','var(--chart-4)','var(--chart-5)','var(--chart-6)'];

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'rgb(var(--surface-2))', border: '1px solid rgb(var(--line))', borderRadius: 8, color: 'rgb(var(--fg))' },
  labelStyle: { color: 'rgb(var(--fg))' },
  itemStyle: { color: 'rgb(var(--fg))' },
} as const;

function dateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

function fmt(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

interface ClassData {
  byClass: { name: string; class_type: string; sessions: number; totalBooked: number; avgBooked: number; bookingRate: number | null }[];
  byDay:   { day: string; sessions: number; booked: number; avgBooked: number }[];
  byHour:  { hour: string; sessions: number; booked: number; avgBooked: number }[];
  totalSessions: number; totalBookings: number;
}

interface DashboardData {
  period: string; fromDate: string; toDate: string;
  kpis: { activeMembers: number; newMembers: number; revenue: number; currency: string; checkins: number; sessions: number; totalBookings: number };
  timeline: { date: string; revenue: number; checkins: number; newMembers: number }[];
}

interface MemberData {
  timeline: { month: string; new_members: number; cancellations: number }[];
  totalNew: number; totalChurned: number; activeAtStart: number; churnRate: number;
}
interface RevenueData {
  totalRevenue: number; totalOverdue: number; totalPending: number; currency: string;
  byPlan: { plan: string; revenue: number; count: number }[];
  timeline: { month: string; revenue: number }[];
  paidCount: number; overdueCount: number;
}

export default function AnalyticsPage() {
  const t  = useTranslations('analytics');
  const tc = useTranslations('common');

  const [activeTab,    setActiveTab]    = useState<'dashboard' | 'members' | 'revenue' | 'classes'>('dashboard');
  const [preset,       setPreset]       = useState(90);
  const [fromDate,     setFromDate]     = useState(dateStr(90));
  const [toDate,       setToDate]       = useState(dateStr(0));
  const [memberData,   setMemberData]   = useState<MemberData | null>(null);
  const [revenueData,  setRevenueData]  = useState<RevenueData | null>(null);
  const [classData,    setClassData]    = useState<ClassData | null>(null);
  const [dashData,     setDashData]     = useState<DashboardData | null>(null);
  const [dashPeriod,   setDashPeriod]   = useState<'day' | 'week' | 'month'>('week');
  // Starts true: the dashboard always fetches on mount, so the first paint
  // should show the spinner — not a flash of the empty/error fallback.
  const [dashLoading,  setDashLoading]  = useState(true);
  const [showExport,   setShowExport]   = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const fetchData = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/all?from=${from}&to=${to}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setMemberData(data.members);
        setRevenueData(data.revenue);
        setClassData(data.classes);
      } else {
        setMemberData(null); setRevenueData(null); setClassData(null);
        setError(data?.error ?? t('fallback.httpError', { status: res.status }));
      }
    } catch {
      setMemberData(null); setRevenueData(null); setClassData(null);
      setError(t('fallback.networkError'));
    }
    finally { setLoading(false); }
  }, [t]);

  const fetchDashboard = useCallback(async (p: 'day' | 'week' | 'month') => {
    setDashLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/dashboard?period=${p}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (res.ok && data) setDashData(data);
      else {
        setDashData(null);
        setError(data?.error ?? t('fallback.dashboardHttpError', { status: res.status }));
      }
    } catch {
      setDashData(null);
      setError(t('fallback.networkError'));
    }
    finally { setDashLoading(false); }
  }, [t]);

  useEffect(() => { fetchDashboard(dashPeriod); }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeTab !== 'dashboard') fetchData(fromDate, toDate); }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const presetLabel = (days: number) => {
    if (days === 30)  return t('period.last30');
    if (days === 90)  return t('period.last90');
    if (days === 180) return t('period.last6months');
    return t('period.last12months');
  };

  const applyPreset = (days: number) => {
    const from = dateStr(days);
    const to   = dateStr(0);
    setPreset(days); setFromDate(from); setToDate(to);
    fetchData(from, to);
  };

  const applyCustom = () => {
    if (!fromDate || !toDate) { toast.error(t('dateRange.selectBothDates')); return; }
    setPreset(0);
    fetchData(fromDate, toDate);
  };

  const getExportRows = () => {
    if (activeTab === 'dashboard' && dashData) {
      return { rows: [['Date','Revenue','Check-ins','New Members'], ...dashData.timeline.map(r => [r.date, r.revenue, r.checkins, r.newMembers])], name: 'dashboard' };
    } else if (activeTab === 'classes' && classData) {
      return { rows: [['Class','Type','Sessions','Total Bookings','Avg/Session','Fill Rate %'], ...classData.byClass.map(c => [c.name, c.class_type, c.sessions, c.totalBooked, c.avgBooked, c.bookingRate ?? ''])], name: 'class_attendance' };
    } else if (activeTab === 'members' && memberData) {
      return { rows: [['Month','New Members','Cancellations'], ...memberData.timeline.map(r => [r.month, r.new_members, r.cancellations])], name: 'member_growth' };
    } else if (activeTab === 'revenue' && revenueData) {
      return { rows: [['Month','Revenue'], ...revenueData.timeline.map(r => [r.month, r.revenue])], name: 'revenue' };
    }
    return null;
  };

  const exportAs = (format: 'csv' | 'xlsx' | 'print') => {
    setShowExport(false);
    const exp = getExportRows();
    if (!exp) { toast.error(t('export.noData')); return; }
    if (format === 'csv') {
      downloadCSV(exp.rows, exp.name);
    } else if (format === 'xlsx') {
      const ws = XLSX.utils.aoa_to_sheet(exp.rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Report');
      XLSX.writeFile(wb, `${exp.name}_${new Date().toISOString().slice(0,10)}.xlsx`);
      toast.success(t('export.excelDownloaded'));
    } else {
      window.print();
    }
  };

  const tabCls = (tab: string) =>
    `flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:text-fg'}`;

  const inp = 'bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-brand';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t('title')}</h1>
          <p className="text-sm text-fg-muted mt-0.5">{t('subtitle')}</p>
        </div>
        <div className="relative">
          <button onClick={() => setShowExport(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-surface-2 border border-line text-fg-muted text-sm font-medium rounded-lg hover:bg-surface-3 transition-colors">
            <Download aria-hidden className="w-4 h-4" /> {tc('export')}
          </button>
          {showExport && (
            <div className="absolute end-0 top-full mt-1 z-20 bg-surface-2 border border-line rounded-xl shadow-xl overflow-hidden min-w-[160px]">
              <button onClick={() => exportAs('csv')}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-fg-muted hover:bg-surface-3 hover:text-fg transition-colors">
                <Download aria-hidden className="w-4 h-4 text-success" /> {t('export.csv')}
              </button>
              <button onClick={() => exportAs('xlsx')}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-fg-muted hover:bg-surface-3 hover:text-fg transition-colors">
                <FileSpreadsheet aria-hidden className="w-4 h-4 text-info" /> {t('export.excel')}
              </button>
              <button onClick={() => exportAs('print')}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-fg-muted hover:bg-surface-3 hover:text-fg transition-colors">
                <Printer aria-hidden className="w-4 h-4 text-brand" /> {t('export.print')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-2 border border-line rounded-xl p-1 w-fit flex-wrap">
        <button onClick={() => setActiveTab('dashboard')} className={tabCls('dashboard')}>
          <LayoutDashboard aria-hidden className="w-4 h-4" /> {t('tabs.dashboard')}
        </button>
        <button onClick={() => setActiveTab('members')} className={tabCls('members')}>
          <Users aria-hidden className="w-4 h-4" /> {t('tabs.members')}
        </button>
        <button onClick={() => setActiveTab('revenue')} className={tabCls('revenue')}>
          <DollarSign aria-hidden className="w-4 h-4" /> {t('tabs.revenue')}
        </button>
        <button onClick={() => setActiveTab('classes')} className={tabCls('classes')}>
          <Dumbbell aria-hidden className="w-4 h-4" /> {t('tabs.classes')}
        </button>
      </div>

      {/* ── DASHBOARD TAB ── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-5">
          {/* Period selector */}
          <div className="flex items-center gap-2">
            {(['day','week','month'] as const).map(p => (
              <button key={p} onClick={() => { setDashPeriod(p); fetchDashboard(p); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                  dashPeriod === p ? 'bg-brand/20 border-brand/40 text-brand' : 'bg-surface-2 border-line text-fg-muted hover:text-fg'
                }`}>
                {p === 'day' ? t('period.today') : p === 'week' ? t('period.thisWeek') : t('period.thisMonth')}
              </button>
            ))}
            {dashLoading && (
              <span role="status" className="ms-2">
                <RefreshCw aria-hidden className="w-4 h-4 text-brand animate-spin" />
                <span className="sr-only">Loading</span>
              </span>
            )}
          </div>

          {!dashLoading && dashData && (() => {
            const { kpis, timeline } = dashData;
            const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            return (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard icon={Users}        color="text-brand" bg="bg-brand/10"
                    label={t('dashboard.kpi.activeMembers')}
                    value={kpis.activeMembers.toLocaleString()}
                    sub={kpis.newMembers > 0 ? t('dashboard.kpi.newSuffix', { count: kpis.newMembers }) : undefined} />
                  <KpiCard icon={DollarSign}   color="text-success" bg="bg-success-soft"
                    label={t('dashboard.kpi.revenue')}
                    value={fmt(kpis.revenue, kpis.currency)}
                    sub={t('dashboard.kpi.collected')} />
                  <KpiCard icon={ScanLine}     color="text-info" bg="bg-info-soft"
                    label={t('dashboard.kpi.checkins')}
                    value={kpis.checkins.toLocaleString()}
                    sub={t('dashboard.kpi.gymEntries')} />
                  <KpiCard icon={CalendarDays} color="text-warning" bg="bg-warning-soft"
                    label={t('dashboard.kpi.sessions')}
                    value={kpis.sessions.toLocaleString()}
                    sub={t('dashboard.kpi.bookings', { count: kpis.totalBookings })} />
                </div>

                {/* Timeline chart */}
                {timeline.length > 0 && (
                  <div className="bg-surface-2 border border-line rounded-xl p-5">
                    <h2 className="text-sm font-semibold text-fg mb-4">{t('dashboard.performanceOverPeriod')}</h2>
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={timeline.map(item => ({ ...item, date: fmtDate(item.date) }))}
                        margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="chkGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                        <XAxis dataKey="date" tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="rev" orientation="right" tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} axisLine={false} tickLine={false}
                          tickFormatter={v => fmt(v, kpis.currency)} />
                        <YAxis yAxisId="cnt" orientation="left" tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip {...TOOLTIP_STYLE}
                          formatter={(v: any, name: any) => name === t('dashboard.kpi.checkins') ? v : fmt(v, kpis.currency)} />
                        <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--chart-axis)' }} />
                        <Area yAxisId="cnt" type="monotone" dataKey="checkins" name={t('dashboard.kpi.checkins')} stroke="var(--chart-2)" fill="url(#chkGrad)" strokeWidth={2} dot={false} />
                        <Area yAxisId="rev" type="monotone" dataKey="revenue"  name={t('dashboard.kpi.revenue')}   stroke="var(--chart-1)" fill="url(#revGrad)" strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Date Range */}
      {activeTab !== 'dashboard' && <div className="bg-surface-2 border border-line rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {PRESET_DAYS.map(days => (
            <button key={days} onClick={() => applyPreset(days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                preset === days ? 'bg-brand/20 border-brand/40 text-brand' : 'border-line text-fg-muted hover:text-fg'
              }`}>
              {presetLabel(days)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ms-auto flex-wrap">
          <span className="text-xs text-fg-faint">{t('dateRange.custom')}</span>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inp} />
          <span className="text-fg-faint text-xs">{t('dateRange.to')}</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={inp} />
          <button onClick={applyCustom} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-xs font-medium rounded-lg transition-colors disabled:opacity-40">
            {loading ? <RefreshCw aria-hidden className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 aria-hidden className="w-3.5 h-3.5" />}
            {t('dateRange.apply')}
          </button>
        </div>
      </div>}

      {loading && (
        <div role="status" className="flex items-center justify-center py-20">
          <RefreshCw aria-hidden className="w-6 h-6 text-brand animate-spin" />
          <span className="sr-only">Loading</span>
        </div>
      )}

      {/* Fallback — never leave the tab silently blank. Shows when the
          active tab has no data and nothing is in flight (a failed/empty
          fetch), with the error reason + a retry. */}
      {(() => {
        const busy       = activeTab === 'dashboard' ? dashLoading : loading;
        const activeData = activeTab === 'dashboard' ? dashData
          : activeTab === 'members' ? memberData
          : activeTab === 'revenue' ? revenueData
          : classData;
        if (busy || activeData) return null;
        const retry = () => activeTab === 'dashboard' ? fetchDashboard(dashPeriod) : fetchData(fromDate, toDate);
        return (
          <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
            <AlertCircle aria-hidden className="w-10 h-10 text-fg-faint mx-auto mb-3" />
            <p className="text-sm text-fg-muted">{error ?? t('fallback.noAnalyticsData')}</p>
            <button onClick={retry}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors">
              <RefreshCw aria-hidden className="w-4 h-4" /> {tc('retry')}
            </button>
          </div>
        );
      })()}

      {/* ── MEMBER GROWTH & CHURN ── */}
      {!loading && activeTab === 'members' && memberData && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={TrendingUp} color="text-success" bg="bg-success-soft"
              label={t('members.newMembers')} value={memberData.totalNew.toString()} />
            <StatCard icon={TrendingDown} color="text-danger" bg="bg-danger-soft"
              label={t('members.cancellations')} value={memberData.totalChurned.toString()} />
            <StatCard icon={Users} color="text-brand" bg="bg-brand/10"
              label={t('members.netGrowth')} value={(memberData.totalNew - memberData.totalChurned >= 0 ? '+' : '') + (memberData.totalNew - memberData.totalChurned)}
              valueColor={memberData.totalNew >= memberData.totalChurned ? 'text-success' : 'text-danger'} />
            <StatCard icon={BarChart3} color="text-warning" bg="bg-warning-soft"
              label={t('members.churnRate')} value={`${memberData.churnRate > 10 ? '▲ ' : ''}${memberData.churnRate}%`}
              valueColor={memberData.churnRate > 10 ? 'text-danger' : 'text-success'} />
          </div>

          {/* Growth vs Churn chart */}
          <div className="bg-surface-2 border border-line rounded-xl p-5">
            <h2 className="text-sm font-semibold text-fg mb-4">{t('members.growthVsChurn')}</h2>
            {memberData.timeline.length === 0 ? (
              <EmptyChart label={t('emptyChart')} />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={memberData.timeline.map(d => ({ ...d, month: fmtMonth(d.month) }))}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--chart-axis)' }} />
                  <Bar dataKey="new_members"   name={t('members.chartLegend.newMembers')}   fill="var(--chart-1)" radius={[4,4,0,0]} />
                  <Bar dataKey="cancellations" name={t('members.chartLegend.cancellations')} fill="var(--chart-4)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Trend line */}
          {memberData.timeline.length > 1 && (
            <div className="bg-surface-2 border border-line rounded-xl p-5">
              <h2 className="text-sm font-semibold text-fg mb-4">{t('members.netGrowthTrend')}</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={memberData.timeline.map(d => ({
                    month: fmtMonth(d.month),
                    net: d.new_members - d.cancellations,
                  }))}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="net" name={t('members.chartLegend.netGrowth')} stroke="var(--chart-1)" strokeWidth={2}
                    dot={{ fill: 'var(--chart-1)', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── REVENUE & PAYMENTS ── */}
      {!loading && activeTab === 'revenue' && revenueData && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={DollarSign} color="text-success" bg="bg-success-soft"
              label={t('revenue.totalCollected')} value={fmt(revenueData.totalRevenue, revenueData.currency)} />
            <StatCard icon={BarChart3} color="text-brand" bg="bg-brand/10"
              label={t('revenue.paidTransactions')} value={revenueData.paidCount.toString()} />
            <StatCard icon={AlertCircle} color="text-danger" bg="bg-danger-soft"
              label={t('revenue.overdueAmount')} value={fmt(revenueData.totalOverdue, revenueData.currency)} />
            <StatCard icon={AlertCircle} color="text-warning" bg="bg-warning-soft"
              label={t('revenue.pendingAmount')} value={fmt(revenueData.totalPending, revenueData.currency)} />
          </div>

          {/* Outstanding balances warning */}
          {(revenueData.totalOverdue > 0 || revenueData.totalPending > 0) && (
            <div className="bg-danger-soft border border-danger/40 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle aria-hidden className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-danger">{t('revenue.outstandingBalances')}</p>
                <p className="text-xs text-fg-muted mt-0.5">
                  {revenueData.overdueCount !== 1
                    ? t('revenue.outstandingDetailPlural', { overdue: fmt(revenueData.totalOverdue, revenueData.currency), count: revenueData.overdueCount })
                    : t('revenue.outstandingDetail', { overdue: fmt(revenueData.totalOverdue, revenueData.currency), count: revenueData.overdueCount })}
                  {revenueData.totalPending > 0 && t('revenue.pendingSuffix', { pending: fmt(revenueData.totalPending, revenueData.currency) })}
                </p>
              </div>
            </div>
          )}

          {/* Revenue timeline */}
          <div className="bg-surface-2 border border-line rounded-xl p-5">
            <h2 className="text-sm font-semibold text-fg mb-4">{t('revenue.revenueByMonth')}</h2>
            {revenueData.timeline.length === 0 ? (
              <EmptyChart label={t('emptyChart')} />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={revenueData.timeline.map(d => ({ ...d, month: fmtMonth(d.month) }))}
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} axisLine={false} tickLine={false}
                    tickFormatter={v => fmt(v, revenueData.currency).replace(/\.00$/, '')} />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v: any) => [fmt(v, revenueData.currency), t('revenue.chartLegend.revenue')]} />
                  <Bar dataKey="revenue" name={t('revenue.chartLegend.revenue')} radius={[4,4,0,0]}>
                    {revenueData.timeline.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? 'var(--chart-1)' : 'var(--chart-2)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Revenue by plan */}
          {revenueData.byPlan.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Pie chart */}
              <div className="bg-surface-2 border border-line rounded-xl p-5">
                <h2 className="text-sm font-semibold text-fg mb-4">{t('revenue.revenueByPlan')}</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={revenueData.byPlan} dataKey="revenue" nameKey="plan"
                      cx="50%" cy="50%" outerRadius={85} label={(entry: any) =>
                        `${entry.name} ${((entry.percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={{ stroke: 'var(--chart-axis)' }}>
                      {revenueData.byPlan.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE}
                      formatter={(v: any) => [fmt(v, revenueData.currency), t('revenue.chartLegend.revenue')]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Plan breakdown table */}
              <div className="bg-surface-2 border border-line rounded-xl p-5">
                <h2 className="text-sm font-semibold text-fg mb-4">{t('revenue.planBreakdown')}</h2>
                <div className="space-y-0 divide-y divide-line">
                  {revenueData.byPlan.map((p, i) => {
                    const pct = revenueData.totalRevenue > 0
                      ? Math.round((p.revenue / revenueData.totalRevenue) * 100) : 0;
                    return (
                      <div key={p.plan} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="text-sm text-fg">{p.plan}</span>
                          </div>
                          <div className="text-end">
                            <span className="text-sm font-semibold text-fg">{fmt(p.revenue, revenueData.currency)}</span>
                            <span className="text-xs text-fg-faint ms-2">
                              {p.count !== 1
                                ? t('revenue.paymentCountPlural', { count: p.count })
                                : t('revenue.paymentCount', { count: p.count })}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-surface-3 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        </div>
                        <p className="text-xs text-fg-faint mt-0.5 text-end">{t('revenue.percentOfTotal', { pct })}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CLASS ATTENDANCE ── */}
      {!loading && activeTab === 'classes' && classData && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Dumbbell}    color="text-brand" bg="bg-brand/10"
              label={t('classes.totalSessions')} value={classData.totalSessions.toString()} />
            <StatCard icon={Users}       color="text-success" bg="bg-success-soft"
              label={t('classes.totalBookings')} value={classData.totalBookings.toString()} />
            {(() => {
              const sorted = [...classData.byClass].sort((a, b) => b.totalBooked - a.totalBooked);
              return (
                <>
                  <StatCard icon={TrendingUp} color="text-info" bg="bg-info-soft"
                    label={t('classes.mostPopular')} value={sorted[0]?.name ?? '—'} />
                  <StatCard icon={TrendingDown} color="text-warning" bg="bg-warning-soft"
                    label={t('classes.leastPopular')} value={sorted.length > 1 ? (sorted[sorted.length - 1]?.name ?? '—') : '—'} />
                </>
              );
            })()}
          </div>

          {/* Class ranking table */}
          {classData.byClass.length === 0 ? (
            <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
              <Dumbbell aria-hidden className="w-10 h-10 text-fg-faint mx-auto mb-3" />
              <p className="text-sm text-fg-muted">{t('classes.noSessionsInPeriod')}</p>
            </div>
          ) : (
            <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-line flex items-center gap-2">
                <BarChart3 aria-hidden className="w-4 h-4 text-brand" />
                <h2 className="text-sm font-semibold text-fg">{t('classes.classesByAttendance')}</h2>
              </div>
              <div className="divide-y divide-line">
                {classData.byClass.map((c, i) => {
                  const rate = c.bookingRate;
                  const rateColor = rate == null ? 'text-fg-faint'
                    : rate >= 75 ? 'text-success'
                    : rate >= 40 ? 'text-warning' : 'text-danger';
                  return (
                    <div key={c.name} className="flex items-center gap-4 px-5 py-3.5">
                      <span className="text-lg font-bold text-fg-faint w-6 flex-shrink-0">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-fg">{c.name}</p>
                        <p className="text-xs text-fg-faint capitalize">
                          {c.class_type} · {c.sessions !== 1
                            ? t('classes.sessionCountPlural', { count: c.sessions })
                            : t('classes.sessionCount', { count: c.sessions })}
                        </p>
                        {rate != null && (
                          <div className="w-full max-w-xs bg-surface-3 rounded-full h-1.5 mt-1.5">
                            <div className="h-1.5 rounded-full bg-brand" style={{ width: `${rate}%` }} />
                          </div>
                        )}
                      </div>
                      <div className="text-end flex-shrink-0">
                        <p className="text-sm font-semibold text-fg">{t('classes.bookingCount', { count: c.totalBooked })}</p>
                        <p className="text-xs text-fg-faint">{t('classes.avgPerSession', { avg: c.avgBooked })}</p>
                        {rate != null && <p className={`text-xs font-medium mt-0.5 ${rateColor}`}>{t('classes.fillRate', { rate })}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Peak days */}
            <div className="bg-surface-2 border border-line rounded-xl p-5">
              <h2 className="text-sm font-semibold text-fg mb-1">{t('classes.bookingsByDay')}</h2>
              <p className="text-xs text-fg-faint mb-4">{t('classes.peakDay')}</p>
              {classData.byDay.every(d => d.booked === 0) ? <EmptyChart label={t('emptyChart')} /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={classData.byDay.map(d => ({ day: d.day.slice(0, 3), booked: d.booked }))}
                    margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="day" tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="booked" name={t('classes.chartLegend.bookings')} radius={[4,4,0,0]}>
                      {classData.byDay.map((d, i) => {
                        const maxB = Math.max(...classData.byDay.map(x => x.booked));
                        return <Cell key={i} fill={d.booked === maxB && maxB > 0 ? 'var(--chart-1)' : 'var(--chart-5)'} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Peak times */}
            <div className="bg-surface-2 border border-line rounded-xl p-5">
              <h2 className="text-sm font-semibold text-fg mb-1">{t('classes.bookingsByTime')}</h2>
              <p className="text-xs text-fg-faint mb-4">{t('classes.peakHour')}</p>
              {classData.byHour.length === 0 ? <EmptyChart label={t('emptyChart')} /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={classData.byHour}
                    margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="hour" tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="booked" name={t('classes.chartLegend.bookings')} radius={[4,4,0,0]}>
                      {classData.byHour.map((d, i) => {
                        const maxB = Math.max(...classData.byHour.map(x => x.booked));
                        return <Cell key={i} fill={d.booked === maxB && maxB > 0 ? 'var(--chart-3)' : 'var(--chart-5)'} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, color, bg, label, value, valueColor }: {
  icon: React.ElementType; color: string; bg: string; label: string; value: string; valueColor?: string;
}) {
  return (
    <div className="bg-surface-2 border border-line rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon aria-hidden className={`w-3.5 h-3.5 ${color}`} />
        </div>
        <p className="text-xs text-fg-muted">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${valueColor ?? 'text-fg'}`}>{value}</p>
    </div>
  );
}

function KpiCard({ icon: Icon, color, bg, label, value, sub }: {
  icon: React.ElementType; color: string; bg: string; label: string; value: string; sub?: string;
}) {
  return (
    <div className="bg-surface-2 border border-line rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon aria-hidden className={`w-3.5 h-3.5 ${color}`} />
        </div>
        <p className="text-xs text-fg-muted">{label}</p>
      </div>
      <p className="text-2xl font-bold text-fg">{value}</p>
      {sub && <p className="text-xs text-fg-faint mt-0.5">{sub}</p>}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-40">
      <p className="text-sm text-fg-faint">{label}</p>
    </div>
  );
}

function downloadCSV(rows: (string | number)[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}
