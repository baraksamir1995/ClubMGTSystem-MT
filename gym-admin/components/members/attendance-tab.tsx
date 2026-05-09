'use client';

import { useState, useMemo } from 'react';
import { Clock, Filter, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { fmtTime12, parsePgTimestamp, fmtDateGym } from '@/lib/time';
import type { AttendanceLog } from '@/lib/types/attendance-log';

const PAGE_SIZE = 5;

interface Props {
  logs: AttendanceLog[];
  membershipStart: string | null;
  membershipEnd: string | null;
  planName: string | null;
}

export default function AttendanceTab({ logs, membershipStart, membershipEnd, planName }: Props) {
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
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total Check-ins</p>
          <p className="text-2xl font-bold text-white">{logs.length}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">This Period</p>
          <p className="text-2xl font-bold text-purple-400">{periodVisits}</p>
          {planName && <p className="text-xs text-gray-500 mt-0.5 truncate">{planName}</p>}
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Last Visit</p>
          <p className="text-sm font-semibold text-white mt-1">
            {logs[0] ? fmtDateGym(logs[0].check_in_at) : '—'}
          </p>
          {logs[0] && (
            <p className="text-xs text-gray-500">
              {fmtTime12(parsePgTimestamp(logs[0].check_in_at))}
            </p>
          )}
        </div>
      </div>

      {/* Date range filter */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">Filter by date range</span>
          {(fromDate || toDate) && (
            <button onClick={clearFilter} className="ml-auto text-xs text-gray-400 hover:text-white transition-colors">
              Clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 [color-scheme:dark]"
            />
          </div>
        </div>
        {(fromDate || toDate) && (
          <p className="text-xs text-gray-500 mt-2">{filtered.length} record{filtered.length !== 1 ? 's' : ''} found</p>
        )}
      </div>

      {/* Full check-in list */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">Check-in History</span>
          <span className="ml-auto text-xs text-gray-500">{filtered.length} entries</span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <CalendarDays className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No attendance records{(fromDate || toDate) ? ' for this date range' : ''}.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Check In</th>
                    <th className="text-left px-4 py-3">Branch</th>
                    <th className="text-left px-4 py-3">Entry Point</th>
                    <th className="text-left px-4 py-3">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {paginated.map(log => (
                    <tr key={log.id} className="hover:bg-gray-700/20 transition-colors">
                      <td className="px-4 py-3 text-white">
                        {fmtDateGym(log.check_in_at)}
                      </td>
                      <td className="px-4 py-3 text-emerald-400 font-mono text-xs">
                        {fmtTime12(parsePgTimestamp(log.check_in_at))}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const bName = log.branch?.name ?? (Array.isArray(log.branches) ? log.branches[0]?.name : log.branches?.name);
                          return bName
                            ? <span className="text-xs text-gray-300">{bName}</span>
                            : <span className="text-gray-600 text-xs">—</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {log.access_point
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400">{log.access_point}</span>
                          : <span className="text-gray-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-gray-700 text-gray-300 capitalize">
                          {log.method ?? 'manual'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
                <p className="text-xs text-gray-500">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                    <button key={n} onClick={() => setPage(n)}
                      className={`w-7 h-7 text-xs rounded-lg transition-colors ${n === page ? 'bg-purple-600 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                      {n}
                    </button>
                  ))}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
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
