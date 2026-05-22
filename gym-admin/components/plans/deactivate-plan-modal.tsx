'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Users, Loader2, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import type { Plan } from '@/app/dashboard/plans/page';
import { Avatar, Button, Modal } from '@/components/ui';

interface ActiveMember {
  member_id: string;
  member_number: string;
  full_name: string;
  email: string;
  start_date: string | null;
  end_date: string | null;
  sessions_remaining: number | null;
}

interface Props {
  plan: Plan;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export default function DeactivatePlanModal({ plan, onConfirm, onClose }: Props) {
  const [members, setMembers]   = useState<ActiveMember[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    fetch(`/api/plans/${plan.id}/members`)
      .then(r => r.json())
      .then(data => setMembers(Array.isArray(data) ? data : []))
      .finally(() => setFetching(false));
  }, [plan.id]);

  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(); }
    finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>
        <span className="inline-flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-warning-soft flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-warning" />
          </span>
          Deactivate Plan
        </span>
      </Modal.Header>

      <Modal.Body className="space-y-4">
        {/* Plan info */}
        <div className="bg-surface-3/40 rounded-xl p-4">
          <p className="text-sm font-medium text-fg">{plan.name}</p>
          <p className="text-xs text-fg-muted mt-0.5 capitalize">{plan.plan_type} · {plan.billing_cycle ?? 'one-time'}</p>
        </div>

        {/* What happens */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide">What this means</p>
          <div className="space-y-2">
            {[
              { icon: '🚫', text: 'This plan will no longer appear when assigning plans to new members.' },
              { icon: '✅', text: 'Existing members already on this plan will not be affected — their membership continues normally.' },
              { icon: '↩️', text: 'You can reactivate this plan at any time.' },
            ].map((item, i) => (
              <div key={i} className="flex gap-2.5 text-sm text-fg-muted">
                <span className="flex-shrink-0">{item.icon}</span>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Members on this plan */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-fg-muted" />
            <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide">
              Members currently on this plan
            </p>
          </div>

          {fetching ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 text-fg-faint animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <div className="flex items-center gap-2.5 p-3 bg-surface-3/30 rounded-xl">
              <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
              <p className="text-sm text-fg-muted">No members are currently assigned to this plan.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-warning mb-2">
                ⚠ {members.length} member{members.length > 1 ? 's are' : ' is'} on this plan — their access will continue uninterrupted.
              </p>
              <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                {members.map(m => (
                  <Link
                    key={m.member_id}
                    href={`/dashboard/members/${m.member_id}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-3/40 hover:bg-surface-3 transition-colors"
                  >
                    <Avatar name={m.full_name ?? m.member_number ?? '?'} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-fg truncate">{m.full_name}</p>
                      <p className="text-xs text-fg-faint truncate">{m.email || m.member_number}</p>
                    </div>
                    {m.end_date && (
                      <span className="text-xs text-fg-faint flex-shrink-0">
                        until {new Date(m.end_date).toLocaleDateString('en-GB')}
                      </span>
                    )}
                    {m.sessions_remaining != null && (
                      <span className="text-xs text-fg-faint flex-shrink-0">
                        {m.sessions_remaining} sessions left
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" fullWidth onClick={handleConfirm} isLoading={loading}>Deactivate Plan</Button>
      </Modal.Footer>
    </Modal>
  );
}
