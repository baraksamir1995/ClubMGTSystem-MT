'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, CheckSquare, Square, Loader2, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Plan } from '@/app/dashboard/plans/page';
import { Avatar, Badge, Button, Input, Modal } from '@/components/ui';

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
  const router = useRouter();
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

  return (
    <Modal open onClose={onClose} size="lg">
      <Modal.Header>
        <span className="inline-flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
            <UserCheck className="w-4 h-4 text-brand" />
          </span>
          <span>
            Assign Plan
            <span className="block text-xs text-fg-muted font-normal">{plan.name}</span>
          </span>
        </span>
      </Modal.Header>

      {done ? (
        /* ── Results view ── */
        <>
          <Modal.Body className="space-y-3">
            <p className="text-sm font-medium text-fg mb-3">Assignment Results</p>
            {results.map(r => (
              <div key={r.id} className={`flex items-center gap-3 p-3 rounded-xl ${r.ok ? 'bg-success-soft border border-success/20' : 'bg-danger-soft border border-danger/20'}`}>
                <span className="text-lg">{r.ok ? '✅' : '❌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-fg">{r.name}</p>
                  {!r.ok && <p className="text-xs text-danger mt-0.5">{r.error}</p>}
                </div>
              </div>
            ))}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="primary" fullWidth onClick={() => { onClose(); router.refresh(); }}>Done</Button>
          </Modal.Footer>
        </>
      ) : (
        /* ── Selection view ── */
        <>
          <Modal.Body className="space-y-4">
            {/* Plan summary */}
            <div className="bg-surface-3/40 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-fg">{plan.name}</p>
                <p className="text-xs text-fg-muted capitalize mt-0.5">{plan.plan_type} · {plan.billing_cycle ?? 'one-time'}</p>
              </div>
              <p className="text-sm font-semibold text-brand">{fmt(plan.price, plan.currency)}</p>
            </div>

            {/* Start date */}
            <div>
              <label className="block text-xs text-fg-muted mb-1.5">Start Date *</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="[color-scheme:dark]" required />
            </div>

            {/* Member search + select all */}
            <div className="flex items-center gap-2">
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search members…"
                leftIcon={<Search className="w-4 h-4" />}
                className="flex-1"
              />
              <button type="button" onClick={toggleAll}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-xs text-fg-muted hover:text-fg hover:border-line-strong transition-colors whitespace-nowrap">
                {allSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            {/* Member list */}
            <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
              {fetching ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 text-fg-faint animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-8 h-8 text-fg-faint mx-auto mb-2" />
                  <p className="text-sm text-fg-faint">No members found</p>
                </div>
              ) : (
                filtered.map(m => {
                  const isChecked = selected.has(m.id);
                  const name = String(m.profile?.full_name ?? m.member_number ?? '?');
                  return (
                    <label key={m.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${isChecked ? 'bg-brand/10 border border-brand/30' : 'hover:bg-surface-3/50 border border-transparent'}`}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggle(m.id)}
                        className="w-4 h-4 rounded border-line bg-surface-3 accent-brand cursor-pointer" />
                      <Avatar name={name} size={32} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-fg truncate">{name}</p>
                        <p className="text-xs text-fg-faint truncate">{m.profile?.email ?? m.member_number}</p>
                      </div>
                      <Badge variant={m.status === 'active' ? 'success' : 'neutral'} size="sm" className="capitalize">{m.status}</Badge>
                    </label>
                  );
                })
              )}
            </div>
          </Modal.Body>

          <Modal.Footer className="items-center justify-between">
            <p className="text-sm text-fg-muted">
              <span className="text-fg font-medium">{selected.size}</span> member{selected.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button variant="primary" onClick={handleAssign} disabled={selected.size === 0} isLoading={loading}>
                Assign to {selected.size || ''} member{selected.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </Modal.Footer>
        </>
      )}
    </Modal>
  );
}
