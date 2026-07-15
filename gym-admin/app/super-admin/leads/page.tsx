'use client';

import { useState, useEffect, useCallback } from 'react';
import { Inbox, Search, Check, Trash2, RefreshCw, MessageCircle, Phone, Filter, Download, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface Lead {
  id: string;
  name: string;
  phone: string;
  gym_name: string;
  branches: number;
  notes: string | null;
  source: string;
  user_agent: string | null;
  contacted: boolean;
  created_at: string;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterContacted, setFilterContacted] = useState<'' | 'true' | 'false'>('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterContacted) params.set('contacted', filterContacted);
      const qs = params.toString();
      const res = await fetch(`/api/super-admin/leads${qs ? `?${qs}` : ''}`);
      const json = await res.json();
      if (res.ok) setLeads(json.data ?? []);
    } catch { toast.error('Failed to load leads'); }
    finally { setLoading(false); }
  }, [search, filterContacted]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const toggleContacted = async (lead: Lead) => {
    setTogglingId(lead.id);
    try {
      const res = await fetch(`/api/super-admin/leads/${lead.id}`, { method: 'POST' });
      if (res.ok) {
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, contacted: !l.contacted } : l));
      }
    } catch { toast.error('Failed'); }
    finally { setTogglingId(null); }
  };

  const deleteLead = async (lead: Lead) => {
    if (!confirm(`Delete lead from ${lead.name}?`)) return;
    try {
      const res = await fetch(`/api/super-admin/leads/${lead.id}`, { method: 'DELETE' });
      if (res.ok) {
        setLeads(prev => prev.filter(l => l.id !== lead.id));
        toast.success('Lead deleted');
      }
    } catch { toast.error('Failed'); }
  };

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return '—'; }
  };

  const fmtPhone = (p: string) => p.startsWith('+') ? p : p.startsWith('20') ? `+${p}` : p.startsWith('0') ? `+2${p}` : p;
  const whatsappLink = (p: string) => `https://wa.me/${fmtPhone(p).replace(/\D/g, '')}`;

  const uncontactedCount = leads.filter(l => !l.contacted).length;
  // exportMenu state is declared at top of component
  const exportToExcel = () => {
    if (leads.length === 0) { toast.error('No leads to export'); return; }
    const rows = leads.map(l => ({
      Name: l.name,
      Phone: fmtPhone(l.phone),
      Gym: l.gym_name,
      Branches: l.branches,
      Notes: l.notes ?? '',
      Source: l.source,
      Status: l.contacted ? 'Contacted' : 'New',
      'Submitted At': new Date(l.created_at).toLocaleString('en-GB'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 24 }, { wch: 16 }, { wch: 28 }, { wch: 10 },
      { wch: 40 }, { wch: 18 }, { wch: 12 }, { wch: 20 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    const filename = `clby_leads_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success(`Exported ${leads.length} lead${leads.length !== 1 ? 's' : ''}`);
  };

  const exportToCsv = () => {
    if (leads.length === 0) { toast.error('No leads to export'); return; }
    const headers = ['Name', 'Phone', 'Gym', 'Branches', 'Notes', 'Source', 'Status', 'Submitted At'];
    const rows = leads.map(l => [
      l.name, fmtPhone(l.phone), l.gym_name, String(l.branches),
      (l.notes ?? '').replace(/\n/g, ' '), l.source,
      l.contacted ? 'Contacted' : 'New',
      new Date(l.created_at).toLocaleString('en-GB'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `clby_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success(`Exported ${leads.length} lead${leads.length !== 1 ? 's' : ''}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Landing Page Leads</h1>
          <p className="text-sm text-fg-muted mt-0.5">
            {leads.length} total · <span className="text-warning">{uncontactedCount} new</span>
          </p>
        </div>
        <div className="relative">
          <button onClick={() => setShowExport(v => !v)}
            disabled={leads.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-surface-2 border border-line hover:bg-surface-3 text-fg-muted text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Download className="w-4 h-4" aria-hidden /> Export
          </button>
          {showExport && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-surface-2 border border-line rounded-xl shadow-xl overflow-hidden min-w-[180px]">
              <button onClick={() => { setShowExport(false); exportToExcel(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-fg-muted hover:bg-surface-3 hover:text-fg transition-colors">
                <FileSpreadsheet className="w-4 h-4 text-success" aria-hidden /> Excel (.xlsx)
              </button>
              <button onClick={() => { setShowExport(false); exportToCsv(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-fg-muted hover:bg-surface-3 hover:text-fg transition-colors">
                <Download className="w-4 h-4 text-info" aria-hidden /> CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-faint" aria-hidden />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, gym…"
            className="w-full pl-9 pr-3 py-2 bg-surface-2 border border-line-strong rounded-lg text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-fg-muted" aria-hidden />
          <select value={filterContacted} onChange={e => setFilterContacted(e.target.value as any)}
            className="bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-brand">
            <option value="">All</option>
            <option value="false">Uncontacted</option>
            <option value="true">Contacted</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-brand animate-spin" />
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
          <Inbox className="w-10 h-10 text-fg-faint mx-auto mb-3" aria-hidden />
          <p className="text-sm text-fg-muted">No leads yet</p>
        </div>
      ) : (
        <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="text-left text-xs text-fg-muted font-medium px-5 py-3 w-8"><span className="sr-only">Contacted</span></th>
                  <th scope="col" className="text-left text-xs text-fg-muted font-medium px-5 py-3">NAME</th>
                  <th scope="col" className="text-left text-xs text-fg-muted font-medium px-5 py-3">GYM</th>
                  <th scope="col" className="text-left text-xs text-fg-muted font-medium px-5 py-3">BRANCHES</th>
                  <th scope="col" className="text-left text-xs text-fg-muted font-medium px-5 py-3">PHONE</th>
                  <th scope="col" className="text-left text-xs text-fg-muted font-medium px-5 py-3">SUBMITTED</th>
                  <th scope="col" className="text-right text-xs text-fg-muted font-medium px-5 py-3">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {leads.map(lead => (
                  <>
                    <tr key={lead.id} className={`hover:bg-surface-3/20 transition-colors ${!lead.contacted ? 'bg-warning-soft/30' : ''}`}>
                      <td className="px-5 py-3.5">
                        <button onClick={() => toggleContacted(lead)} disabled={togglingId === lead.id}
                          title={lead.contacted ? 'Mark as new' : 'Mark as contacted'}
                          aria-label={lead.contacted ? 'Mark as new' : 'Mark as contacted'}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${lead.contacted ? 'bg-success border-success/40' : 'border-line hover:border-line-strong'}`}>
                          {lead.contacted && <Check className="w-3 h-3 text-on-status" strokeWidth={3} aria-hidden />}
                        </button>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-fg font-medium">{lead.name}</p>
                        {!lead.contacted && <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning-soft text-warning">NEW</span>}
                      </td>
                      <td className="px-5 py-3.5 text-fg-muted">{lead.gym_name}</td>
                      <td className="px-5 py-3.5 text-fg-muted">{lead.branches}</td>
                      <td className="px-5 py-3.5 text-fg-muted font-mono text-xs">{fmtPhone(lead.phone)}</td>
                      <td className="px-5 py-3.5 text-fg-faint text-xs">{fmtDate(lead.created_at)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a href={whatsappLink(lead.phone)} target="_blank" rel="noopener noreferrer"
                            title="WhatsApp" aria-label="WhatsApp"
                            className="p-1.5 text-fg-muted hover:text-success hover:bg-success-soft rounded-lg transition-colors">
                            <MessageCircle className="w-3.5 h-3.5" aria-hidden />
                          </a>
                          <a href={`tel:${fmtPhone(lead.phone)}`} title="Call" aria-label="Call"
                            className="p-1.5 text-fg-muted hover:text-brand hover:bg-brand/10 rounded-lg transition-colors">
                            <Phone className="w-3.5 h-3.5" aria-hidden />
                          </a>
                          {lead.notes && (
                            <button onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                              className={`px-2 py-1 rounded-lg text-xs transition-colors ${expandedId === lead.id ? 'bg-brand/20 text-brand' : 'text-fg-muted hover:text-fg hover:bg-surface-3'}`}>
                              Notes
                            </button>
                          )}
                          <button onClick={() => deleteLead(lead)} title="Delete" aria-label="Delete lead"
                            className="p-1.5 text-fg-muted hover:text-danger hover:bg-danger-soft rounded-lg transition-colors">
                            <Trash2 className="w-3.5 h-3.5" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === lead.id && lead.notes && (
                      <tr key={`${lead.id}-notes`} className="bg-surface/50">
                        <td colSpan={7} className="px-5 py-3 text-sm text-fg-muted">
                          <p className="text-xs text-fg-faint mb-1">Notes:</p>
                          <p className="whitespace-pre-wrap">{lead.notes}</p>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
