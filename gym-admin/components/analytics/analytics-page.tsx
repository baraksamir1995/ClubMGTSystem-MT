'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Users, TrendingUp, TrendingDown, DollarSign, AlertCircle, RefreshCw, Download, Dumbbell, LayoutDashboard, FileSpreadsheet, Printer, X, ScanLine, CalendarDays } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, Cell, PieChart, Pie,
  AreaChart, Area,
} from 'recharts';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const PRESET_RANGES = [
  { label: 'Last 30 days',  days: 30  },
  { label: 'Last 90 days',  days: 90  },
  { label: 'Last 6 months', days: 180 },
  { label: 'Last 12 months',days: 365 },
];

const PIE_COLORS = ['#7c3aed','#6d28d9','#5b21b6','#4c1d95','#8b5cf6','#a78bfa','#c4b5fd'];

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
        // Surface the failure instead of leaving the tab silently blank.
        setMemberData(null); setRevenueData(null); setClassData(null);
        setError(data?.error ?? `Couldn't load analytics (HTTP ${res.status}). Try again.`);
      }
    } catch {
      setMemberData(null); setRevenueData(null); setClassData(null);
      setError('Network error — could not reach the server. Try again.');
    }
    finally { setLoading(false); }
  }, []);

  const fetchDashboard = useCallback(async (p: 'day' | 'week' | 'month') => {
    setDashLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/dashboard?period=${p}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (res.ok && data) setDashData(data);
      else {
        setDashData(null);
        setError(data?.error ?? `Couldn't load dashboard (HTTP ${res.status}). Try again.`);
      }
    } catch {
      setDashData(null);
      setError('Network error — could not reach the server. Try again.');
    }
    finally { setDashLoading(false); }
  }, []);

  useEffect(() => { fetchDashboard(dashPeriod); }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeTab !== 'dashboard') fetchData(fromDate, toDate); }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyPreset = (days: number) => {
    const from = dateStr(days);
    const to   = dateStr(0);
    setPreset(days); setFromDate(from); setToDate(to);
    fetchData(from, to);
  };

  const applyCustom = () => {
    if (!fromDate || !toDate) { toast.error('Select both dates'); return; }
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
    if (!exp) { toast.error('No data to export'); return; }
    if (format === 'csv') {
      downloadCSV(exp.rows, exp.name);
    } else if (format === 'xlsx') {
      const ws = XLSX.utils.aoa_to_sheet(exp.rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Report');
      XLSX.writeFile(wb, `${exp.name}_${new Date().toISOString().slice(0,10)}.xlsx`);
      toast.success('Excel file downloaded');
    } else {
      window.print();
    }
  };

  const tabCls = (t: string) =>
    `flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === t ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:text-fg'}`;

  const inp = 'bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-brand [color-scheme:dark]';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Reporting & Analytics</h1>
          <p className="text-sm text-fg-muted mt-0.5">Growth, churn, and revenue insights</p>
        </div>
        <div className="relative">
          <button onClick={() => setShowExport(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-surface-2 border border-line text-fg-muted text-sm font-medium rounded-lg hover:bg-surface-3 transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
          {showExport && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-surface-2 border border-line rounded-xl shadow-xl overflow-hidden min-w-[160px]">
              <button onClick={() => exportAs('csv')}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-fg-muted hover:bg-surface-3 hover:text-fg transition-colors">
                <Download className="w-4 h-4 text-emerald-400" /> CSV
              </button>
              <button onClick={() => exportAs('xlsx')}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-fg-muted hover:bg-surface-3 hover:text-fg transition-colors">
                <FileSpreadsheet className="w-4 h-4 text-blue-400" /> Excel (.xlsx)
              </button>
              <button onClick={() => exportAs('print')}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-fg-muted hover:bg-surface-3 hover:text-fg transition-colors">
                <Printer className="w-4 h-4 text-brand" /> Print / PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-2 border border-line rounded-xl p-1 w-fit flex-wrap">
        <button onClick={() => setActiveTab('dashboard')} className={tabCls('dashboard')}>
          <LayoutDashboard className="w-4 h-4" /> Dashboard
        </button>
        <button onClick={() => setActiveTab('members')} className={tabCls('members')}>
          <Users className="w-4 h-4" /> Member Growth & Churn
        </button>
        <button onClick={() => setActiveTab('revenue')} className={tabCls('revenue')}>
          <DollarSign className="w-4 h-4" /> Revenue & Payments
        </button>
        <button onClick={() => setActiveTab('classes')} className={tabCls('classes')}>
          <Dumbbell className="w-4 h-4" /> Class Attendance
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
                {p === 'day' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
            {dashLoading && <RefreshCw className="w-4 h-4 text-brand animate-spin ml-2" />}
          </div>

          {!dashLoading && dashData && (() => {
            const { kpis, timeline } = dashData;
            const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            return (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard icon={Users}        color="text-brand" bg="bg-brand/10" label="Active Members"  value={kpis.activeMembers.toLocaleString()} sub={kpis.newMembers > 0 ? `+${kpis.newMembers} new` : undefined} />
                  <KpiCard icon={DollarSign}   color="text-emerald-400" bg="bg-emerald-400/10" label="Revenue"       value={fmt(kpis.revenue, kpis.currency)} sub="collected" />
                  <KpiCard icon={ScanLine}     color="text-blue-400" bg="bg-blue-400/10"    label="Check-ins"        value={kpis.checkins.toLocaleString()} sub="gym entries" />
                  <KpiCard icon={CalendarDays} color="text-amber-400" bg="bg-amber-400/10"  label="Sessions"         value={kpis.sessions.toLocaleString()} sub={`${kpis.totalBookings} bookings`} />
                </div>

                {/* Timeline chart */}
                {timeline.length > 0 && (
                  <div className="bg-surface-2 border border-line rounded-xl p-5">
                    <h2 className="text-sm font-semibold text-fg mb-4">Performance Over Period</h2>
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={timeline.map(t => ({ ...t, date: fmtDate(t.date) }))}
                        margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="chkGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="rev" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false}
                          tickFormatter={v => fmt(v, kpis.currency)} />
                        <YAxis yAxisId="cnt" orientation="left" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                          labelStyle={{ color: '#f9fafb' }} itemStyle={{ color: '#d1d5db' }}
                          formatter={(v: any, name: any) => name === 'Revenue' ? fmt(v, kpis.currency) : v} />
                        <Area yAxisId="cnt" type="monotone" dataKey="checkins" name="Check-ins" stroke="#7c3aed" fill="url(#chkGrad)" strokeWidth={2} dot={false} />
                        <Area yAxisId="rev" type="monotone" dataKey="revenue"  name="Revenue"   stroke="#10b981" fill="url(#revGrad)" strokeWidth={2} dot={false} />
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
          {PRESET_RANGES.map(p => (
            <button key={p.days} onClick={() => applyPreset(p.days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                preset === p.days ? 'bg-brand/20 border-brand/40 text-brand' : 'border-line text-fg-muted hover:text-fg'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <span className="text-xs text-fg-faint">Custom:</span>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inp} />
          <span className="text-fg-faint text-xs">to</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={inp} />
          <button onClick={applyCustom} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-xs font-medium rounded-lg transition-colors disabled:opacity-40">
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
            Apply
          </button>
        </div>
      </div>}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-brand animate-spin" />
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
            <AlertCircle className="w-10 h-10 text-fg-faint mx-auto mb-3" />
            <p className="text-sm text-fg-muted">{error ?? 'No analytics data available for this view.'}</p>
            <button onClick={retry}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        );
      })()}

      {/* ── MEMBER GROWTH & CHURN ── */}
      {!loading && activeTab === 'members' && memberData && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={TrendingUp} color="text-emerald-400" bg="bg-emerald-400/10"
              label="New Members" value={memberData.totalNew.toString()} />
            <StatCard icon={TrendingDown} color="text-red-400" bg="bg-red-400/10"
              label="Cancellations" value={memberData.totalChurned.toString()} />
            <StatCard icon={Users} color="text-brand" bg="bg-brand/10"
              label="Net Growth" value={(memberData.totalNew - memberData.totalChurned >= 0 ? '+' : '') + (memberData.totalNew - memberData.totalChurned)}
              valueColor={memberData.totalNew >= memberData.totalChurned ? 'text-emerald-400' : 'text-red-400'} />
            <StatCard icon={BarChart3} color="text-amber-400" bg="bg-amber-400/10"
              label="Churn Rate" value={`${memberData.churnRate}%`}
              valueColor={memberData.churnRate > 10 ? 'text-red-400' : 'text-emerald-400'} />
          </div>

          {/* Growth vs Churn chart */}
          <div className="bg-surface-2 border border-line rounded-xl p-5">
            <h2 className="text-sm font-semibold text-fg mb-4">Growth vs Churn by Month</h2>
            {memberData.timeline.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={memberData.timeline.map(d => ({ ...d, month: fmtMonth(d.month) }))}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f9fafb' }} itemStyle={{ color: '#d1d5db' }} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
                  <Bar dataKey="new_members"   name="New Members"   fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="cancellations" name="Cancellations" fill="#ef4444" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Trend line */}
          {memberData.timeline.length > 1 && (
            <div className="bg-surface-2 border border-line rounded-xl p-5">
              <h2 className="text-sm font-semibold text-fg mb-4">Net Growth Trend</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={memberData.timeline.map(d => ({
                    month: fmtMonth(d.month),
                    net: d.new_members - d.cancellations,
                  }))}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f9fafb' }} itemStyle={{ color: '#d1d5db' }} />
                  <Line type="monotone" dataKey="net" name="Net Growth" stroke="#7c3aed" strokeWidth={2}
                    dot={{ fill: '#7c3aed', r: 4 }} activeDot={{ r: 6 }} />
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
            <StatCard icon={DollarSign} color="text-emerald-400" bg="bg-emerald-400/10"
              label="Total Collected" value={fmt(revenueData.totalRevenue, revenueData.currency)} />
            <StatCard icon={BarChart3} color="text-brand" bg="bg-brand/10"
              label="Paid Transactions" value={revenueData.paidCount.toString()} />
            <StatCard icon={AlertCircle} color="text-red-400" bg="bg-red-400/10"
              label="Overdue Amount" value={fmt(revenueData.totalOverdue, revenueData.currency)} />
            <StatCard icon={AlertCircle} color="text-amber-400" bg="bg-amber-400/10"
              label="Pending Amount" value={fmt(revenueData.totalPending, revenueData.currency)} />
          </div>

          {/* Outstanding balances warning */}
          {(revenueData.totalOverdue > 0 || revenueData.totalPending > 0) && (
            <div className="bg-red-400/5 border border-red-400/20 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">Outstanding Balances</p>
                <p className="text-xs text-fg-muted mt-0.5">
                  {fmt(revenueData.totalOverdue, revenueData.currency)} overdue across {revenueData.overdueCount} payment{revenueData.overdueCount !== 1 ? 's' : ''}
                  {revenueData.totalPending > 0 && ` · ${fmt(revenueData.totalPending, revenueData.currency)} pending`}
                </p>
              </div>
            </div>
          )}

          {/* Revenue timeline */}
          <div className="bg-surface-2 border border-line rounded-xl p-5">
            <h2 className="text-sm font-semibold text-fg mb-4">Revenue by Month</h2>
            {revenueData.timeline.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={revenueData.timeline.map(d => ({ ...d, month: fmtMonth(d.month) }))}
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false}
                    tickFormatter={v => fmt(v, revenueData.currency).replace(/\.00$/, '')} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f9fafb' }} itemStyle={{ color: '#d1d5db' }}
                    formatter={(v: any) => [fmt(v, revenueData.currency), 'Revenue']} />
                  <Bar dataKey="revenue" name="Revenue" radius={[4,4,0,0]}>
                    {revenueData.timeline.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#7c3aed' : '#6d28d9'} />)}
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
                <h2 className="text-sm font-semibold text-fg mb-4">Revenue by Plan</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={revenueData.byPlan} dataKey="revenue" nameKey="plan"
                      cx="50%" cy="50%" outerRadius={85} label={(entry: any) =>
                        `${entry.name} ${((entry.percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={{ stroke: '#4b5563' }}>
                      {revenueData.byPlan.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      formatter={(v: any) => [fmt(v, revenueData.currency), 'Revenue']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Plan breakdown table */}
              <div className="bg-surface-2 border border-line rounded-xl p-5">
                <h2 className="text-sm font-semibold text-fg mb-4">Plan Breakdown</h2>
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
                          <div className="text-right">
                            <span className="text-sm font-semibold text-fg">{fmt(p.revenue, revenueData.currency)}</span>
                            <span className="text-xs text-fg-faint ml-2">{p.count} payment{p.count !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <div className="w-full bg-surface-3 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        </div>
                        <p className="text-xs text-fg-faint mt-0.5 text-right">{pct}% of total</p>
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
              label="Total Sessions" value={classData.totalSessions.toString()} />
            <StatCard icon={Users}       color="text-emerald-400" bg="bg-emerald-400/10"
              label="Total Bookings" value={classData.totalBookings.toString()} />
            {(() => {
              const sorted = [...classData.byClass].sort((a, b) => b.totalBooked - a.totalBooked);
              return (
                <>
                  <StatCard icon={TrendingUp} color="text-blue-400" bg="bg-blue-400/10"
                    label="Most Popular" value={sorted[0]?.name ?? '—'} />
                  <StatCard icon={TrendingDown} color="text-amber-400" bg="bg-amber-400/10"
                    label="Least Popular" value={sorted.length > 1 ? (sorted[sorted.length - 1]?.name ?? '—') : '—'} />
                </>
              );
            })()}
          </div>

          {/* Class ranking table */}
          {classData.byClass.length === 0 ? (
            <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
              <Dumbbell className="w-10 h-10 text-fg-faint mx-auto mb-3" />
              <p className="text-sm text-fg-muted">No class sessions in this period</p>
            </div>
          ) : (
            <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-line flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-brand" />
                <h2 className="text-sm font-semibold text-fg">Classes by Attendance</h2>
              </div>
              <div className="divide-y divide-line">
                {classData.byClass.map((c, i) => {
                  const rate = c.bookingRate;
                  const rateColor = rate == null ? 'text-fg-faint'
                    : rate >= 75 ? 'text-emerald-400'
                    : rate >= 40 ? 'text-amber-400' : 'text-red-400';
                  return (
                    <div key={c.name} className="flex items-center gap-4 px-5 py-3.5">
                      <span className="text-lg font-bold text-fg-faint w-6 flex-shrink-0">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-fg">{c.name}</p>
                        <p className="text-xs text-fg-faint capitalize">{c.class_type} · {c.sessions} session{c.sessions !== 1 ? 's' : ''}</p>
                        {rate != null && (
                          <div className="w-full max-w-xs bg-surface-3 rounded-full h-1.5 mt-1.5">
                            <div className="h-1.5 rounded-full bg-brand" style={{ width: `${rate}%` }} />
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-fg">{c.totalBooked} bookings</p>
                        <p className="text-xs text-fg-faint">avg {c.avgBooked}/session</p>
                        {rate != null && <p className={`text-xs font-medium mt-0.5 ${rateColor}`}>{rate}% fill rate</p>}
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
              <h2 className="text-sm font-semibold text-fg mb-1">Bookings by Day of Week</h2>
              <p className="text-xs text-fg-faint mb-4">Green = peak day</p>
              {classData.byDay.every(d => d.booked === 0) ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={classData.byDay.map(d => ({ day: d.day.slice(0, 3), booked: d.booked }))}
                    margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="day" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      labelStyle={{ color: '#f9fafb' }} itemStyle={{ color: '#d1d5db' }} />
                    <Bar dataKey="booked" name="Bookings" radius={[4,4,0,0]}>
                      {classData.byDay.map((d, i) => {
                        const maxB = Math.max(...classData.byDay.map(x => x.booked));
                        return <Cell key={i} fill={d.booked === maxB && maxB > 0 ? '#10b981' : '#7c3aed'} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Peak times */}
            <div className="bg-surface-2 border border-line rounded-xl p-5">
              <h2 className="text-sm font-semibold text-fg mb-1">Bookings by Start Time</h2>
              <p className="text-xs text-fg-faint mb-4">Amber = peak hour</p>
              {classData.byHour.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={classData.byHour}
                    margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      labelStyle={{ color: '#f9fafb' }} itemStyle={{ color: '#d1d5db' }} />
                    <Bar dataKey="booked" name="Bookings" radius={[4,4,0,0]}>
                      {classData.byHour.map((d, i) => {
                        const maxB = Math.max(...classData.byHour.map(x => x.booked));
                        return <Cell key={i} fill={d.booked === maxB && maxB > 0 ? '#f59e0b' : '#6d28d9'} />;
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
  icon: any; color: string; bg: string; label: string; value: string; valueColor?: string;
}) {
  return (
    <div className="bg-surface-2 border border-line rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
        <p className="text-xs text-fg-muted">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${valueColor ?? 'text-fg'}`}>{value}</p>
    </div>
  );
}

function KpiCard({ icon: Icon, color, bg, label, value, sub }: {
  icon: any; color: string; bg: string; label: string; value: string; sub?: string;
}) {
  return (
    <div className="bg-surface-2 border border-line rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
        <p className="text-xs text-fg-muted">{label}</p>
      </div>
      <p className="text-2xl font-bold text-fg">{value}</p>
      {sub && <p className="text-xs text-fg-faint mt-0.5">{sub}</p>}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-40">
      <p className="text-sm text-fg-faint">No data for this period</p>
    </div>
  );
}

function downloadCSV(rows: any[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}
