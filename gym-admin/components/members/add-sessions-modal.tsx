'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Modal } from '@/components/ui';

const PRESETS = [5, 10, 20, 50];

interface Props {
  membershipId: string;
  memberName: string;
  sessionsUsed: number;
  sessionsTotal: number | null;
  onClose: () => void;
}

export default function AddSessionsModal({ membershipId, memberName, sessionsUsed, sessionsTotal, onClose }: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState('');
  const [preset, setPreset]     = useState<number | null>(null);
  const [loading, setLoading]   = useState(false);

  const resolvedSessions = preset ?? (parseInt(sessions) || 0);
  const newTotal = sessionsTotal != null ? sessionsTotal + resolvedSessions : null;

  const handleSubmit = async () => {
    if (!resolvedSessions || resolvedSessions < 1) { toast.error('Enter number of sessions'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/memberships/${membershipId}/add-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extra_sessions: resolvedSessions }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }
      toast.success(`${resolvedSessions} sessions added`);
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
        <span className="inline-flex items-center gap-2"><Plus className="w-4 h-4 text-brand" /> Add Sessions</span>
      </Modal.Header>

      <Modal.Body className="space-y-4">
        <p className="text-sm text-fg-muted">Adding sessions for <span className="text-fg font-medium">{memberName}</span></p>

        {sessionsTotal != null && (
          <div className="bg-surface-3/40 rounded-lg px-4 py-3 text-sm">
            <span className="text-fg-muted">Current: </span>
            <span className="text-fg">{sessionsUsed} used / {sessionsTotal} total</span>
            <span className="text-fg-muted ml-2">({Math.max(0, sessionsTotal - sessionsUsed)} remaining)</span>
          </div>
        )}

        <div>
          <p className="text-xs text-fg-muted mb-2">Quick select</p>
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map(p => (
              <button key={p} type="button"
                onClick={() => { setPreset(p); setSessions(''); }}
                className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                  preset === p
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-line hover:border-line-strong text-fg-muted'
                }`}>+{p}</button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-fg-muted mb-1.5">Or enter custom amount</p>
          <div className="flex items-center gap-2">
            <Input type="number" min="1" value={sessions}
              onChange={e => { setSessions(e.target.value); setPreset(null); }}
              placeholder="e.g. 15" />
            <span className="text-xs text-fg-faint whitespace-nowrap">sessions</span>
          </div>
        </div>

        {resolvedSessions > 0 && newTotal != null && (
          <div className="bg-success-soft border border-success/20 rounded-lg px-4 py-3 text-sm">
            <span className="text-fg-muted">New total: </span>
            <span className="text-success font-medium">{newTotal} sessions</span>
            <span className="text-fg-muted ml-2">({Math.max(0, newTotal - sessionsUsed)} remaining)</span>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" fullWidth onClick={handleSubmit} disabled={!resolvedSessions} isLoading={loading}>
          Add {resolvedSessions ? `+${resolvedSessions}` : ''} Sessions
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
