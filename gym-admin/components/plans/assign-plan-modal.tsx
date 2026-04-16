'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Search, Users, CheckSquare, Square, Loader2, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Plan } from '@/app/dashboard/plans/page';

interface Member {
  id: string;
  member_number: string;
  status: string;
  profile: { full_name: string | null; email: string | null } | null;
}

interface Props {
  plan: Plan;
  onClose: () => void;
}

const fmt = (amount: number, currency = 'EGP') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);

export default function AssignPlanModal({ plan, onClose }: Props) {
  const [members, setMembers]     = useState<Member[]>([]);
  const [fetching, setFetching]   = useState(true);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading]     = useState(false);
  const [results, setResults]     = useState<{ id: string; name: string; ok: boolean; error?: string }[]>([]);
  const [done, setDone]           = useState(false);

  useEffect(() => {
    fetch('/api/members')
      .then(r => r.json())
      .then(data => setMembers((data.members ?? []).filter((m: Member) => m.status !== 'suspended')))
      .finally(() => setFetching(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(m =>
      m.profile?.full_name?.toLowerCase().includes(q) ||
      m.profile?.email?.toLowerCase().includes(q) ||
      String(m.member_number ?? '').toLowerCase().includes(q)
    );
  }, [members, search]);

  const allSelected  = filtered.length > 0 && filtered.every(m => selected.has(m.id));
  const toggleAll    = () => {
    if (allSelected) setSelected(prev => { const s = new Set(prev); filtered.forEach(m => s.delete(m.id)); return s; });
    else setSelected(prev => { const s = new Set(prev); filtered.forEach(m => s.add(m.id)); return s; });
  };
  const toggle = (id: string) => setSelected(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const handleAssign = async () => {
    if (selected.size === 0) { toast.error('Select at least one member'); return; }
    if (!startDate) { toast.error('Set a start date'); return; }
    setLoading(true);

    const memberList = members.filter(m => selected.has(m.id));
    const outcomes: typeof results = [];

    for (const m of memberList) {
      try {
        const res = await fetch(`/api/members/${m.id}/membership`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan_id: plan.id, start_date: startDate }),
        });
        const data = await res.json();
        outcomes.push({ id: m.id, name: m.profile?.full_name ?? m.member_number, ok: res.ok, error: data.error });
      } catch {
        outcomes.push({ id: m.id, name: m.profile?.full_name ?? m.member_number, ok: false, error: 'Network error' });
      }
    }

    setResults(outcomes);
    setDone(true);
    setLoading(false);

    const succeeded = outcomes.filter(o => o.ok).length;
    const failed    = outcomes.filter(o => !o.ok).length;
    if (failed === 0) toast.success(`Plan assigned to ${succeeded} member${succeeded > 1 ? 's' : ''}`);
    else if (succeeded > 0) toast.success(`${succeeded} assigned, ${failed} failed`);
    else toast.error('All assignments failed');
  };

  const inputCls = 'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Assign Plan</h2>
              <p className="text-xs text-gray-400">{plan.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          /* ── Results view ── */
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              <p className="text-sm font-medium text-white mb-3">Assignment Results</p>
              {results.map(r => (
                <div key={r.id} className={`flex items-center gap-3 p-3 rounded-xl ${r.ok ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                  <span className="text-lg">{r.ok ? '✅' : '❌'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{r.name}</p>
                    {!r.ok && <p className="text-xs text-red-400 mt-0.5">{r.error}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-gray-700 flex-shrink-0">
              <button onClick={() => { onClose(); window.location.reload(); }}
                className="w-full px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-medium text-white transition-colors">
                Done
              </button>
            </div>
          </>
        ) : (
          /* ── Selection view ── */
          <>
            <div className="flex-1 overflow-hidden flex flex-col px-6 py-5 space-y-4">

              {/* Plan summary */}
              <div className="bg-gray-700/40 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{plan.name}</p>
                  <p className="text-xs text-gray-400 capitalize mt-0.5">{plan.plan_type} · {plan.billing_cycle ?? 'one-time'}</p>
                </div>
                <p className="text-sm font-semibold text-purple-400">{fmt(plan.price, plan.currency)}</p>
              </div>

              {/* Start date */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Start Date *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className={`${inputCls} [color-scheme:dark]`}
                  required
                />
              </div>

              {/* Member search + select all */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search members…"
                    className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
                <button type="button" onClick={toggleAll}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-700 text-xs text-gray-400 hover:text-white hover:border-gray-600 transition-colors whitespace-nowrap">
                  {allSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {/* Member list */}
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0">
                {fetching ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No members found</p>
                  </div>
                ) : (
                  filtered.map(m => {
                    const isChecked = selected.has(m.id);
                    const name = String(m.profile?.full_name ?? m.member_number ?? '?');
                    return (
                      <label key={m.id}
                        className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${isChecked ? 'bg-purple-500/10 border border-purple-500/30' : 'hover:bg-gray-700/50 border border-transparent'}`}>
                        <input type="checkbox" checked={isChecked} onChange={() => toggle(m.id)}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-700 accent-purple-600 cursor-pointer" />
                        <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center text-xs font-bold text-purple-400 flex-shrink-0">
                          {name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{name}</p>
                          <p className="text-xs text-gray-500 truncate">{m.profile?.email ?? m.member_number}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                          m.status === 'active' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-gray-400/10 text-gray-400'
                        }`}>
                          {m.status}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between flex-shrink-0">
              <p className="text-sm text-gray-400">
                <span className="text-white font-medium">{selected.size}</span> member{selected.size !== 1 ? 's' : ''} selected
              </p>
              <div className="flex gap-3">
                <button onClick={onClose} disabled={loading}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleAssign} disabled={loading || selected.size === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-medium text-white transition-colors disabled:opacity-40">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Assigning…</> : `Assign to ${selected.size || ''} member${selected.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
