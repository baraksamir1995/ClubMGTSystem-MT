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
          <h1 className="text-2xl font-bold text-white">Landing Page Leads</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {leads.length} total · <span className="text-amber-400">{uncontactedCount} new</span>
          </p>
        </div>
        <div className="relative">
          <button onClick={() => setShowExport(v => !v)}
            disabled={leads.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Download className="w-4 h-4" /> Export
          </button>
          {showExport && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden min-w-[180px]">
              <button onClick={() => { setShowExport(false); exportToExcel(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Excel (.xlsx)
              </button>
              <button onClick={() => { setShowExport(false); exportToCsv(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                <Download className="w-4 h-4 text-blue-400" /> CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, gym…"
            className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={filterContacted} onChange={e => setFilterContacted(e.target.value as any)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
            <option value="">All</option>
            <option value="false">Uncontacted</option>
            <option value="true">Contacted</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-purple-400 animate-spin" />
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
          <Inbox className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No leads yet</p>
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-xs text-gray-400 font-medium px-5 py-3 w-8"></th>
                  <th className="text-left text-xs text-gray-400 font-medium px-5 py-3">NAME</th>
                  <th className="text-left text-xs text-gray-400 font-medium px-5 py-3">GYM</th>
                  <th className="text-left text-xs text-gray-400 font-medium px-5 py-3">BRANCHES</th>
                  <th className="text-left text-xs text-gray-400 font-medium px-5 py-3">PHONE</th>
                  <th className="text-left text-xs text-gray-400 font-medium px-5 py-3">SUBMITTED</th>
                  <th className="text-right text-xs text-gray-400 font-medium px-5 py-3">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {leads.map(lead => (
                  <>
                    <tr key={lead.id} className={`hover:bg-gray-700/20 transition-colors ${!lead.contacted ? 'bg-amber-400/[0.02]' : ''}`}>
                      <td className="px-5 py-3.5">
                        <button onClick={() => toggleContacted(lead)} disabled={togglingId === lead.id}
                          title={lead.contacted ? 'Mark as new' : 'Mark as contacted'}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${lead.contacted ? 'bg-emerald-400 border-emerald-400' : 'border-gray-600 hover:border-gray-400'}`}>
                          {lead.contacted && <Check className="w-3 h-3 text-gray-900" strokeWidth={3} />}
                        </button>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-white font-medium">{lead.name}</p>
                        {!lead.contacted && <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-400/20 text-amber-400">NEW</span>}
                      </td>
                      <td className="px-5 py-3.5 text-gray-300">{lead.gym_name}</td>
                      <td className="px-5 py-3.5 text-gray-400">{lead.branches}</td>
                      <td className="px-5 py-3.5 text-gray-300 font-mono text-xs">{fmtPhone(lead.phone)}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{fmtDate(lead.created_at)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a href={whatsappLink(lead.phone)} target="_blank" rel="noopener noreferrer"
                            title="WhatsApp"
                            className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors">
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                          <a href={`tel:${fmtPhone(lead.phone)}`} title="Call"
                            className="p-1.5 text-gray-400 hover:text-purple-400 hover:bg-purple-400/10 rounded-lg transition-colors">
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                          {lead.notes && (
                            <button onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                              className={`px-2 py-1 rounded-lg text-xs transition-colors ${expandedId === lead.id ? 'bg-purple-400/20 text-purple-400' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                              Notes
                            </button>
                          )}
                          <button onClick={() => deleteLead(lead)} title="Delete"
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === lead.id && lead.notes && (
                      <tr key={`${lead.id}-notes`} className="bg-gray-900/50">
                        <td colSpan={7} className="px-5 py-3 text-sm text-gray-300">
                          <p className="text-xs text-gray-500 mb-1">Notes:</p>
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
