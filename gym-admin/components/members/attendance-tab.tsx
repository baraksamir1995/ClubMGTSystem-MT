'use client';

import { useState, useMemo } from 'react';
import { Clock, Filter, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { fmtTime12, parsePgTimestamp, fmtDateGym } from '@/lib/time';
import type { AttendanceLog } from '@/lib/types/attendance-log';
import { Badge, Button, Input } from '@/components/ui';
import { useTranslations } from 'next-intl';

const PAGE_SIZE = 5;

interface Props {
  logs: AttendanceLog[];
  membershipStart: string | null;
  membershipEnd: string | null;
  planName: string | null;
}

export default function AttendanceTab({ logs, membershipStart, membershipEnd, planName }: Props) {
  const t = useTranslations('members.attendance');
  const tc = useTranslations('common');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  // Visits in current membership period
  const periodVisits = useMemo(() => {
    if (!membershipStart) return logs.length;
    return logs.filter(l => {
      const d = parsePgTimestamp(l.check_in_at);
      const start = new Date(membershipStart);
      const end = membershipEnd ? new Date(membershipEnd) : new Date();
      return d >= start && d <= end;
    }).length;
  }, [logs, membershipStart, membershipEnd]);

  // Filtered by date range
  const filtered = useMemo(() => {
    setPage(1);
    return logs.filter(l => {
      const d = parsePgTimestamp(l.check_in_at);
      if (fromDate && d < new Date(fromDate)) return false;
      if (toDate && d > new Date(toDate + 'T23:59:59')) return false;
      return true;
    });
  }, [logs, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const clearFilter = () => { setFromDate(''); setToDate(''); };

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-surface-2 border border-line rounded-xl p-4">
          <p className="text-xs text-fg-faint mb-1">{t('totalCheckins')}</p>
          <p className="text-2xl font-bold text-fg">{logs.length}</p>
        </div>
        <div className="bg-surface-2 border border-line rounded-xl p-4">
          <p className="text-xs text-fg-faint mb-1">{t('thisPeriod')}</p>
          <p className="text-2xl font-bold text-brand">{periodVisits}</p>
          {planName && <p className="text-xs text-fg-faint mt-0.5 truncate">{planName}</p>}
        </div>
        <div className="bg-surface-2 border border-line rounded-xl p-4">
          <p className="text-xs text-fg-faint mb-1">{t('lastVisit')}</p>
          <p className="text-sm font-semibold text-fg mt-1">
            {logs[0] ? fmtDateGym(logs[0].check_in_at) : '—'}
          </p>
          {logs[0] && (
            <p className="text-xs text-fg-faint">
              {fmtTime12(parsePgTimestamp(logs[0].check_in_at))}
            </p>
          )}
        </div>
      </div>

      {/* Date range filter */}
      <div className="bg-surface-2 border border-line rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-fg-muted" />
          <span className="text-sm font-medium text-fg">{t('filterByDate')}</span>
          {(fromDate || toDate) && (
            <Button variant="ghost" size="sm" className="ms-auto" onClick={clearFilter}>{tc('clear')}</Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-fg-faint mb-1">{t('from')}</label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="[color-scheme:dark]" />
          </div>
          <div>
            <label className="block text-xs text-fg-faint mb-1">{t('to')}</label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="[color-scheme:dark]" />
          </div>
        </div>
        {(fromDate || toDate) && (
          <p className="text-xs text-fg-faint mt-2">
            {filtered.length === 1
              ? t('recordsFound', { count: filtered.length })
              : t('recordsFoundPlural', { count: filtered.length })}
          </p>
        )}
      </div>

      {/* Full check-in list */}
      <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center gap-2">
          <Clock className="w-4 h-4 text-fg-muted" />
          <span className="text-sm font-medium text-fg">{t('checkInHistory')}</span>
          <span className="ms-auto text-xs text-fg-faint">{t('entries', { count: filtered.length })}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <CalendarDays className="w-8 h-8 text-fg-faint mx-auto mb-2" />
            <p className="text-sm text-fg-faint">
              {(fromDate || toDate) ? t('noAttendanceRange') : t('noAttendance')}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-fg-muted uppercase tracking-wide">
                    <th className="text-start px-4 py-3">{t('col.date')}</th>
                    <th className="text-start px-4 py-3">{t('col.checkIn')}</th>
                    <th className="text-start px-4 py-3">{t('col.branch')}</th>
                    <th className="text-start px-4 py-3">{t('col.entryPoint')}</th>
                    <th className="text-start px-4 py-3">{t('col.method')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {paginated.map(log => (
                    <tr key={log.id} className="hover:bg-surface-3/20 transition-colors">
                      <td className="px-4 py-3 text-fg">
                        {fmtDateGym(log.check_in_at)}
                      </td>
                      <td className="px-4 py-3 text-emerald-400 font-mono text-xs">
                        {fmtTime12(parsePgTimestamp(log.check_in_at))}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const bName = log.branch?.name ?? (Array.isArray(log.branches) ? log.branches[0]?.name : log.branches?.name);
                          return bName
                            ? <span className="text-xs text-fg-muted">{bName}</span>
                            : <span className="text-fg-faint text-xs">—</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {log.access_point
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400">{log.access_point}</span>
                          : <span className="text-fg-faint text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="neutral" size="sm" className="capitalize">{log.method ?? 'manual'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-line">
                <p className="text-xs text-fg-faint">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                    <button key={n} onClick={() => setPage(n)}
                      className={`w-7 h-7 text-xs rounded-lg transition-colors ${n === page ? 'bg-brand text-brand-ink font-medium' : 'text-fg-muted hover:text-fg hover:bg-surface-3'}`}>
                      {n}
                    </button>
                  ))}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
