'use client';

import { useState } from 'react';
import { Mail, Phone, User, Clock, CheckCircle, XCircle, AlertCircle, Ban, Activity, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Invitation } from '@/app/dashboard/invitations/page';

interface Props {
  invitations: Invitation[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:     { label: 'Pending',     color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', icon: Clock },
  accepted:    { label: 'Accepted',    color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',       icon: CheckCircle },
  active:      { label: 'Active',      color: 'text-green-400 bg-green-400/10 border-green-400/20',    icon: Activity },
  expired:     { label: 'Expired',     color: 'text-fg-faint bg-gray-500/10 border-gray-500/20',       icon: AlertCircle },
  invalidated: { label: 'Invalidated', color: 'text-red-400 bg-red-400/10 border-red-400/20',          icon: Ban },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function countdown(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d left`;
  const hrs = Math.floor(diff / 3600000);
  return `${hrs}h left`;
}

const ALL_STATUSES = ['pending', 'accepted', 'active', 'expired', 'invalidated'] as const;

export default function InvitationsTable({ invitations: initial }: Props) {
  const [invitations, setInvitations] = useState(initial);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [invalidating, setInvalidating] = useState<string | null>(null);

  const filtered = statusFilter === 'all'
    ? invitations
    : invitations.filter(i => i.status === statusFilter);

  const counts = {
    all: invitations.length,
    pending: invitations.filter(i => i.status === 'pending').length,
    active: invitations.filter(i => i.status === 'active').length,
    accepted: invitations.filter(i => i.status === 'accepted').length,
    expired: invitations.filter(i => i.status === 'expired').length,
    invalidated: invitations.filter(i => i.status === 'invalidated').length,
  };

  const handleInvalidate = async (id: string) => {
    if (!confirm('Invalidate this invitation? The invite will be returned to the member\'s balance.')) return;
    setInvalidating(id);
    try {
      const res = await fetch(`/api/invitations/${id}/invalidate`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to invalidate'); return; }
      toast.success('Invitation invalidated. Invite returned to member.');
      setInvitations(prev => prev.map(i => i.id === id ? { ...i, status: 'invalidated' as const, invalidated_at: new Date().toISOString() } : i));
    } catch {
      toast.error('Network error');
    } finally {
      setInvalidating(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-fg">Guest Invitations</h1>
        <p className="text-sm text-fg-muted mt-1">Track and manage member guest invitations</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { key: 'pending',     label: 'Pending',     color: 'text-yellow-400' },
          { key: 'accepted',    label: 'Accepted',    color: 'text-blue-400' },
          { key: 'active',      label: 'Active',      color: 'text-green-400' },
          { key: 'expired',     label: 'Expired',     color: 'text-fg-muted' },
          { key: 'invalidated', label: 'Invalidated', color: 'text-red-400' },
        ].map(c => (
          <button
            key={c.key}
            onClick={() => setStatusFilter(prev => prev === c.key ? 'all' : c.key)}
            className={`bg-surface-2 border rounded-xl p-4 text-left transition-colors ${statusFilter === c.key ? "border-brand bg-brand/5" : "border-line hover:border-line-strong"}`}
          >
            <p className={`text-2xl font-bold ${c.color}`}>{counts[c.key as keyof typeof counts]}</p>
            <p className="text-xs text-fg-muted mt-1">{c.label}</p>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-fg-faint" />
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${statusFilter === 'all' ? 'bg-brand text-brand-ink' : 'bg-surface-3 text-fg-muted hover:bg-surface-4'}`}
          >
            All ({counts.all})
          </button>
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(prev => prev === s ? 'all' : s)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-brand text-brand-ink' : 'bg-surface-3 text-fg-muted hover:bg-surface-4'}`}
            >
              {STATUS_CONFIG[s].label} ({counts[s as keyof typeof counts]})
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
          <Mail className="w-10 h-10 text-fg-faint mx-auto mb-3" />
          <p className="text-fg-muted text-sm">No invitations found</p>
        </div>
      ) : (
        <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Guest</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Invited By</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Pass Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Sent</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Expires</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map(inv => {
                const member = inv.gym_members;
                const memberName = member?.profiles?.full_name ?? '—';
                const memberNum = member?.member_number ? `#${member.member_number}` : '';
                const passLabel = inv.duration_type === 'time_based'
                  ? `${inv.duration_days ?? '?'}-day pass`
                  : `${inv.max_visits} visit${inv.max_visits !== 1 ? 's' : ''}`;

                return (
                  <tr key={inv.id} className="hover:bg-surface-3/30 transition-colors">
                    {/* Guest */}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <User className="w-4 h-4 text-fg-muted" />
                        </div>
                        <div>
                          <p className="text-fg font-medium">{inv.guest_name ?? 'Unknown'}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-fg-faint" />
                            <span className="text-fg-muted text-xs">{inv.guest_email}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-fg-faint" />
                            <span className="text-fg-muted text-xs">{inv.guest_phone}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Invited by */}
                    <td className="px-4 py-3">
                      <p className="text-fg text-sm">{memberName}</p>
                      {memberNum && <p className="text-fg-faint text-xs">{memberNum}</p>}
                    </td>

                    {/* Pass type */}
                    <td className="px-4 py-3">
                      <span className="text-fg-muted text-sm">{passLabel}</span>
                      {inv.duration_type === 'per_visit' && inv.visits_used > 0 && (
                        <p className="text-fg-faint text-xs">{inv.visits_used} used</p>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.status} />
                      {inv.status === 'pending' && (
                        <p className="text-xs text-fg-faint mt-1">{countdown(inv.expires_at)}</p>
                      )}
                      {inv.status === 'active' && inv.pass_expires_at && (
                        <p className="text-xs text-fg-faint mt-1">Pass: {countdown(inv.pass_expires_at)}</p>
                      )}
                    </td>

                    {/* Sent */}
                    <td className="px-4 py-3 text-fg-muted text-sm">{fmtDate(inv.created_at)}</td>

                    {/* Validity */}
                    <td className="px-4 py-3 text-fg-muted text-sm">{fmtDate(inv.expires_at)}</td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      {inv.status === 'pending' && (
                        <button
                          onClick={() => handleInvalidate(inv.id)}
                          disabled={invalidating === inv.id}
                          className="px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 text-xs hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                          {invalidating === inv.id ? 'Cancelling…' : 'Invalidate'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
