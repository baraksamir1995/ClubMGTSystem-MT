'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Modal } from '@/components/ui';

const PRESETS = [
  { label: '7 days',   days: 7 },
  { label: '14 days',  days: 14 },
  { label: '1 month',  days: 30 },
  { label: '3 months', days: 90 },
];

interface Props {
  membershipId: string;
  memberName: string;
  currentExpiry: string | null;
  onClose: () => void;
}

export default function ExtendMembershipModal({ membershipId, memberName, currentExpiry, onClose }: Props) {
  const router = useRouter();
  const [days, setDays]       = useState('');
  const [preset, setPreset]   = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const resolvedDays = preset ?? (parseInt(days) || 0);

  const newExpiry = () => {
    if (!resolvedDays) return null;
    const base = currentExpiry && new Date(currentExpiry) > new Date()
      ? new Date(currentExpiry)
      : new Date();
    base.setDate(base.getDate() + resolvedDays);
    return base.toLocaleDateString('en-GB');
  };

  const handleSubmit = async () => {
    if (!resolvedDays || resolvedDays < 1) { toast.error('Enter number of days'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/memberships/${membershipId}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extra_days: resolvedDays }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }
      toast.success(`Membership extended by ${resolvedDays} days`);
      onClose();
      router.refresh();
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="sm">
      <Modal.Header>
        <span className="inline-flex items-center gap-2"><CalendarPlus className="w-4 h-4 text-brand" /> Extend Membership</span>
      </Modal.Header>

      <Modal.Body className="space-y-4">
        <p className="text-sm text-fg-muted">Extending membership for <span className="text-fg font-medium">{memberName}</span></p>

        {currentExpiry && (
          <div className="bg-surface-3/40 rounded-lg px-4 py-3 text-sm">
            <span className="text-fg-muted">Current expiry: </span>
            <span className="text-fg">{new Date(currentExpiry).toLocaleDateString('en-GB')}</span>
          </div>
        )}

        <div>
          <p className="text-xs text-fg-muted mb-2">Quick select</p>
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map(p => (
              <button key={p.days} type="button"
                onClick={() => { setPreset(p.days); setDays(''); }}
                className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                  preset === p.days
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-line hover:border-line-strong text-fg-muted'
                }`}>{p.label}</button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-fg-muted mb-1.5">Or enter custom days</p>
          <div className="flex items-center gap-2">
            <Input type="number" min="1" value={days}
              onChange={e => { setDays(e.target.value); setPreset(null); }}
              placeholder="e.g. 45" />
            <span className="text-xs text-fg-faint whitespace-nowrap">days</span>
          </div>
        </div>

        {newExpiry() && (
          <div className="bg-success-soft border border-success/20 rounded-lg px-4 py-3 text-sm">
            <span className="text-fg-muted">New expiry: </span>
            <span className="text-success font-medium">{newExpiry()}</span>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" fullWidth onClick={handleSubmit} disabled={!resolvedDays} isLoading={loading}>
          Extend {resolvedDays ? `+${resolvedDays}d` : ''}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
