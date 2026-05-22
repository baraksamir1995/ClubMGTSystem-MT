'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dumbbell, Salad, HeartPulse, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Modal, Select, Textarea } from '@/components/ui';

const SERVICE_TYPES = [
  { value: 'personal_trainer',  label: 'Personal Training', icon: Dumbbell,   color: 'text-brand',       bg: 'bg-brand/10',       border: 'border-brand/30' },
  { value: 'nutritionist',      label: 'Nutrition',         icon: Salad,       color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
  { value: 'physiotherapist',   label: 'Physiotherapy',     icon: HeartPulse,  color: 'text-blue-400',    bg: 'bg-blue-400/10',    border: 'border-blue-400/30' },
] as const;

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card',          label: 'Card' },
  { value: 'other',         label: 'Other' },
];

interface Pkg {
  id: string;
  name: string;
  session_count: number;
  price: number;
  currency: string;
  description: string | null;
}

interface Trainer {
  id: string;
  name: string;
  photo_url: string | null;
}

interface Props {
  memberId: string;
  memberName: string;
  onClose: () => void;
}

const fmt = (amount: number, currency = 'EGP') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);

export default function AssignServiceModal({ memberId, memberName, onClose }: Props) {
  const router = useRouter();
  const [serviceType, setServiceType] = useState<string>('personal_trainer');
  const [packages, setPackages]       = useState<Pkg[]>([]);
  const [trainers, setTrainers]       = useState<Trainer[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<Pkg | null>(null);
  const [trainerId, setTrainerId]     = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [notes, setNotes]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [fetching, setFetching]       = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // Reload packages + trainers whenever service type changes
  useEffect(() => {
    setSelectedPkg(null);
    setTrainerId('');
    setFetching(true);

    Promise.all([
      fetch(`/api/service-packages?trainer_type=${serviceType}`).then(r => r.json()),
      fetch(`/api/trainers`).then(r => r.json()),
    ]).then(([pkgRes, trainerRes]) => {
      setPackages(pkgRes.packages ?? []);
      const all: any[] = trainerRes.trainers ?? [];
      setTrainers(all.filter(t => t.trainer_type === serviceType && t.is_active));
    }).finally(() => setFetching(false));
  }, [serviceType]);

  async function handleSubmit() {
    if (!selectedPkg) { setError('Please select a package'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/members/${memberId}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_package_id: selectedPkg.id,
          trainer_id:         trainerId || null,
          payment_method:     paymentMethod,
          notes:              notes || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to assign package');
      }
      toast.success('Service package assigned');
      onClose();
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} size="lg">
      <Modal.Header>
        <span>
          Assign Service Package
          <span className="block text-fg-muted text-xs font-normal mt-0.5">{memberName}</span>
        </span>
      </Modal.Header>

      <Modal.Body className="space-y-5">
          {/* Service type selector */}
          <div>
            <label className="block text-xs font-medium text-fg-muted uppercase tracking-wide mb-2">Service Type</label>
            <div className="grid grid-cols-3 gap-2">
              {SERVICE_TYPES.map(({ value, label, icon: Icon, color, bg, border }) => (
                <button
                  key={value}
                  onClick={() => setServiceType(value)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-medium transition-all ${
                    serviceType === value
                      ? `${bg} ${color} ${border}`
                      : 'bg-surface-2 text-fg-muted border-line hover:border-line-strong'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Package list */}
          <div>
            <label className="block text-xs font-medium text-fg-muted uppercase tracking-wide mb-2">Package</label>
            {fetching ? (
              <div className="text-sm text-fg-faint py-4 text-center">Loading packages…</div>
            ) : packages.length === 0 ? (
              <div className="text-sm text-fg-faint py-4 text-center">No packages available for this service type.</div>
            ) : (
              <div className="space-y-2">
                {packages.map(pkg => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPkg(pkg)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      selectedPkg?.id === pkg.id
                        ? 'bg-brand/10 border-brand/40 text-fg'
                        : 'bg-surface-2 border-line hover:border-line-strong text-fg-muted'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{pkg.name}</p>
                      <p className="text-xs text-fg-faint mt-0.5">{pkg.session_count} sessions</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-brand">{fmt(pkg.price, pkg.currency)}</p>
                      {selectedPkg?.id === pkg.id && <Check className="w-4 h-4 text-brand ml-auto mt-1" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Trainer (optional) */}
          {trainers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-fg-muted uppercase tracking-wide mb-2">
                Specialist <span className="text-fg-faint normal-case font-normal">(optional)</span>
              </label>
              <Select value={trainerId} onChange={e => setTrainerId(e.target.value)}>
                <option value="">— Not assigned —</option>
                {trainers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
          )}

          {/* Payment method */}
          <div>
            <label className="block text-xs font-medium text-fg-muted uppercase tracking-wide mb-2">Payment Method</label>
            <Select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-fg-muted uppercase tracking-wide mb-2">
              Notes <span className="text-fg-faint normal-case font-normal">(optional)</span>
            </label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Start next Monday"
              className="resize-none"
            />
          </div>

          {/* Summary */}
          {selectedPkg && (
            <div className="bg-surface-3/60 rounded-xl p-4 text-sm space-y-1.5">
              <div className="flex justify-between text-fg-muted">
                <span>Package</span>
                <span className="text-fg font-medium">{selectedPkg.name}</span>
              </div>
              <div className="flex justify-between text-fg-muted">
                <span>Sessions</span>
                <span className="text-fg">{selectedPkg.session_count}</span>
              </div>
              <div className="flex justify-between text-fg-muted">
                <span>Amount due</span>
                <span className="text-brand font-semibold">{fmt(selectedPkg.price, selectedPkg.currency)}</span>
              </div>
            </div>
          )}

          {error && <p className="text-danger text-sm">{error}</p>}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" fullWidth onClick={handleSubmit} disabled={!selectedPkg} isLoading={loading}>
          Assign Package
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
