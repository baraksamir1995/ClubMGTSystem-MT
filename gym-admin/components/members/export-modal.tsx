'use client';

import { useState, useMemo } from 'react';
import { X, Download, FileText, Table2, CheckSquare, Square } from 'lucide-react';

interface MemberWithProfile {
  id: string;
  member_number: string;
  status: string;
  joined_at: string;
  notes: string | null;
  plan_type: string | null;
  plan_name: string | null;
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

interface Props {
  members: MemberWithProfile[];   // already filtered list from the table
  onClose: () => void;
}

type Format = 'csv' | 'excel';

function toRow(m: MemberWithProfile) {
  return {
    'Member #':   m.member_number ?? '',
    'Full Name':  m.profile?.full_name ?? '',
    'Email':      m.profile?.email ?? '',
    'Phone':      m.profile?.phone ?? '',
    'Status':     m.status ?? '',
    'Plan Name':  m.plan_name ?? '',
    'Plan Type':  m.plan_type ?? '',
    'Joined':     m.joined_at ? new Date(m.joined_at).toLocaleDateString('en-GB') : '',
  };
}

function downloadCSV(rows: ReturnType<typeof toRow>[]) {
  const headers = Object.keys(rows[0]);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csvContent =
    [headers.map(escape).join(','), ...rows.map(r => Object.values(r).map(v => escape(String(v))).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `members_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadExcel(rows: ReturnType<typeof toRow>[]) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Members');
  // Auto-width columns
  const colWidths = Object.keys(rows[0]).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String((r as Record<string, string>)[key]).length)) + 2,
  }));
  ws['!cols'] = colWidths;
  XLSX.writeFile(wb, `members_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export default function ExportModal({ members, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(members.map(m => m.id)));
  const [format, setFormat] = useState<Format>('csv');
  const [loading, setLoading] = useState(false);

  const allSelected = selected.size === members.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(members.map(m => m.id)));
  };

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      const rows = members.filter(m => selected.has(m.id)).map(toRow);
      if (format === 'csv') downloadCSV(rows);
      else await downloadExcel(rows);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Export Members</h2>
            <p className="text-xs text-gray-400 mt-0.5">{members.length} members available to export</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format picker */}
        <div className="px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Export Format</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'csv',   icon: FileText, label: 'CSV', desc: 'Comma-separated values' },
              { value: 'excel', icon: Table2,   label: 'Excel', desc: 'Microsoft Excel (.xlsx)' },
            ] as const).map(({ value, icon: Icon, label, desc }) => (
              <button
                key={value}
                onClick={() => setFormat(value)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                  format === value
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${format === value ? 'text-purple-400' : 'text-gray-500'}`} />
                <div>
                  <p className={`text-sm font-medium ${format === value ? 'text-white' : 'text-gray-300'}`}>{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Member selection */}
        <div className="flex-1 overflow-hidden flex flex-col px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Select Members</p>
            <button
              onClick={toggleAll}
              className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
            >
              {allSelected ? (
                <><CheckSquare className="w-3.5 h-3.5" /> Deselect all</>
              ) : (
                <><Square className="w-3.5 h-3.5" /> Select all</>
              )}
            </button>
          </div>
          <div className="overflow-y-auto flex-1 space-y-1 pr-1">
            {members.map(m => {
              const isChecked = selected.has(m.id);
              return (
                <label
                  key={m.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                    isChecked ? 'bg-gray-800' : 'hover:bg-gray-800/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(m.id)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-purple-600"
                  />
                  <div className="w-7 h-7 rounded-full bg-purple-600/20 flex items-center justify-center text-xs font-bold text-purple-400 flex-shrink-0">
                    {(m.profile?.full_name ?? m.member_number ?? '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{m.profile?.full_name ?? '—'}</p>
                    <p className="text-xs text-gray-500 truncate">{m.profile?.email ?? m.member_number}</p>
                  </div>
                  <span className={`text-xs capitalize px-2 py-0.5 rounded-full flex-shrink-0 ${
                    m.status === 'active' ? 'bg-emerald-400/10 text-emerald-400' :
                    m.status === 'suspended' ? 'bg-red-400/10 text-red-400' :
                    'bg-gray-400/10 text-gray-400'
                  }`}>
                    {m.status}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between flex-shrink-0">
          <p className="text-sm text-gray-400">
            <span className="text-white font-medium">{selected.size}</span> member{selected.size !== 1 ? 's' : ''} selected
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={selected.size === 0 || loading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              {loading ? 'Exporting…' : `Export ${format.toUpperCase()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
