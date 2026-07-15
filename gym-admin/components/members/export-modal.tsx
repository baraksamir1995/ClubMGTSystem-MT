'use client';

import { useState } from 'react';
import { Download, FileText, Table2, CheckSquare, Square } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Avatar, Badge, type BadgeProps, Button, Modal } from '@/components/ui';

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

const statusVariant: Record<string, BadgeProps['variant']> = {
  active:    'success',
  suspended: 'danger',
};

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
  const t = useTranslations('members.exportModal');
  const tc = useTranslations('common');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(members.map(m => m.id)));
  const [format, setFormat] = useState<Format>('csv');
  const [loading, setLoading] = useState(false);

  const allSelected = selected.size === members.length;

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
    <Modal open onClose={onClose} size="lg">
      <Modal.Header>{t('title')}</Modal.Header>

      <Modal.Body className="space-y-5">
        <p className="text-xs text-fg-muted -mt-1">{t('available', { count: members.length })}</p>

        {/* Format picker */}
        <div>
          <p className="text-xs text-fg-muted uppercase tracking-wide mb-3">{t('formatLabel')}</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'csv',   icon: FileText, label: 'CSV', desc: t('csvDesc') },
              { value: 'excel', icon: Table2,   label: 'Excel', desc: t('excelDesc') },
            ] as const).map(({ value, icon: Icon, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFormat(value)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors text-start ${
                  format === value
                    ? 'border-brand bg-brand/10'
                    : 'border-line hover:border-line-strong'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${format === value ? 'text-brand' : 'text-fg-faint'}`} aria-hidden />
                <div>
                  <p className={`text-sm font-medium ${format === value ? 'text-fg' : 'text-fg-muted'}`}>{label}</p>
                  <p className="text-xs text-fg-faint">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Member selection */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-fg-muted uppercase tracking-wide">{t('selectMembersLabel')}</p>
            <button
              type="button"
              onClick={toggleAll}
              className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-dim transition-colors"
            >
              {allSelected ? (
                <><CheckSquare className="w-3.5 h-3.5" aria-hidden /> {t('deselectAll')}</>
              ) : (
                <><Square className="w-3.5 h-3.5" aria-hidden /> {t('selectAllLabel')}</>
              )}
            </button>
          </div>
          <div className="max-h-[40vh] overflow-y-auto space-y-1 pe-1">
            {members.map(m => {
              const isChecked = selected.has(m.id);
              return (
                <label
                  key={m.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                    isChecked ? 'bg-surface-3' : 'hover:bg-surface-3/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(m.id)}
                    className="w-4 h-4 rounded border-line bg-surface-3 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-brand"
                  />
                  <Avatar name={m.profile?.full_name ?? m.member_number ?? '?'} size={28} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg truncate">{m.profile?.full_name ?? '—'}</p>
                    <p className="text-xs text-fg-faint truncate">{m.profile?.email ?? m.member_number}</p>
                  </div>
                  <Badge variant={statusVariant[m.status] ?? 'neutral'} size="sm" className="capitalize">{m.status}</Badge>
                </label>
              );
            })}
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer className="items-center justify-between">
        <p className="text-sm text-fg-muted">
          <span className="text-fg font-medium">{selected.size}</span>{' '}
          {selected.size === 1 ? t('selectedCount', { count: selected.size }) : t('selectedCountPlural', { count: selected.size })}
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose}>{tc('cancel')}</Button>
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={selected.size === 0}
            isLoading={loading}
            leftIcon={<Download className="w-4 h-4" />}
          >
            {format === 'csv' ? t('exportCsv') : t('exportExcel')}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
